import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminSession, hashPin } from "@/lib/auth";
import { normalizeSomaliPhone } from "@/lib/shopify";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sql = `
      SELECT
        s.id,
        s.name,
        s.code,
        s.email,
        s.phone,
        (s.hashed_pin IS NOT NULL) AS has_pin,
        s.commission_rate::float AS commission_rate,
        s.is_active,
        s.created_at,
        COUNT(c.id)::int AS total_orders,
        COALESCE(SUM(c.eligible_amount), 0)::float AS total_sales,
        COALESCE(SUM(CASE WHEN c.status = 'PENDING' THEN c.commission_amount ELSE 0 END), 0)::float AS pending_amount,
        COALESCE(SUM(CASE WHEN c.status = 'APPROVED' THEN c.commission_amount ELSE 0 END), 0)::float AS approved_amount,
        COALESCE(SUM(CASE WHEN c.status = 'PAID' THEN c.commission_amount ELSE 0 END), 0)::float AS paid_amount
      FROM salespeople s
      LEFT JOIN commissions c ON c.salesperson_id = s.id
      GROUP BY s.id
      ORDER BY s.code ASC
    `;
    const res = await query(sql);
    return NextResponse.json({ salespeople: res.rows });
  } catch (error) {
    console.error("Failed to list salespeople:", error);
    return NextResponse.json({ error: "Failed to list salespeople" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const rawPhone = body.phone ? String(body.phone).trim() : null;
    const rate = typeof body.commission_rate === "number" ? body.commission_rate : 0.02;
    const password = body.password || body.pin ? String(body.password || body.pin).trim() : null;

    if (!name) return NextResponse.json({ error: "Salesperson name is required." }, { status: 400 });
    if (!code || code.length < 2) return NextResponse.json({ error: "Referral code must be at least 2 alphanumeric characters." }, { status: 400 });
    if (rate < 0 || rate > 1) return NextResponse.json({ error: "Commission rate must be between 0 and 1 (e.g. 0.02 for 2%)." }, { status: 400 });

    if (!email) {
      return NextResponse.json({ error: "Email address is required to prevent account duplication." }, { status: 400 });
    }

    if (!rawPhone) {
      return NextResponse.json({ error: "Somali phone number is required for EVC Plus payouts." }, { status: 400 });
    }

    const phone = normalizeSomaliPhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ error: "Please enter a valid Somali phone number (e.g. 61xxxxxxx)." }, { status: 400 });
    }

    const hashedPin = password ? hashPin(password) : null;

    // Check email uniqueness
    const emailExists = await query("SELECT id FROM salespeople WHERE LOWER(email) = $1", [email]);
    if (emailExists.rows.length > 0) {
      return NextResponse.json({ error: `An account with email ${email} already exists.` }, { status: 409 });
    }

    // Check code uniqueness
    const exists = await query("SELECT id FROM salespeople WHERE UPPER(code) = $1", [code]);
    if (exists.rows.length > 0) {
      return NextResponse.json({ error: `Referral code ${code} is already in use.` }, { status: 409 });
    }

    const inserted = await query(
      `INSERT INTO salespeople (name, email, code, phone, hashed_pin, commission_rate, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, email, code, phone, commission_rate, is_active`,
      [name, email, code, phone, hashedPin, rate]
    );

    return NextResponse.json({ success: true, salesperson: inserted.rows[0] });
  } catch (error) {
    console.error("Failed to create salesperson:", error);
    return NextResponse.json({ error: "Failed to create salesperson" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Salesperson ID is required." }, { status: 400 });

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (typeof body.is_active === "boolean") {
      updates.push(`is_active = $${idx++}`);
      values.push(body.is_active);
    }

    if (typeof body.commission_rate === "number" && body.commission_rate >= 0 && body.commission_rate <= 1) {
      updates.push(`commission_rate = $${idx++}`);
      values.push(body.commission_rate);
    }

    if (typeof body.name === "string" && body.name.trim()) {
      updates.push(`name = $${idx++}`);
      values.push(body.name.trim());
    }

    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      // Check if already in use by another rep
      const check = await query("SELECT id FROM salespeople WHERE LOWER(email) = $1 AND id <> $2", [email, id]);
      if (check.rows.length > 0) {
        return NextResponse.json({ error: `Email ${email} is already taken by another account.` }, { status: 409 });
      }
      updates.push(`email = $${idx++}`);
      values.push(email);
    }

    if (body.phone !== undefined) {
      const phone = body.phone ? normalizeSomaliPhone(body.phone) || String(body.phone).trim() : null;
      updates.push(`phone = $${idx++}`);
      values.push(phone);
    }

    if (body.resetPin === true) {
      updates.push(`hashed_pin = NULL`);
    } else if (typeof body.newPin === "string" && /^\d{4,6}$/.test(body.newPin.trim())) {
      updates.push(`hashed_pin = $${idx++}`);
      values.push(hashPin(body.newPin.trim()));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    updates.push("updated_at = NOW()");
    values.push(id);

    const sql = `UPDATE salespeople SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, name, code, is_active, commission_rate`;
    const res = await query(sql, values);

    return NextResponse.json({ success: true, salesperson: res.rows[0] });
  } catch (error) {
    console.error("Failed to update salesperson:", error);
    return NextResponse.json({ error: "Failed to update salesperson" }, { status: 500 });
  }
}
