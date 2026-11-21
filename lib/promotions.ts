import { query } from "@/lib/db";

export interface BundleItem {
  title: string;
  qty: number;
  unitPrice: number;
  unit?: "kg" | "pcs" | "liter";
  image?: string | null;
}

export interface BundleRecord {
  id: string;
  title: string;
  description: string;
  slug: string;
  poster_url: string | null;
  items: BundleItem[];
  regular_price: number;
  bundle_price: number;
  promo_price: number | null;
  promo_ends_at: string | null;
  stock: number;
  sold_count: number;
  commission_type: "DEFAULT" | "PERCENT" | "FIXED";
  commission_value: number;
  is_active: boolean;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BannerElementConfig {
  id: "title" | "subtitle" | "price" | "button";
  text: string;
  x: number; // percentage 0-90
  y: number; // percentage 0-90
  fontSize: number;
  fontWeight: "400" | "600" | "700" | "800";
  fontFamily: "sans" | "serif" | "mono";
  color: string;
  bgColor?: string;
  visible: boolean;
}

export interface BundleBannerRecord {
  id: string;
  bundle_id: string;
  link_url?: string | null;
  bg_image: string | null;
  bg_color: string;
  elements: BannerElementConfig[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface PromotionRecord {
  id: string;
  title: string;
  rule_type: "FIRST_N_CUSTOMERS" | "MIN_ORDER_AMOUNT" | "PERCENT_OFF";
  max_claims: number | null;
  claimed_count: number;
  min_order_usd: number | null;
  discount_percent: number | null;
  reward_type: "FREE_DELIVERY" | "PERCENT_OFF";
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "quicksuuq-test.myshopify.com";
const ACCESS_TOKEN =
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "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";

let promotionsReady = false;
let promotionsInitPromise: Promise<void> | null = null;

export function slugifyBundle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `bundle-${Date.now()}`
  );
}

function formatItemLabel(it: BundleItem): string {
  const qty = Number(it.qty || 1);
  const unit = it.unit === "kg" ? `${qty} kg` : it.unit === "liter" ? `${qty} L` : qty === 1 ? "1 pc" : `${qty} pcs`;
  return `${it.title} (${unit})`;
}

const REAL_TEST_SETS: Array<{
  id: string;
  title: string;
  description: string;
  slug: string;
  poster_url: string | null;
  regular_price: number;
  bundle_price: number;
  stock: number;
  shopify_variant_id: string;
  items: BundleItem[];
}> = [
  {
    id: "bnd_xirmada_set_a",
    title: "Xirmada Qudaarta - Set A",
    description: "Ku filan 1-2 qof · 1 isbuuc · ~10 kg fresh vegetables",
    slug: "xirmada-qudaarta-set-a",
    poster_url: null,
    regular_price: 12.03,
    bundle_price: 10.5,
    stock: 40,
    shopify_variant_id: "68430586184046",
    items: [
      { title: "Yaanyo Tomato", qty: 1, unitPrice: 1.0, unit: "kg" },
      { title: "Basal Cadey - Onion", qty: 1, unitPrice: 1.25, unit: "kg" },
      { title: "Basal Gaduud", qty: 1, unitPrice: 1.0, unit: "kg" },
      { title: "Baradho-Potato", qty: 1, unitPrice: 1.35, unit: "kg" },
      { title: "kaarooto - Carrot", qty: 1, unitPrice: 0.9, unit: "kg" },
      { title: "Barbarooni - Bell pepper", qty: 1, unitPrice: 0.83, unit: "kg" },
      { title: "Qajaar Cucumber", qty: 1, unitPrice: 0.9, unit: "kg" },
      { title: "Kabsar-Parsley", qty: 1, unitPrice: 1.75, unit: "kg" },
      { title: "Toon Garlic", qty: 1, unitPrice: 2.4, unit: "kg" },
      { title: "Liin dhanaan-Lemon", qty: 1, unitPrice: 0.65, unit: "kg" },
    ],
  },
  {
    id: "bnd_xirmada_set_b",
    title: "Xirmada Qudaarta - Set B",
    description: "Ku filan 3-4 qof · 1 isbuuc · ~20 kg family pack",
    slug: "xirmada-qudaarta-set-b",
    poster_url: null,
    regular_price: 24.31,
    bundle_price: 21.0,
    stock: 30,
    shopify_variant_id: "68430586216814",
    items: [
      { title: "Yaanyo Tomato", qty: 2, unitPrice: 1.0, unit: "kg" },
      { title: "Basal Cadey - Onion", qty: 2, unitPrice: 1.25, unit: "kg" },
      { title: "Baradho-Potato", qty: 2, unitPrice: 1.35, unit: "kg" },
      { title: "kaarooto - Carrot", qty: 2, unitPrice: 0.9, unit: "kg" },
      { title: "Barbarooni - Bell pepper", qty: 2, unitPrice: 0.83, unit: "kg" },
      { title: "Qajaar Cucumber", qty: 1, unitPrice: 0.9, unit: "kg" },
      { title: "Basal Gaduud", qty: 1, unitPrice: 1.0, unit: "kg" },
      { title: "Baadinjaan (Eggplant)", qty: 1, unitPrice: 1.65, unit: "kg" },
      { title: "Batati Macaan-Sweet potato", qty: 1, unitPrice: 0.9, unit: "kg" },
      { title: "Bocor - Pumpkin", qty: 1, unitPrice: 1.0, unit: "pcs" },
      { title: "Kabsar-Parsley", qty: 1, unitPrice: 1.75, unit: "kg" },
      { title: "Toon Garlic", qty: 1, unitPrice: 2.4, unit: "kg" },
      { title: "Basbaas- Hot or chili pepper", qty: 1, unitPrice: 2.4, unit: "kg" },
      { title: "Liin dhanaan-Lemon", qty: 1, unitPrice: 0.65, unit: "kg" },
      { title: "moos", qty: 1, unitPrice: 1.0, unit: "kg" },
    ],
  },
  {
    id: "bnd_xirmada_set_c",
    title: "Xirmada Qudaarta - Set C",
    description: "Ku filan 5-8 qof · 1 isbuuc · ~30 kg large family pack",
    slug: "xirmada-qudaarta-set-c",
    poster_url: null,
    regular_price: 36.46,
    bundle_price: 31.5,
    stock: 20,
    shopify_variant_id: "68430586446190",
    items: [
      { title: "Yaanyo Tomato", qty: 3, unitPrice: 1.0, unit: "kg" },
      { title: "Basal Cadey - Onion", qty: 3, unitPrice: 1.25, unit: "kg" },
      { title: "Baradho-Potato", qty: 3, unitPrice: 1.35, unit: "kg" },
      { title: "kaarooto - Carrot", qty: 2, unitPrice: 0.9, unit: "kg" },
      { title: "Barbarooni - Bell pepper", qty: 2, unitPrice: 0.83, unit: "kg" },
      { title: "Qajaar Cucumber", qty: 2, unitPrice: 0.9, unit: "kg" },
      { title: "Basal Gaduud", qty: 2, unitPrice: 1.0, unit: "kg" },
      { title: "Baadinjaan (Eggplant)", qty: 2, unitPrice: 1.65, unit: "kg" },
      { title: "Baamiye - Okra", qty: 1, unitPrice: 2.5, unit: "kg" },
      { title: "Batati Macaan-Sweet potato", qty: 2, unitPrice: 0.9, unit: "kg" },
      { title: "Bocor - Pumpkin", qty: 1, unitPrice: 1.0, unit: "pcs" },
      { title: "Kabsar-Parsley", qty: 1, unitPrice: 1.75, unit: "kg" },
      { title: "Toon Garlic", qty: 1, unitPrice: 2.4, unit: "kg" },
      { title: "moos", qty: 2, unitPrice: 1.0, unit: "kg" },
      { title: "Basbaas- Hot or chili pepper", qty: 1, unitPrice: 2.4, unit: "kg" },
      { title: "Liin dhanaan-Lemon", qty: 1, unitPrice: 0.65, unit: "kg" },
      { title: "Babaay - Papaya", qty: 1, unitPrice: 0.6, unit: "pcs" },
    ],
  },
];

export async function ensurePromotionsTables(): Promise<void> {
  if (promotionsReady) return;
  if (!promotionsInitPromise) {
    promotionsInitPromise = initPromotionsTables().finally(() => {
      promotionsInitPromise = null;
    });
  }
  return promotionsInitPromise;
}

async function initPromotionsTables(): Promise<void> {
  if (promotionsReady) return;

  // Fast path: if all tables & columns already exist, skip concurrent DDL across serverless instances
  const existsRes = await query<{ b: boolean; p: boolean; bb: boolean; ss: boolean; lu: boolean }>(
    `SELECT
       to_regclass('public.bundles') IS NOT NULL AS b,
       to_regclass('public.promotions') IS NOT NULL AS p,
       to_regclass('public.bundle_banners') IS NOT NULL AS bb,
       to_regclass('public.site_settings') IS NOT NULL AS ss,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'bundle_banners' AND column_name = 'link_url'
       ) AS lu`
  );
  const exists = existsRes.rows[0];
  if (exists?.b && exists?.p && exists?.bb && exists?.ss && exists?.lu) {
    promotionsReady = true;
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS public.bundles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      poster_url TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      regular_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      bundle_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      promo_price NUMERIC(10,2),
      promo_ends_at TIMESTAMPTZ,
      stock INTEGER NOT NULL DEFAULT 0,
      sold_count INTEGER NOT NULL DEFAULT 0,
      commission_type TEXT NOT NULL DEFAULT 'DEFAULT',
      commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      shopify_product_id TEXT,
      shopify_variant_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10,2)`);
  await query(`ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ`);
  await query(`ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT`);

  await query(`
    CREATE TABLE IF NOT EXISTS public.promotions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      max_claims INTEGER,
      claimed_count INTEGER NOT NULL DEFAULT 0,
      min_order_usd NUMERIC(10,2),
      discount_percent NUMERIC(5,2),
      reward_type TEXT NOT NULL DEFAULT 'FREE_DELIVERY',
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2)`);
  await query(`ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_rule_type_check`).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS public.bundle_banners (
      id TEXT PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      link_url TEXT,
      bg_image TEXT,
      bg_color TEXT NOT NULL DEFAULT '#0e8a60',
      elements_json TEXT NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`ALTER TABLE public.bundle_banners ADD COLUMN IF NOT EXISTS link_url TEXT`);

  await query(`
    CREATE TABLE IF NOT EXISTS public.site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const bundleCount = await query<{ n: number }>("SELECT count(*)::int AS n FROM public.bundles");
  const legacyVariantCheck = await query<{ id: string; shopify_variant_id: string | null }>(
    `SELECT id, shopify_variant_id FROM public.bundles WHERE id IN ('bnd_xirmada_set_a', 'bnd_xirmada_set_b', 'bnd_xirmada_set_c')`
  );
  const needsRealSync = legacyVariantCheck.rows.some((r) => !r.shopify_variant_id);

  if (!bundleCount.rows[0]?.n || needsRealSync) {
    for (const s of REAL_TEST_SETS) {
      await query(
        `INSERT INTO public.bundles (id, title, description, slug, poster_url, items_json, regular_price, bundle_price, stock, sold_count, commission_type, commission_value, is_active, shopify_variant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'DEFAULT', 0, TRUE, $10)
         ON CONFLICT (id) DO UPDATE SET
           shopify_variant_id = COALESCE(public.bundles.shopify_variant_id, EXCLUDED.shopify_variant_id),
           sold_count = 0,
           updated_at = NOW()`,
        [
          s.id,
          s.title,
          s.description,
          s.slug,
          s.poster_url,
          JSON.stringify(s.items),
          s.regular_price,
          s.bundle_price,
          s.stock,
          s.shopify_variant_id,
        ]
      );
    }
    // Also reset fake starter claimed_count to 0
    await query(
      `UPDATE public.promotions SET claimed_count = 0 WHERE id = 'prm_first_20_free_delivery' AND claimed_count = 6`
    );
  }

  const promoCount = await query<{ n: number }>("SELECT count(*)::int AS n FROM public.promotions");
  if (!promoCount.rows[0]?.n) {
    const endsAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    await query(
      `INSERT INTO public.promotions (id, title, rule_type, max_claims, claimed_count, min_order_usd, discount_percent, reward_type, starts_at, ends_at, is_active)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7, NOW(), $8, TRUE)`,
      [
        "prm_first_20_free_delivery",
        "First 20 Customers Free Delivery",
        "FIRST_N_CUSTOMERS",
        20,
        null,
        null,
        "FREE_DELIVERY",
        endsAt,
      ]
    );
  }

  const bannerCount = await query<{ n: number }>("SELECT count(*)::int AS n FROM public.bundle_banners");
  if (!bannerCount.rows[0]?.n) {
    const defaultElements: BannerElementConfig[] = [
      {
        id: "title",
        text: "Xirmada Qudaarta - Set A",
        x: 6,
        y: 16,
        fontSize: 28,
        fontWeight: "800",
        fontFamily: "sans",
        color: "#ffffff",
        visible: true,
      },
      {
        id: "subtitle",
        text: "Fresh weekly family pack · Save when you buy together",
        x: 6,
        y: 38,
        fontSize: 15,
        fontWeight: "400",
        fontFamily: "sans",
        color: "#ecfdf5",
        visible: true,
      },
      {
        id: "price",
        text: "",
        x: 6,
        y: 55,
        fontSize: 22,
        fontWeight: "800",
        fontFamily: "sans",
        color: "#ffffff",
        visible: true,
      },
      {
        id: "button",
        text: "Buy Now",
        x: 6,
        y: 74,
        fontSize: 14,
        fontWeight: "700",
        fontFamily: "sans",
        color: "#111827",
        bgColor: "#ffffff",
        visible: true,
      },
    ];
    await query(
      `INSERT INTO public.bundle_banners (id, bundle_id, bg_image, bg_color, elements_json, is_active, sort_order)
       VALUES ($1, $2, NULL, '#0e8a60', $3, TRUE, 0)`,
      ["bnr_starter_set_a", "bnd_xirmada_set_a", JSON.stringify(defaultElements)]
    );
  }

  promotionsReady = true;
}

export async function syncBundleToShopify(bundle: BundleRecord): Promise<{
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
}> {
  if (!ACCESS_TOKEN) {
    return { shopify_product_id: bundle.shopify_product_id, shopify_variant_id: bundle.shopify_variant_id };
  }

  const hasFlash =
    bundle.promo_price != null &&
    bundle.promo_price > 0 &&
    (!bundle.promo_ends_at || new Date(bundle.promo_ends_at).getTime() > Date.now());
  const effectivePrice = (hasFlash && bundle.promo_price ? bundle.promo_price : bundle.bundle_price).toFixed(2);
  const compareAt =
    bundle.regular_price > Number(effectivePrice) ? bundle.regular_price.toFixed(2) : null;

  const itemsSummary = bundle.items.map(formatItemLabel).join(", ");
  const bodyHtml = `<p>${bundle.description || "QuickSuuq Bundle"}</p>${itemsSummary ? `<p><strong>Includes:</strong> ${itemsSummary}</p>` : ""}`;
  const validHttpsPoster =
    bundle.poster_url && bundle.poster_url.startsWith("https://") ? bundle.poster_url : null;

  try {
    // If variant already exists, update variant price & product title/status/description
    if (bundle.shopify_variant_id) {
      await fetch(`https://${SHOP_DOMAIN}/admin/api/2025-01/variants/${bundle.shopify_variant_id}.json`, {
        method: "PUT",
        headers: { "X-Shopify-Access-Token": ACCESS_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
          variant: {
            id: Number(bundle.shopify_variant_id),
            price: effectivePrice,
            compare_at_price: compareAt,
          },
        }),
      });

      if (bundle.shopify_product_id) {
        await fetch(`https://${SHOP_DOMAIN}/admin/api/2025-01/products/${bundle.shopify_product_id}.json`, {
          method: "PUT",
          headers: { "X-Shopify-Access-Token": ACCESS_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({
            product: {
              id: Number(bundle.shopify_product_id),
              title: bundle.title,
              body_html: bodyHtml,
              status: bundle.is_active && bundle.stock > 0 ? "active" : "draft",
            },
          }),
        });
      }

      return {
        shopify_product_id: bundle.shopify_product_id,
        shopify_variant_id: bundle.shopify_variant_id,
      };
    }

    // Create new Shopify product for this bundle
    const createRes = await fetch(`https://${SHOP_DOMAIN}/admin/api/2025-01/products.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": ACCESS_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        product: {
          title: bundle.title,
          handle: bundle.slug,
          body_html: bodyHtml,
          vendor: "QuickSuuq",
          product_type: "Bundle",
          tags: "bundle, xirmo",
          status: bundle.is_active && bundle.stock > 0 ? "active" : "draft",
          variants: [
            {
              price: effectivePrice,
              compare_at_price: compareAt,
              inventory_management: null,
            },
          ],
          ...(validHttpsPoster ? { images: [{ src: validHttpsPoster }] } : {}),
        },
      }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      const prodId = created?.product?.id ? String(created.product.id) : null;
      const varId = created?.product?.variants?.[0]?.id ? String(created.product.variants[0].id) : null;
      if (prodId || varId) {
        await query(
          `UPDATE public.bundles SET shopify_product_id = $2, shopify_variant_id = $3 WHERE id = $1`,
          [bundle.id, prodId, varId]
        );
      }
      return { shopify_product_id: prodId, shopify_variant_id: varId };
    }
  } catch (err) {
    console.error("syncBundleToShopify error:", err);
  }

  return { shopify_product_id: bundle.shopify_product_id, shopify_variant_id: bundle.shopify_variant_id };
}

export async function checkActiveFreeDelivery(orderSubtotalUsd: number): Promise<{
  freeDelivery: boolean;
  promoId: string | null;
  promoTitle: string | null;
}> {
  await ensurePromotionsTables();
  const res = await query(
    `SELECT * FROM public.promotions
     WHERE is_active = TRUE
       AND reward_type = 'FREE_DELIVERY'
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY created_at DESC`
  );

  for (const row of res.rows) {
    const p = mapPromotionRow(row);
    if (p.rule_type === "FIRST_N_CUSTOMERS") {
      if (p.max_claims == null || p.claimed_count < p.max_claims) {
        return { freeDelivery: true, promoId: p.id, promoTitle: p.title };
      }
    } else if (p.rule_type === "MIN_ORDER_AMOUNT") {
      if (orderSubtotalUsd >= Number(p.min_order_usd || 0)) {
        return { freeDelivery: true, promoId: p.id, promoTitle: p.title };
      }
    }
  }
  return { freeDelivery: false, promoId: null, promoTitle: null };
}

export async function recordBundleAndPromoSales(params: {
  lineItems: Array<{ variant_id?: unknown; product_id?: unknown; title?: unknown; quantity?: unknown }>;
  orderSubtotalUsd: number;
}): Promise<void> {
  try {
    await ensurePromotionsTables();

    for (const item of params.lineItems || []) {
      const qty = Math.max(1, Number(item.quantity || 1));
      const vid = item.variant_id ? String(item.variant_id) : "";
      const pid = item.product_id ? String(item.product_id) : "";
      const title = String(item.title || "").trim();

      const match = await query<{ id: string }>(
        `SELECT id FROM public.bundles
         WHERE ($1 <> '' AND shopify_variant_id = $1)
            OR ($2 <> '' AND shopify_product_id = $2)
            OR ($3 <> '' AND LOWER(title) = LOWER($3))
         LIMIT 1`,
        [vid, pid, title]
      );

      if (match.rows[0]?.id) {
        await query(
          `UPDATE public.bundles
           SET sold_count = sold_count + $2,
               stock = GREATEST(0, stock - $2),
               updated_at = NOW()
           WHERE id = $1`,
          [match.rows[0].id, qty]
        );
      }
    }

    // Claim 1 spot if a FIRST_N_CUSTOMERS promo is active
    const promo = await checkActiveFreeDelivery(params.orderSubtotalUsd);
    if (promo.freeDelivery && promo.promoId) {
      await query(
        `UPDATE public.promotions
         SET claimed_count = claimed_count + 1
         WHERE id = $1 AND rule_type = 'FIRST_N_CUSTOMERS' AND (max_claims IS NULL OR claimed_count < max_claims)`,
        [promo.promoId]
      );
    }
  } catch (err) {
    console.error("recordBundleAndPromoSales error:", err);
  }
}

export function mapBundleRow(row: Record<string, unknown>): BundleRecord {
  let items: BundleItem[] = [];
  try {
    const parsed = JSON.parse(String(row.items_json || "[]"));
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    items = [];
  }
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description || ""),
    slug: String(row.slug),
    poster_url: row.poster_url ? String(row.poster_url) : null,
    items,
    regular_price: Number(row.regular_price || 0),
    bundle_price: Number(row.bundle_price || 0),
    promo_price: row.promo_price != null ? Number(row.promo_price) : null,
    promo_ends_at: row.promo_ends_at ? String(row.promo_ends_at) : null,
    stock: Number(row.stock || 0),
    sold_count: Number(row.sold_count || 0),
    commission_type: String(row.commission_type || "DEFAULT") as BundleRecord["commission_type"],
    commission_value: Number(row.commission_value || 0),
    is_active: Boolean(row.is_active),
    shopify_product_id: row.shopify_product_id ? String(row.shopify_product_id) : null,
    shopify_variant_id: row.shopify_variant_id ? String(row.shopify_variant_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function mapBannerRow(row: Record<string, unknown>): BundleBannerRecord {
  let elements: BannerElementConfig[] = [];
  try {
    const parsed = JSON.parse(String(row.elements_json || "[]"));
    if (Array.isArray(parsed)) elements = parsed;
  } catch {
    elements = [];
  }
  return {
    id: String(row.id),
    bundle_id: String(row.bundle_id),
    link_url: row.link_url ? String(row.link_url) : null,
    bg_image: row.bg_image ? String(row.bg_image) : null,
    bg_color: String(row.bg_color || "#0e8a60"),
    elements,
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order || 0),
    created_at: String(row.created_at),
  };
}

export function mapPromotionRow(row: Record<string, unknown>): PromotionRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    rule_type: String(row.rule_type) as PromotionRecord["rule_type"],
    max_claims: row.max_claims != null ? Number(row.max_claims) : null,
    claimed_count: Number(row.claimed_count || 0),
    min_order_usd: row.min_order_usd != null ? Number(row.min_order_usd) : null,
    discount_percent: row.discount_percent != null ? Number(row.discount_percent) : null,
    reward_type: row.reward_type === "PERCENT_OFF" ? "PERCENT_OFF" : "FREE_DELIVERY",
    starts_at: row.starts_at ? String(row.starts_at) : null,
    ends_at: row.ends_at ? String(row.ends_at) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}
