import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  ensurePromotionsTables,
  mapBundleRow,
  mapPromotionRow,
  slugifyBundle,
  type BundleItem,
} from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminPromotions() {
  const admin = await getAdminSession();
  if (!admin) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  await ensurePromotionsTables();
  return { admin };
}

export async function GET() {
  try {
    const auth = await requireAdminPromotions();
    if ("error" in auth && auth.error) return auth.error;

    const [bRes, pRes] = await Promise.all([
      query("SELECT * FROM public.bundles ORDER BY created_at DESC"),
      query("SELECT * FROM public.promotions ORDER BY created_at DESC"),
    ]);

    return NextResponse.json({
      bundles: bRes.rows.map(mapBundleRow),
      promotions: pRes.rows.map(mapPromotionRow),
    });
  } catch (err) {
    console.error("GET /api/admin/promotions failed:", err);
    return NextResponse.json({ error: "Failed to load promotions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminPromotions();
    if ("error" in auth && auth.error) return auth.error;

    const body = await request.json();
    const kind = body.kind === "promo" ? "promo" : "bundle";

    if (kind === "bundle") {
      const title = String(body.title || "").trim();
      if (!title) {
        return NextResponse.json({ error: "Bundle title is required" }, { status: 400 });
      }
      const description = String(body.description || "").trim();
      const items: BundleItem[] = Array.isArray(body.items)
        ? body.items
            .filter((it: any) => String(it?.title || "").trim())
            .map((it: any) => ({
              title: String(it.title).trim(),
              qty: Math.max(1, Number(it.qty || 1)),
              unitPrice: Math.max(0, Number(it.unitPrice || 0)),
              unit: it.unit === "kg" ? "kg" : "pcs",
              image: it.image ? String(it.image) : null,
            }))
        : [];

      const computedRegular = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
      const regularPrice =
        body.regular_price != null && Number(body.regular_price) > 0
          ? Number(body.regular_price)
          : computedRegular;
      const bundlePrice = Math.max(0, Number(body.bundle_price || 0));
      const promoPrice =
        body.promo_price != null && body.promo_price !== "" && Number(body.promo_price) > 0
          ? Number(body.promo_price)
          : null;
      const promoEndsAt = body.promo_ends_at ? new Date(body.promo_ends_at).toISOString() : null;
      const stock = Math.max(0, Math.floor(Number(body.stock || 0)));
      const posterUrl = body.poster_url ? String(body.poster_url).trim() : null;
      const isActive = body.is_active !== false;

      const id = `bnd_${randomUUID().slice(0, 8)}`;
      const slug = `${slugifyBundle(title)}-${id.slice(4, 8)}`;

      const ins = await query(
        `INSERT INTO public.bundles (id, title, description, slug, poster_url, items_json, regular_price, bundle_price, promo_price, promo_ends_at, stock, sold_count, commission_type, commission_value, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 'DEFAULT', 0, $12)
         RETURNING *`,
        [
          id,
          title,
          description,
          slug,
          posterUrl,
          JSON.stringify(items),
          regularPrice,
          bundlePrice,
          promoPrice,
          promoEndsAt,
          stock,
          isActive,
        ]
      );

      return NextResponse.json({ bundle: mapBundleRow(ins.rows[0]) }, { status: 201 });
    }

    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Promotion title is required" }, { status: 400 });
    }
    const ruleType =
      body.rule_type === "PERCENT_OFF"
        ? "PERCENT_OFF"
        : body.rule_type === "MIN_ORDER_AMOUNT"
        ? "MIN_ORDER_AMOUNT"
        : "FIRST_N_CUSTOMERS";
    const maxClaims =
      ruleType === "FIRST_N_CUSTOMERS" ? Math.max(1, Math.floor(Number(body.max_claims || 20))) : null;
    const minOrderUsd =
      ruleType === "MIN_ORDER_AMOUNT" ? Math.max(1, Number(body.min_order_usd || 35)) : null;
    const discountPercent =
      ruleType === "PERCENT_OFF" ? Math.min(90, Math.max(1, Number(body.discount_percent || 20))) : null;
    const rewardType = ruleType === "PERCENT_OFF" ? "PERCENT_OFF" : "FREE_DELIVERY";
    const startsAt = body.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString();
    const endsAt = body.ends_at ? new Date(body.ends_at).toISOString() : null;
    const isActive = body.is_active !== false;

    const id = `prm_${randomUUID().slice(0, 8)}`;
    const ins = await query(
      `INSERT INTO public.promotions (id, title, rule_type, max_claims, claimed_count, min_order_usd, discount_percent, reward_type, starts_at, ends_at, is_active)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, title, ruleType, maxClaims, minOrderUsd, discountPercent, rewardType, startsAt, endsAt, isActive]
    );

    return NextResponse.json({ promotion: mapPromotionRow(ins.rows[0]) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/promotions failed:", err);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminPromotions();
    if ("error" in auth && auth.error) return auth.error;

    const body = await request.json();
    const kind = body.kind === "promo" ? "promo" : "bundle";
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (kind === "bundle") {
      const existing = await query("SELECT * FROM public.bundles WHERE id = $1", [id]);
      if (!existing.rows[0]) {
        return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
      }
      const cur = mapBundleRow(existing.rows[0]);
      const title = body.title != null ? String(body.title).trim() : cur.title;
      const description = body.description !== undefined ? String(body.description || "").trim() : cur.description;
      const posterUrl = body.poster_url !== undefined ? (body.poster_url ? String(body.poster_url).trim() : null) : cur.poster_url;
      const items = Array.isArray(body.items) ? body.items : cur.items;
      const regularPrice = body.regular_price != null ? Number(body.regular_price) : cur.regular_price;
      const bundlePrice = body.bundle_price != null ? Number(body.bundle_price) : cur.bundle_price;
      const promoPrice =
        body.promo_price !== undefined
          ? body.promo_price != null && body.promo_price !== "" && Number(body.promo_price) > 0
            ? Number(body.promo_price)
            : null
          : cur.promo_price;
      const promoEndsAt =
        body.promo_ends_at !== undefined
          ? body.promo_ends_at
            ? new Date(body.promo_ends_at).toISOString()
            : null
          : cur.promo_ends_at;
      const stock = body.stock != null ? Math.max(0, Math.floor(Number(body.stock))) : cur.stock;
      const isActive = body.is_active !== undefined ? Boolean(body.is_active) : cur.is_active;

      const upd = await query(
        `UPDATE public.bundles
         SET title = $2, description = $3, poster_url = $4, items_json = $5, regular_price = $6, bundle_price = $7,
             promo_price = $8, promo_ends_at = $9, stock = $10, is_active = $11, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          title,
          description,
          posterUrl,
          JSON.stringify(items),
          regularPrice,
          bundlePrice,
          promoPrice,
          promoEndsAt,
          stock,
          isActive,
        ]
      );
      return NextResponse.json({ bundle: mapBundleRow(upd.rows[0]) });
    }

    const existing = await query("SELECT * FROM public.promotions WHERE id = $1", [id]);
    if (!existing.rows[0]) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }
    const cur = mapPromotionRow(existing.rows[0]);
    const title = body.title != null ? String(body.title).trim() : cur.title;
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : cur.is_active;
    const maxClaims = body.max_claims !== undefined ? (body.max_claims != null ? Number(body.max_claims) : null) : cur.max_claims;
    const minOrderUsd = body.min_order_usd !== undefined ? (body.min_order_usd != null ? Number(body.min_order_usd) : null) : cur.min_order_usd;
    const discountPercent = body.discount_percent !== undefined ? (body.discount_percent != null ? Number(body.discount_percent) : null) : cur.discount_percent;
    const endsAt = body.ends_at !== undefined ? (body.ends_at ? new Date(body.ends_at).toISOString() : null) : cur.ends_at;

    const upd = await query(
      `UPDATE public.promotions
       SET title = $2, is_active = $3, max_claims = $4, min_order_usd = $5, discount_percent = $6, ends_at = $7
       WHERE id = $1
       RETURNING *`,
      [id, title, isActive, maxClaims, minOrderUsd, discountPercent, endsAt]
    );
    return NextResponse.json({ promotion: mapPromotionRow(upd.rows[0]) });
  } catch (err) {
    console.error("PATCH /api/admin/promotions failed:", err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminPromotions();
    if ("error" in auth && auth.error) return auth.error;

    const kind = request.nextUrl.searchParams.get("kind") === "promo" ? "promo" : "bundle";
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (kind === "promo") {
      await query("DELETE FROM public.promotions WHERE id = $1", [id]);
    } else {
      await query("DELETE FROM public.bundles WHERE id = $1", [id]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/promotions failed:", err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
