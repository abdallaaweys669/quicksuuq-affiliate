import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import {
  ensureDeliveryTables,
  getDeliveryConfig,
  syncDriversToShopifyMetafield,
} from "@/lib/delivery-db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const config = await getDeliveryConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to fetch admin delivery config:", error);
    return NextResponse.json({ error: "Failed to load delivery settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDeliveryTables();
    const body = await request.json();
    const entity = String(body.entity || "").trim();

    if (entity === "area") {
      const name = String(body.name || "").trim();
      const category = String(body.category || "A").trim().toUpperCase().replace("CATEGORY ", "");
      const feeUsd = parseFloat(String(body.fee_usd ?? "1.50"));

      if (!name) {
        return NextResponse.json({ error: "Area name is required." }, { status: 400 });
      }
      if (isNaN(feeUsd) || feeUsd < 0) {
        return NextResponse.json({ error: "Valid delivery fee ($) is required." }, { status: 400 });
      }

      const res = await query(
        `INSERT INTO delivery_areas (name, category, fee_usd, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, fee_usd = EXCLUDED.fee_usd, is_active = true
         RETURNING id, name, category, fee_usd::float AS fee_usd, is_active, sort_order`,
        [name, category, feeUsd]
      );
      return NextResponse.json({ success: true, area: res.rows[0] });
    }

    if (entity === "vehicle") {
      const name = String(body.name || "").trim();
      const minKg = parseFloat(String(body.min_weight_kg ?? "0")) || 0;
      const maxKg = parseFloat(String(body.max_weight_kg ?? "20")) || 20;

      if (!name) {
        return NextResponse.json({ error: "Vehicle name is required." }, { status: 400 });
      }

      const res = await query(
        `INSERT INTO delivery_vehicles (name, min_weight_kg, max_weight_kg, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO UPDATE SET min_weight_kg = EXCLUDED.min_weight_kg, max_weight_kg = EXCLUDED.max_weight_kg, is_active = true
         RETURNING id, name, min_weight_kg::float AS min_weight_kg, max_weight_kg::float AS max_weight_kg, is_active`,
        [name, minKg, maxKg]
      );
      return NextResponse.json({ success: true, vehicle: res.rows[0] });
    }

    if (entity === "driver") {
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      const vehicleType = String(body.vehicle_type || "Bajaj").trim();
      const plateNumber = String(body.plate_number || "").trim();
      const status = String(body.status || "Available").trim();

      if (!name || !phone) {
        return NextResponse.json({ error: "Driver name and phone are required." }, { status: 400 });
      }

      const res = await query(
        `INSERT INTO delivery_drivers (name, phone, vehicle_type, plate_number, status, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, name, phone, vehicle_type, plate_number, status, is_active`,
        [name, phone, vehicleType, plateNumber, status]
      );
      await syncDriversToShopifyMetafield();
      return NextResponse.json({ success: true, driver: res.rows[0] });
    }

    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  } catch (error) {
    console.error("Failed to create delivery item:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDeliveryTables();
    const body = await request.json();
    const entity = String(body.entity || "").trim();

    if (entity === "settings") {
      if (body.heavy_weight_threshold_kg !== undefined) {
        const val = Math.max(0, parseFloat(String(body.heavy_weight_threshold_kg)) || 100);
        await query(
          `INSERT INTO delivery_settings (key, value) VALUES ('heavy_weight_threshold_kg', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [String(val)]
        );
      }
      if (body.heavy_surcharge_usd !== undefined) {
        const val = Math.max(0, parseFloat(String(body.heavy_surcharge_usd)) || 0);
        await query(
          `INSERT INTO delivery_settings (key, value) VALUES ('heavy_surcharge_usd', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [val.toFixed(2)]
        );
      }
      const config = await getDeliveryConfig();
      return NextResponse.json({ success: true, settings: config.settings });
    }

    if (entity === "area") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "Area ID required" }, { status: 400 });

      const name = String(body.name || "").trim();
      const category = String(body.category || "A").trim().toUpperCase().replace("CATEGORY ", "");
      const feeUsd = parseFloat(String(body.fee_usd ?? "1.50"));
      const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

      const res = await query(
        `UPDATE delivery_areas
         SET name = $1, category = $2, fee_usd = $3, is_active = $4
         WHERE id = $5
         RETURNING id, name, category, fee_usd::float AS fee_usd, is_active, sort_order`,
        [name, category, feeUsd, isActive, id]
      );
      return NextResponse.json({ success: true, area: res.rows[0] });
    }

    if (entity === "vehicle") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "Vehicle ID required" }, { status: 400 });

      const name = String(body.name || "").trim();
      const minKg = parseFloat(String(body.min_weight_kg ?? "0")) || 0;
      const maxKg = parseFloat(String(body.max_weight_kg ?? "20")) || 20;
      const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

      const res = await query(
        `UPDATE delivery_vehicles
         SET name = $1, min_weight_kg = $2, max_weight_kg = $3, is_active = $4
         WHERE id = $5
         RETURNING id, name, min_weight_kg::float AS min_weight_kg, max_weight_kg::float AS max_weight_kg, is_active`,
        [name, minKg, maxKg, isActive, id]
      );
      return NextResponse.json({ success: true, vehicle: res.rows[0] });
    }

    if (entity === "driver") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "Driver ID required" }, { status: 400 });

      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      const vehicleType = String(body.vehicle_type || "Bajaj").trim();
      const plateNumber = String(body.plate_number || "").trim();
      const status = String(body.status || "Available").trim();
      const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

      const res = await query(
        `UPDATE delivery_drivers
         SET name = $1, phone = $2, vehicle_type = $3, plate_number = $4, status = $5, is_active = $6
         WHERE id = $7
         RETURNING id, name, phone, vehicle_type, plate_number, status, is_active`,
        [name, phone, vehicleType, plateNumber, status, isActive, id]
      );
      await syncDriversToShopifyMetafield();
      return NextResponse.json({ success: true, driver: res.rows[0] });
    }

    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update delivery item:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDeliveryTables();
    const { searchParams } = new URL(request.url);
    const entity = String(searchParams.get("entity") || "").trim();
    const id = Number(searchParams.get("id"));

    if (!entity || !id) {
      return NextResponse.json({ error: "Entity and ID are required" }, { status: 400 });
    }

    if (entity === "area") {
      await query("DELETE FROM delivery_areas WHERE id = $1", [id]);
    } else if (entity === "vehicle") {
      await query("DELETE FROM delivery_vehicles WHERE id = $1", [id]);
    } else if (entity === "driver") {
      await query("DELETE FROM delivery_drivers WHERE id = $1", [id]);
      await syncDriversToShopifyMetafield();
    } else {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete delivery item:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}

