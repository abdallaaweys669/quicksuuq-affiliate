import { NextRequest, NextResponse } from "next/server";
import { inTransaction, query } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sql = `
      SELECT
        p.id,
        p.salesperson_id,
        s.name AS salesperson_name,
        s.code AS salesperson_code,
        s.phone AS salesperson_phone,
        p.amount::float AS amount,
        p.payment_method,
        p.transaction_ref,
        p.status,
        p.paid_at,
        p.created_at,
        COUNT(pc.commission_id)::int AS commissions_count
      FROM payouts p
      JOIN salespeople s ON s.id = p.salesperson_id
      LEFT JOIN payout_commissions pc ON pc.payout_id = p.id
      GROUP BY p.id, s.name, s.code, s.phone
      ORDER BY p.created_at DESC
      LIMIT 100
    `;
    const res = await query(sql);
    return NextResponse.json({ payouts: res.rows });
  } catch (error) {
    console.error("Failed to list payouts:", error);
    return NextResponse.json({ error: "Failed to list payouts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const salespersonId = String(body.salespersonId || "").trim();
    const paymentMethod = String(body.paymentMethod || "EVC_PLUS").toUpperCase();
    const transactionRef = body.transactionRef ? String(body.transactionRef).trim() : null;
    const commissionIds: string[] = Array.isArray(body.commissionIds) ? body.commissionIds : [];

    if (!salespersonId) return NextResponse.json({ error: "Salesperson ID is required." }, { status: 400 });
    if (!["EVC_PLUS", "ZAAD", "SAHAL", "CASH", "OTHER"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method. Must be EVC_PLUS, ZAAD, SAHAL, CASH, or OTHER." }, { status: 400 });
    }
    if (commissionIds.length === 0) {
      return NextResponse.json({ error: "Please select at least one approved commission to pay out." }, { status: 400 });
    }

    return await inTransaction(async (client) => {
      // Fetch selected approved commissions
      const commRes = await client.query<{
        id: string;
        salesperson_id: string;
        commission_amount: string;
        status: string;
      }>(
        `SELECT id, salesperson_id, commission_amount, status
         FROM commissions
         WHERE id = ANY($1::uuid[]) AND salesperson_id = $2 AND status = 'APPROVED'
         FOR UPDATE`,
        [commissionIds, salespersonId]
      );

      if (commRes.rows.length === 0) {
        return NextResponse.json({ error: "No eligible approved commissions found for this salesperson." }, { status: 400 });
      }

      const totalAmount = commRes.rows.reduce((sum, r) => sum + Number(r.commission_amount), 0);
      const roundedAmount = Math.round((totalAmount + Number.EPSILON) * 100) / 100;

      if (roundedAmount <= 0) {
        return NextResponse.json({ error: "Total payout amount must be greater than $0.00." }, { status: 400 });
      }

      // 1. Insert Payout
      const payoutRes = await client.query<{ id: string }>(
        `INSERT INTO payouts (salesperson_id, amount, payment_method, transaction_ref, status, paid_at)
         VALUES ($1, $2, $3, $4, 'PAID', NOW())
         RETURNING id`,
        [salespersonId, roundedAmount, paymentMethod, transactionRef]
      );
      const payoutId = payoutRes.rows[0].id;

      // 2. Insert Payout Commissions & update status to PAID
      for (const comm of commRes.rows) {
        await client.query(
          `INSERT INTO payout_commissions (payout_id, commission_id, amount)
           VALUES ($1, $2, $3)`,
          [payoutId, comm.id, Number(comm.commission_amount)]
        );

        await client.query(
          `UPDATE commissions
           SET status = 'PAID', paid_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [comm.id]
        );
      }

      return NextResponse.json({
        success: true,
        payoutId,
        amount: roundedAmount,
        commissionsCount: commRes.rows.length,
        paymentMethod,
        transactionRef,
      });
    });
  } catch (error) {
    console.error("Payout creation failed:", error);
    return NextResponse.json({ error: "Failed to create payout" }, { status: 500 });
  }
}
