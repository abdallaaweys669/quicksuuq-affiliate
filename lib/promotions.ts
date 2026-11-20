import { query } from "@/lib/db";

export interface BundleItem {
  title: string;
  qty: number;
  unitPrice: number;
  unit?: "kg" | "pcs";
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
  created_at: string;
  updated_at: string;
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

let promotionsReady = false;

export function slugifyBundle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `bundle-${Date.now()}`
  );
}

const REAL_TEST_SETS: Array<{
  id: string;
  title: string;
  description: string;
  slug: string;
  poster_url: string;
  regular_price: number;
  bundle_price: number;
  stock: number;
  sold_count: number;
  items: BundleItem[];
}> = [
  {
    id: "bnd_xirmada_set_a",
    title: "Xirmada Qudaarta - Set A",
    description: "Ku filan 1-2 qof · 1 isbuuc · ~10 kg fresh vegetables",
    slug: "xirmada-qudaarta-set-a",
    poster_url: "/bundles/set-a.jpg",
    regular_price: 12.03,
    bundle_price: 10.5,
    stock: 40,
    sold_count: 6,
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
    poster_url: "/bundles/set-b.jpg",
    regular_price: 24.31,
    bundle_price: 21.0,
    stock: 30,
    sold_count: 4,
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
    poster_url: "/bundles/set-c.jpg",
    regular_price: 36.46,
    bundle_price: 31.5,
    stock: 20,
    sold_count: 2,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10,2)`);
  await query(`ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ`);

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
  // Relax old check constraint if present so PERCENT_OFF is also allowed
  await query(`ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_rule_type_check`).catch(() => {});

  const bundleCount = await query<{ n: number }>("SELECT count(*)::int AS n FROM public.bundles");
  const legacyCheck = await query<{ id: string; description: string; items_json: string }>(
    `SELECT id, description, items_json FROM public.bundles WHERE id IN ('bnd_xirmada_set_a', 'bnd_xirmada_set_b', 'bnd_xirmada_set_c')`
  );
  const needsUnitOrDescBackfill = legacyCheck.rows.some((r) => !r.description || !r.items_json.includes('"unit"'));

  if (!bundleCount.rows[0]?.n || needsUnitOrDescBackfill) {
    for (const s of REAL_TEST_SETS) {
      await query(
        `INSERT INTO public.bundles (id, title, description, slug, poster_url, items_json, regular_price, bundle_price, stock, sold_count, commission_type, commission_value, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DEFAULT', 0, TRUE)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = CASE WHEN public.bundles.description = '' THEN EXCLUDED.description ELSE public.bundles.description END,
           items_json = EXCLUDED.items_json,
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
          s.sold_count,
        ]
      );
    }
  }

  const promoCount = await query<{ n: number }>("SELECT count(*)::int AS n FROM public.promotions");
  if (!promoCount.rows[0]?.n) {
    const endsAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    await query(
      `INSERT INTO public.promotions (id, title, rule_type, max_claims, claimed_count, min_order_usd, discount_percent, reward_type, starts_at, ends_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, TRUE)`,
      [
        "prm_first_20_free_delivery",
        "First 20 Customers Free Delivery",
        "FIRST_N_CUSTOMERS",
        20,
        6,
        null,
        null,
        "FREE_DELIVERY",
        endsAt,
      ]
    );
  }

  promotionsReady = true;
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
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
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
    reward_type: (row.reward_type === "PERCENT_OFF" ? "PERCENT_OFF" : "FREE_DELIVERY"),
    starts_at: row.starts_at ? String(row.starts_at) : null,
    ends_at: row.ends_at ? String(row.ends_at) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}
