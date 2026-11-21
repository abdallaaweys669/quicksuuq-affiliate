import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensurePromotionsTables, mapBannerRow, type MarqueeItem } from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePromotionsTables();

    await query(
      `DELETE FROM public.bundle_banners
       WHERE bundle_id NOT IN ('ALL_BUNDLES', 'PRODUCT', 'INFO_ONLY')
         AND bundle_id NOT IN (SELECT id FROM public.bundles)`
    );
    const [res, mqRes] = await Promise.all([
      query("SELECT * FROM public.bundle_banners ORDER BY sort_order ASC, created_at DESC"),
      query<{ key: string; value: string }>(
        "SELECT key, value FROM public.site_settings WHERE key IN ('top_marquee_items', 'top_marquee_text')"
      ),
    ]);
    const settingsMap = new Map(mqRes.rows.map((r) => [r.key, r.value]));
    let marqueeItems: MarqueeItem[] = [];
    const rawItems = settingsMap.get("top_marquee_items");
    if (rawItems) {
      try {
        const parsed = JSON.parse(rawItems);
        if (Array.isArray(parsed)) marqueeItems = parsed;
      } catch {
        marqueeItems = [];
      }
    } else if (settingsMap.get("top_marquee_text")) {
      marqueeItems = [
        {
          id: "mq_legacy",
          text: String(settingsMap.get("top_marquee_text")),
          promotion_id: null,
          is_active: true,
        },
      ];
    }
    return NextResponse.json({
      banners: res.rows.map(mapBannerRow),
      marquee_items: marqueeItems,
      marquee_text: settingsMap.get("top_marquee_text") ?? "",
    });
  } catch (err) {
    console.error("GET /api/admin/bundle-banners failed:", err);
    return NextResponse.json({ error: "Failed to load banners" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePromotionsTables();

    const body = await request.json();
    const bundleId = String(body.bundle_id || "").trim();
    if (!bundleId) {
      return NextResponse.json({ error: "bundle_id is required" }, { status: 400 });
    }
    const id = `bnr_${randomUUID().slice(0, 8)}`;
    const linkUrl = body.link_url ? String(body.link_url).trim() : null;
    const bgImage = body.bg_image ? String(body.bg_image).trim() : null;
    const bgColor = String(body.bg_color || "#0e8a60");
    const elements = Array.isArray(body.elements) ? body.elements : [];
    const isActive = body.is_active !== false;

    const ins = await query(
      `INSERT INTO public.bundle_banners (id, bundle_id, link_url, bg_image, bg_color, elements_json, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [id, bundleId, linkUrl, bgImage, bgColor, JSON.stringify(elements), isActive]
    );
    return NextResponse.json({ banner: mapBannerRow(ins.rows[0]) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/bundle-banners failed:", err);
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePromotionsTables();

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await query("SELECT * FROM public.bundle_banners WHERE id = $1", [id]);
    if (!existing.rows[0]) return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    const cur = mapBannerRow(existing.rows[0]);

    const bundleId = body.bundle_id != null ? String(body.bundle_id) : cur.bundle_id;
    const linkUrl = body.link_url !== undefined ? (body.link_url ? String(body.link_url).trim() : null) : cur.link_url ?? null;
    const bgImage = body.bg_image !== undefined ? (body.bg_image ? String(body.bg_image).trim() : null) : cur.bg_image;
    const bgColor = body.bg_color != null ? String(body.bg_color) : cur.bg_color;
    const elements = Array.isArray(body.elements) ? body.elements : cur.elements;
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : cur.is_active;

    const upd = await query(
      `UPDATE public.bundle_banners
       SET bundle_id = $2, link_url = $3, bg_image = $4, bg_color = $5, elements_json = $6, is_active = $7
       WHERE id = $1
       RETURNING *`,
      [id, bundleId, linkUrl, bgImage, bgColor, JSON.stringify(elements), isActive]
    );
    return NextResponse.json({ banner: mapBannerRow(upd.rows[0]) });
  } catch (err) {
    console.error("PATCH /api/admin/bundle-banners failed:", err);
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePromotionsTables();

    const body = await request.json();
    if (Array.isArray(body.marquee_items)) {
      const cleaned: MarqueeItem[] = body.marquee_items
        .filter((m: any) => String(m?.text || "").trim())
        .map((m: any) => ({
          id: String(m.id || `mq_${randomUUID().slice(0, 8)}`),
          text: String(m.text).trim(),
          promotion_id: m.promotion_id ? String(m.promotion_id).trim() : null,
          is_active: m.is_active !== false,
        }));
      await query(
        `INSERT INTO public.site_settings (key, value, updated_at)
         VALUES ('top_marquee_items', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(cleaned)]
      );
      return NextResponse.json({ success: true, marquee_items: cleaned });
    }

    const marqueeText = String(body.marquee_text ?? "").trim();
    await query(
      `INSERT INTO public.site_settings (key, value, updated_at)
       VALUES ('top_marquee_text', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [marqueeText]
    );
    return NextResponse.json({ success: true, marquee_text: marqueeText });
  } catch (err) {
    console.error("PUT /api/admin/bundle-banners failed:", err);
    return NextResponse.json({ error: "Failed to save marquee items" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePromotionsTables();

    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await query("DELETE FROM public.bundle_banners WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/bundle-banners failed:", err);
    return NextResponse.json({ error: "Failed to delete banner" }, { status: 500 });
  }
}
