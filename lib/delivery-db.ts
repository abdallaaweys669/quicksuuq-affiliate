import { query } from "@/lib/db";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN || "quicksuuq-test.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";

export interface DeliveryAreaRow {
  id: number;
  name: string;
  category: string;
  fee_usd: number;
  is_active: boolean;
  sort_order: number;
}

export interface DeliveryVehicleRow {
  id: number;
  name: string;
  min_weight_kg: number;
  max_weight_kg: number;
  is_active: boolean;
}

export interface DeliveryDriverRow {
  id: number;
  name: string;
  phone: string;
  vehicle_type: string;
  plate_number: string;
  status: string;
  is_active: boolean;
}

export interface DeliverySettings {
  heavy_weight_threshold_kg: number;
  heavy_surcharge_usd: number;
}

let initialized = false;

const INITIAL_AREAS = [
  // Category A ($1.50)
  { name: "Howlwadaag", category: "A", fee_usd: 1.50, sort_order: 1 },
  { name: "Warta Nabadda", category: "A", fee_usd: 1.50, sort_order: 2 },
  { name: "Hodan", category: "A", fee_usd: 1.50, sort_order: 3 },
  { name: "Boondheere", category: "A", fee_usd: 1.50, sort_order: 4 },
  // Category B ($2.00)
  { name: "Waaberi", category: "B", fee_usd: 2.00, sort_order: 5 },
  { name: "Xamar Weyne", category: "B", fee_usd: 2.00, sort_order: 6 },
  { name: "Xamar Jajab", category: "B", fee_usd: 2.00, sort_order: 7 },
  { name: "Shibis", category: "B", fee_usd: 2.00, sort_order: 8 },
  { name: "Shangaani", category: "B", fee_usd: 2.00, sort_order: 9 },
  // Category C ($3.00)
  { name: "Yaaqshiid", category: "C", fee_usd: 3.00, sort_order: 10 },
  { name: "Kaaraan", category: "C", fee_usd: 3.00, sort_order: 11 },
  { name: "Huriwaa", category: "C", fee_usd: 3.00, sort_order: 12 },
  { name: "Dayniile", category: "C", fee_usd: 3.00, sort_order: 13 },
  { name: "Wadajir", category: "C", fee_usd: 3.00, sort_order: 14 },
  { name: "Dharkenley", category: "C", fee_usd: 3.00, sort_order: 15 },
  { name: "Cabdicasiis", category: "C", fee_usd: 3.00, sort_order: 16 },
  // Category D ($3.50)
  { name: "Kaxda", category: "D", fee_usd: 3.50, sort_order: 17 },
  { name: "Daarusalaam", category: "D", fee_usd: 3.50, sort_order: 18 },
  { name: "Gubadley", category: "D", fee_usd: 3.50, sort_order: 19 },
  { name: "Garasbaaley", category: "D", fee_usd: 3.50, sort_order: 20 },
];

const INITIAL_VEHICLES = [
  { name: "Fekon (Motorbike)", min_weight_kg: 0, max_weight_kg: 20 },
  { name: "Bajaj", min_weight_kg: 20.01, max_weight_kg: 300 },
  { name: "Fekon Cargo", min_weight_kg: 300.01, max_weight_kg: 800 },
];

const INITIAL_DRIVERS = [
  { name: "Ahmed Warsame", phone: "+252615001122", vehicle_type: "Fekon (Motorbike)", plate_number: "FKN-01", status: "Available" },
  { name: "Abdi Hassan", phone: "+252615001133", vehicle_type: "Fekon (Motorbike)", plate_number: "FKN-02", status: "Available" },
  { name: "Hassan Ali", phone: "+252615003344", vehicle_type: "Bajaj", plate_number: "BJJ-01", status: "Available" },
  { name: "Omar Farah", phone: "+252615003355", vehicle_type: "Bajaj", plate_number: "BJJ-02", status: "Available" },
  { name: "Mohamed Farah", phone: "+252615005566", vehicle_type: "Fekon Cargo", plate_number: "CRG-01", status: "Available" },
];

export async function ensureDeliveryTables() {
  if (initialized) return;

  await query(`
    CREATE TABLE IF NOT EXISTS delivery_areas (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) UNIQUE NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'A',
      fee_usd NUMERIC(10, 2) NOT NULL DEFAULT 1.50,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS delivery_vehicles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) UNIQUE NOT NULL,
      min_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
      max_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 20,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS delivery_drivers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      vehicle_type VARCHAR(120) NOT NULL,
      plate_number VARCHAR(40) DEFAULT '',
      status VARCHAR(40) NOT NULL DEFAULT 'Available',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS delivery_settings (
      key VARCHAR(80) PRIMARY KEY,
      value VARCHAR(255) NOT NULL
    );
  `);

  // Seed initial areas if empty
  const areaCount = await query<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM delivery_areas");
  if ((areaCount.rows[0]?.cnt || 0) === 0) {
    for (const a of INITIAL_AREAS) {
      await query(
        `INSERT INTO delivery_areas (name, category, fee_usd, is_active, sort_order)
         VALUES ($1, $2, $3, true, $4)
         ON CONFLICT (name) DO NOTHING`,
        [a.name, a.category, a.fee_usd, a.sort_order]
      );
    }
  }

  // Seed initial vehicles if empty
  const vehicleCount = await query<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM delivery_vehicles");
  if ((vehicleCount.rows[0]?.cnt || 0) === 0) {
    for (const v of INITIAL_VEHICLES) {
      await query(
        `INSERT INTO delivery_vehicles (name, min_weight_kg, max_weight_kg, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO NOTHING`,
        [v.name, v.min_weight_kg, v.max_weight_kg]
      );
    }
  }

  // Seed initial drivers if empty
  const driverCount = await query<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM delivery_drivers");
  if ((driverCount.rows[0]?.cnt || 0) === 0) {
    for (const d of INITIAL_DRIVERS) {
      await query(
        `INSERT INTO delivery_drivers (name, phone, vehicle_type, plate_number, status, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [d.name, d.phone, d.vehicle_type, d.plate_number, d.status]
      );
    }
  }

  // Seed settings
  await query(
    `INSERT INTO delivery_settings (key, value) VALUES ('heavy_weight_threshold_kg', '100') ON CONFLICT (key) DO NOTHING`
  );
  await query(
    `INSERT INTO delivery_settings (key, value) VALUES ('heavy_surcharge_usd', '1.00') ON CONFLICT (key) DO NOTHING`
  );

  initialized = true;
}

export async function getDeliveryConfig() {
  await ensureDeliveryTables();

  const [areasRes, vehiclesRes, driversRes, settingsRes] = await Promise.all([
    query<DeliveryAreaRow>(
      `SELECT id, name, category, fee_usd::float AS fee_usd, is_active, sort_order
       FROM delivery_areas
       ORDER BY category ASC, sort_order ASC, name ASC`
    ),
    query<DeliveryVehicleRow>(
      `SELECT id, name, min_weight_kg::float AS min_weight_kg, max_weight_kg::float AS max_weight_kg, is_active
       FROM delivery_vehicles
       ORDER BY max_weight_kg ASC`
    ),
    query<DeliveryDriverRow>(
      `SELECT id, name, phone, vehicle_type, COALESCE(plate_number, '') AS plate_number, status, is_active
       FROM delivery_drivers
       ORDER BY id ASC`
    ),
    query<{ key: string; value: string }>(`SELECT key, value FROM delivery_settings`),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const row of settingsRes.rows) {
    settingsMap[row.key] = row.value;
  }

  const settings: DeliverySettings = {
    heavy_weight_threshold_kg: parseFloat(settingsMap.heavy_weight_threshold_kg || "100") || 100,
    heavy_surcharge_usd: parseFloat(settingsMap.heavy_surcharge_usd || "1.00") ?? 1.0,
  };

  return {
    areas: areasRes.rows,
    vehicles: vehiclesRes.rows,
    drivers: driversRes.rows,
    settings,
  };
}

/**
 * Syncs the active drivers in PostgreSQL directly to the Shopify Order Metafield
 * (`quicksuuq.assigned_driver`) choices list so Shopify Admin Orders dropdown stays 100% in sync!
 */
export async function syncDriversToShopifyMetafield() {
  if (!SHOPIFY_TOKEN) return;
  try {
    const driversRes = await query<DeliveryDriverRow>(
      `SELECT id, name, phone, vehicle_type, COALESCE(plate_number, '') AS plate_number, status, is_active
       FROM delivery_drivers
       WHERE is_active = true
       ORDER BY id ASC`
    );

    const choices = ["Unassigned (Pending Dispatch)"];
    for (const d of driversRes.rows) {
      const platePart = d.plate_number ? ` [${d.plate_number}]` : "";
      const label = `${d.vehicle_type}${platePart} — ${d.name} (${d.phone})`;
      if (!choices.includes(label)) {
        choices.push(label);
      }
    }

    await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({
        query: `
          mutation UpdateDriverChoices($definition: MetafieldDefinitionUpdateInput!) {
            metafieldDefinitionUpdate(definition: $definition) {
              updatedDefinition {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          definition: {
            namespace: "quicksuuq",
            key: "assigned_driver",
            ownerType: "ORDER",
            validations: [
              {
                name: "choices",
                value: JSON.stringify(choices),
              },
            ],
          },
        },
      }),
    });
  } catch (err) {
    console.warn("Failed to sync drivers to Shopify metafield definition:", err);
  }
}

