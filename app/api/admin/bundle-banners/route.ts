import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensurePromotionsTables, mapBannerRow } from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensurePromotionsTables();

    const res = await query("SELECT * FROM public.bundle_banners ORDER BY sort_order ASC, created_at DESC");
    return NextResponse.json({ banners: res.rows.map(mapBannerRow) });
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
    const bgImage = body.bg_image ? String(body.bg_image).trim() : null;
    const bgColor = String(body.bg_color || "#0e8a60");
    const elements = Array.isArray(body.elements) ? body.elements : [];
    const isActive = body.is_active !== false;

    const ins = await query(
      `INSERT INTO public.bundle_banners (id, bundle_id, bg_image, bg_color, elements_json, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING *`,
      [id, bundleId, bgImage, bgColor, JSON.stringify(elements), isActive]
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
    const bgImage = body.bg_image !== undefined ? (body.bg_image ? String(body.bg_image).trim() : null) : cur.bg_image;
    const bgColor = body.bg_color != null ? String(body.bg_color) : cur.bg_color;
    const elements = Array.isArray(body.elements) ? body.elements : cur.elements;
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : cur.is_active;

    const upd = await query(
      `UPDATE public.bundle_banners
       SET bundle_id = $2, bg_image = $3, bg_color = $4, elements_json = $5, is_active = $6
       WHERE id = $1
       RETURNING *`,
      [id, bundleId, bgImage, bgColor, JSON.stringify(elements), isActive]
    );
    return NextResponse.json({ banner: mapBannerRow(upd.rows[0]) });
  } catch (err) {
    console.error("PATCH /api/admin/bundle-banners failed:", err);
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
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
