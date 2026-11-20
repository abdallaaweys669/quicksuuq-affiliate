import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "quicksuuq-test.myshopify.com";
const ACCESS_TOKEN =
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "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";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const res = await fetch(
      `https://${SHOP_DOMAIN}/admin/api/2025-01/products.json?limit=250&status=active`,
      {
        headers: { "X-Shopify-Access-Token": ACCESS_TOKEN },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch Shopify products" }, { status: 502 });
    }

    const data = await res.json();
    const rawProducts = Array.isArray(data.products) ? data.products : [];

    const products = rawProducts
      .filter((p: any) => String(p.product_type || "").toLowerCase() !== "bundle")
      .map((p: any) => {
        const firstVariant = Array.isArray(p.variants) ? p.variants[0] : null;
        const title = String(p.title || "");
        const haystack = `${title} ${p.product_type || ""} ${p.tags || ""}`.toLowerCase();
        const weightUnit = String(firstVariant?.weight_unit || "").toLowerCase();
        const grams = Number(firstVariant?.grams || 0);
        const isLiquid =
          /\b(\d+\s*l|ltr|liter|litre|oil|saliid|milk|caano|juice|cabitan|water|cooking cream|vemto)\b/i.test(
            haystack
          );
        const isKgItem =
          weightUnit === "kg" ||
          grams >= 1000 ||
          /\b(kg|kilo|yaanyo|tomato|basal|onion|baradho|potato|kaarooto|carrot|barbarooni|bell pepper|qajaar|cucumber|baadinjaan|eggplant|baamiye|okra|batati|kabsar|parsley|toon|garlic|basbaas|chili|liin|lemon|moos|banana|sanjabil|ginger|avokaado|avocado|tufax|apple|zeytun|guava|canbe|mango|timir|dates|raqay|tamarind|rice|baris|basmati|sella|flour|sugar|oats|vegetable|qudaar|meat|hilib|black pepper|cloves)\b/i.test(
            haystack
          );
        const unit = isLiquid ? "liter" : isKgItem ? "kg" : "pcs";
        return {
          id: String(p.id),
          variantId: firstVariant ? String(firstVariant.id) : "",
          title,
          price: Number(firstVariant?.price || 0),
          unit,
          image: p.image?.src || (Array.isArray(p.images) && p.images[0]?.src) || null,
        };
      })
      .filter((p: any) => !q || p.title.toLowerCase().includes(q));

    return NextResponse.json({ products });
  } catch (err) {
    console.error("GET /api/admin/products failed:", err);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
