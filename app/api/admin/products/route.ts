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
        return {
          id: String(p.id),
          variantId: firstVariant ? String(firstVariant.id) : "",
          title: String(p.title || ""),
          price: Number(firstVariant?.price || 0),
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
