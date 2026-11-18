import { query } from "@/lib/db";

export interface BundleItem {
  title: string;
  qty: number;
  unitPrice: number;
}

export interface BundleRecord {
  id: string;
  title: string;
  slug: string;
  poster_url: string | null;
  items: BundleItem[];
  regular_price: number;
  bundle_price: number;
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
  rule_type: "FIRST_N_CUSTOMERS" | "MIN_ORDER_AMOUNT";
  max_claims: number | null;
  claimed_count: number;
  min_order_usd: number | null;
  reward_type: "FREE_DELIVERY";
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

export async function ensurePromotionsTables(): Promise<void> {
  if (promotionsReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS public.bundles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      poster_url TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      regular_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      bundle_price NUMERIC(10,2) NOT NULL DEFAULT 0,
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

  await query(`
    CREATE TABLE IF NOT EXISTS public.promotions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      rule_type TEXT NOT NULL CHECK (rule_type IN ('FIRST_N_CUSTOMERS', 'MIN_ORDER_AMOUNT')),
      max_claims INTEGER,
      claimed_count INTEGER NOT NULL DEFAULT 0,
      min_order_usd NUMERIC(10,2),
      reward_type TEXT NOT NULL DEFAULT 'FREE_DELIVERY',
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Seed Set A, Set B, Set C when empty (or upgrade initial starter row)
  const bundleCount = await query<{ n: number }>("SELECT count(*)::int AS n FROM public.bundles");
  const hasStarterOnly =
    bundleCount.rows[0]?.n === 1 &&
    (await query("SELECT id FROM public.bundles WHERE id = 'bnd_starter_qado_qoys'")).rows.length === 1;

  if (!bundleCount.rows[0]?.n || hasStarterOnly) {
    if (hasStarterOnly) {
      await query("DELETE FROM public.bundles WHERE id = 'bnd_starter_qado_qoys'");
    }
    const sets = [
      {
        id: "bnd_xirmada_set_a",
        title: "Xirmada Qudaarta — Set A (1–2 qof · ~9 kg)",
        slug: "xirmada-qudaarta-set-a",
        poster_url: "/bundles/set-a.jpg",
        regular_price: 13.5,
        bundle_price: 11.5,
        stock: 40,
        sold_count: 6,
        commission_type: "FIXED",
        commission_value: 1.0,
        items: [
          { title: "Yaanyo · 1 kg", qty: 1, unitPrice: 1.5 },
          { title: "Basal Cadey · 1 kg", qty: 1, unitPrice: 1.3 },
          { title: "Basal Gaduud · 1 kg", qty: 1, unitPrice: 1.4 },
          { title: "Baradho · 1 kg", qty: 1, unitPrice: 1.3 },
          { title: "Kaarooto · 1 kg", qty: 1, unitPrice: 1.4 },
          { title: "Barbarooni · 1 kg", qty: 1, unitPrice: 1.5 },
          { title: "Qajaar · 1 kg", qty: 1, unitPrice: 1.2 },
          { title: "Kabsar · 500 g", qty: 1, unitPrice: 0.9 },
          { title: "Toon · 500 g", qty: 1, unitPrice: 1.5 },
          { title: "Liin Dhanaan · 1 kg", qty: 1, unitPrice: 1.5 },
        ],
      },
      {
        id: "bnd_xirmada_set_b",
        title: "Xirmada Qudaarta — Set B (3–4 qof · ~19 kg)",
        slug: "xirmada-qudaarta-set-b",
        poster_url: "/bundles/set-b.jpg",
        regular_price: 26.5,
        bundle_price: 22.5,
        stock: 30,
        sold_count: 4,
        commission_type: "FIXED",
        commission_value: 2.0,
        items: [
          { title: "Yaanyo · 2 kg", qty: 1, unitPrice: 3.0 },
          { title: "Basal Cadey · 2 kg", qty: 1, unitPrice: 2.6 },
          { title: "Baradho · 2 kg", qty: 1, unitPrice: 2.6 },
          { title: "Kaarooto · 2 kg", qty: 1, unitPrice: 2.8 },
          { title: "Barbarooni · 2 kg", qty: 1, unitPrice: 3.0 },
          { title: "Qajaar · 1 kg", qty: 1, unitPrice: 1.2 },
          { title: "Basal Gaduud · 1 kg", qty: 1, unitPrice: 1.4 },
          { title: "Baadinjaan · 1 kg", qty: 1, unitPrice: 1.5 },
          { title: "Batati Macaan · 1 kg", qty: 1, unitPrice: 1.4 },
          { title: "Bocor · 1 xabbo", qty: 1, unitPrice: 1.5 },
          { title: "Kabsar · 500 g + Toon · 500 g", qty: 1, unitPrice: 2.4 },
          { title: "Basbaas 500g + Liin 1kg + Moos 6 xabbo", qty: 1, unitPrice: 3.1 },
        ],
      },
      {
        id: "bnd_xirmada_set_c",
        title: "Xirmada Qudaarta — Set C (5–8 qof · ~28.5 kg)",
        slug: "xirmada-qudaarta-set-c",
        poster_url: "/bundles/set-c.jpg",
        regular_price: 39.5,
        bundle_price: 34.0,
        stock: 20,
        sold_count: 2,
        commission_type: "FIXED",
        commission_value: 3.0,
        items: [
          { title: "Yaanyo · 3 kg + Basal Cadey · 3 kg + Baradho · 3 kg", qty: 1, unitPrice: 12.3 },
          { title: "Kaarooto · 2 kg + Barbarooni · 2 kg + Qajaar · 2 kg", qty: 1, unitPrice: 8.2 },
          { title: "Basal Gaduud · 2 kg + Baadinjaan · 2 kg + Baamiye · 1 kg", qty: 1, unitPrice: 7.4 },
          { title: "Batati Macaan · 2 kg + Bocor · 1 xabbo + Kabsar · 1 kg", qty: 1, unitPrice: 5.8 },
          { title: "Toon 500g + Moos 6 xabbo + Basbaas + Liin + Babaay", qty: 1, unitPrice: 5.8 },
        ],
      },
    ];

    for (const s of sets) {
      await query(
        `INSERT INTO public.bundles (id, title, slug, poster_url, items_json, regular_price, bundle_price, stock, sold_count, commission_type, commission_value, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id,
          s.title,
          s.slug,
          s.poster_url,
          JSON.stringify(s.items),
          s.regular_price,
          s.bundle_price,
          s.stock,
          s.sold_count,
          s.commission_type,
          s.commission_value,
        ]
      );
    }
  }

  const promoCount = await query<{ n: number }>("SELECT count(*)::int AS n FROM public.promotions");
  if (!promoCount.rows[0]?.n) {
    const endsAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    await query(
      `INSERT INTO public.promotions (id, title, rule_type, max_claims, claimed_count, min_order_usd, reward_type, starts_at, ends_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, TRUE)`,
      [
        "prm_first_20_free_delivery",
        "First 20 Customers Free Delivery",
        "FIRST_N_CUSTOMERS",
        20,
        6,
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
    slug: String(row.slug),
    poster_url: row.poster_url ? String(row.poster_url) : null,
    items,
    regular_price: Number(row.regular_price || 0),
    bundle_price: Number(row.bundle_price || 0),
    stock: Number(row.stock || 0),
    sold_count: Number(row.sold_count || 0),
    commission_type: (String(row.commission_type || "DEFAULT") as BundleRecord["commission_type"]),
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
    reward_type: "FREE_DELIVERY",
    starts_at: row.starts_at ? String(row.starts_at) : null,
    ends_at: row.ends_at ? String(row.ends_at) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}
