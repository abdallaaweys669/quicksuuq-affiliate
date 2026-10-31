import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toUpperCase();
    const salespersonFilter = searchParams.get("salespersonId");

    let whereClause = "WHERE 1=1";
    const values: unknown[] = [];
    let idx = 1;

    if (statusFilter && ["PENDING", "APPROVED", "PAID", "VOIDED"].includes(statusFilter)) {
      whereClause += ` AND c.status = $${idx++}`;
      values.push(statusFilter);
    }

    if (salespersonFilter) {
      whereClause += ` AND c.salesperson_id = $${idx++}`;
      values.push(salespersonFilter);
    }

    const sql = `
      SELECT
        c.id,
        c.shopify_order_id,
        c.order_number,
        c.salesperson_id,
        s.name AS salesperson_name,
        s.code AS salesperson_code,
        c.currency,
        c.eligible_amount::float AS eligible_amount,
        c.refunded_eligible_amount::float AS refunded_eligible_amount,
        c.commission_rate::float AS commission_rate,
        c.commission_amount::float AS commission_amount,
        c.status,
        c.paid_at,
        c.created_at,
        c.updated_at
      FROM commissions c
      JOIN salespeople s ON s.id = c.salesperson_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT 200
    `;

    const res = await query(sql, values);

    // Summary counts
    const summaryRes = await query<{
      pending_count: string;
      pending_total: string;
      approved_count: string;
      approved_total: string;
      paid_count: string;
      paid_total: string;
    }>(`
      SELECT
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::text AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END), 0)::text AS pending_total,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::text AS approved_count,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN commission_amount ELSE 0 END), 0)::text AS approved_total,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END)::text AS paid_count,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END), 0)::text AS paid_total
      FROM commissions
    `);

    return NextResponse.json({
      commissions: res.rows,
      summary: summaryRes.rows[0],
    });
  } catch (error) {
    console.error("Failed to list commissions:", error);
    return NextResponse.json({ error: "Failed to list commissions" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
    const action = String(body.action || "").toUpperCase();

    if (ids.length === 0) {
      return NextResponse.json({ error: "No commission IDs provided." }, { status: 400 });
    }

    if (!["APPROVE", "VOID", "PENDING"].includes(action)) {
      return NextResponse.json({ error: "Action must be APPROVE, VOID, or PENDING." }, { status: 400 });
    }

    const targetStatus = action === "APPROVE" ? "APPROVED" : action === "VOID" ? "VOIDED" : "PENDING";

    // Only update non-paid commissions
    const sql = `
      UPDATE commissions
      SET status = $1, updated_at = NOW()
      WHERE id = ANY($2::uuid[]) AND status <> 'PAID'
      RETURNING id, status
    `;
    const res = await query(sql, [targetStatus, ids]);

    return NextResponse.json({
      success: true,
      updatedCount: res.rowCount,
      targetStatus,
    });
  } catch (error) {
    console.error("Failed to update commissions:", error);
    return NextResponse.json({ error: "Failed to update commissions" }, { status: 500 });
  }
}
