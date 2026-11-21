import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensurePromotionsTables, mapBannerRow, mapBundleRow, mapPromotionRow, type MarqueeItem } from "@/lib/promotions";

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

    const [bRes, pRes, bnRes, mqRes] = await Promise.all([
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
      query<{ key: string; value: string }>(
        `SELECT key, value FROM public.site_settings WHERE key IN ('top_marquee_items', 'top_marquee_text')`
      ),
    ]);

    const bundles = bRes.rows.map(mapBundleRow);
    const promotions = pRes.rows.map(mapPromotionRow);
    const promosById = new Map(promotions.map((p) => [p.id, p]));
    const bundlesById = new Map(bundles.map((b) => [b.id, b]));
    const specialTargets = new Set(["ALL_BUNDLES", "PRODUCT", "INFO_ONLY"]);
    const bundleBanners = bnRes.rows
      .map(mapBannerRow)
      .map((bn) => ({
        ...bn,
        target_type:
          bn.bundle_id === "ALL_BUNDLES"
            ? "all_bundles"
            : bn.bundle_id === "PRODUCT"
            ? "product"
            : bn.bundle_id === "INFO_ONLY"
            ? "info"
            : "bundle",
        bundle: specialTargets.has(bn.bundle_id) ? null : bundlesById.get(bn.bundle_id) || null,
      }))
      .filter((bn) => specialTargets.has(bn.bundle_id) || bn.bundle !== null);

    const settingsMap = new Map(mqRes.rows.map((r) => [r.key, r.value]));
    const rawItemsJson = settingsMap.get("top_marquee_items");
    let marqueeItemsOut: Array<{ id: string; text: string; badge: string | null }> = [];
    if (rawItemsJson) {
      try {
        const parsed = JSON.parse(rawItemsJson) as MarqueeItem[];
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!item?.is_active || !String(item?.text || "").trim()) continue;
            if (item.promotion_id) {
              const linkedPromo = promosById.get(item.promotion_id);
              if (!linkedPromo) continue; // Hide automatically when linked promotion is inactive/expired/full
              const badge =
                linkedPromo.rule_type === "FIRST_N_CUSTOMERS" && linkedPromo.max_claims != null
                  ? `${Math.max(0, linkedPromo.max_claims - (linkedPromo.claimed_count || 0))} spots left`
                  : linkedPromo.rule_type === "PERCENT_OFF"
                  ? `${linkedPromo.discount_percent || 20}% OFF`
                  : "Limited Time";
              marqueeItemsOut.push({ id: item.id, text: item.text, badge });
            } else {
              marqueeItemsOut.push({ id: item.id, text: item.text, badge: null });
            }
          }
        }
      } catch {
        marqueeItemsOut = [];
      }
    } else {
      if (settingsMap.get("top_marquee_text")) {
        marqueeItemsOut.push({ id: "mq_legacy", text: String(settingsMap.get("top_marquee_text")), badge: null });
      }
      for (const p of promotions) {
        const badge =
          p.rule_type === "FIRST_N_CUSTOMERS" && p.max_claims != null
            ? `${Math.max(0, p.max_claims - (p.claimed_count || 0))} spots left`
            : p.rule_type === "PERCENT_OFF"
            ? `${p.discount_percent || 20}% OFF`
            : "Limited Time";
        marqueeItemsOut.push({ id: `promo_${p.id}`, text: p.title, badge });
      }
    }

    return NextResponse.json(
      {
        bundles,
        promotions,
        bundle_banners: bundleBanners,
        marquee_items: marqueeItemsOut,
        marquee_text: settingsMap.get("top_marquee_text") ?? "",
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
