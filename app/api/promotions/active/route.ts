import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensurePromotionsTables, mapBannerRow, mapBundleRow, mapPromotionRow } from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    await ensurePromotionsTables();

    const [bRes, pRes, bnRes] = await Promise.all([
      query(
        `SELECT * FROM public.bundles
         WHERE is_active = TRUE AND stock > 0
         ORDER BY created_at DESC`
      ),
      query(
        `SELECT * FROM public.promotions
         WHERE is_active = TRUE
           AND (starts_at IS NULL OR starts_at <= NOW())
           AND (ends_at IS NULL OR ends_at >= NOW())
           AND (
             rule_type <> 'FIRST_N_CUSTOMERS'
             OR max_claims IS NULL
             OR claimed_count < max_claims
           )
         ORDER BY created_at DESC`
      ),
      query(
        `SELECT * FROM public.bundle_banners
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, created_at DESC`
      ),
    ]);

    const bundles = bRes.rows.map(mapBundleRow);
    const bundlesById = new Map(bundles.map((b) => [b.id, b]));
    const bundleBanners = bnRes.rows
      .map(mapBannerRow)
      .map((bn) => ({
        ...bn,
        target_type: bn.bundle_id === "ALL_BUNDLES" ? "all_bundles" : "bundle",
        bundle: bn.bundle_id === "ALL_BUNDLES" ? null : bundlesById.get(bn.bundle_id) || null,
      }))
      .filter((bn) => bn.bundle_id === "ALL_BUNDLES" || bn.bundle !== null);

    return NextResponse.json(
      {
        bundles,
        promotions: pRes.rows.map(mapPromotionRow),
        bundle_banners: bundleBanners,
      },
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("GET /api/promotions/active failed:", err);
    return NextResponse.json(
      { error: "Failed to load active promotions" },
      { status: 500, headers: corsHeaders }
    );
  }
}
