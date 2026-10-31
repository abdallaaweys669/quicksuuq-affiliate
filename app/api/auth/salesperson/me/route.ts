import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSalespersonSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSalespersonSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Refresh salesperson details
    const repRes = await query<{
      id: string;
      name: string;
      code: string;
      email: string | null;
      phone: string | null;
      commission_rate: string;
      is_active: boolean;
    }>("SELECT id, name, code, email, phone, commission_rate, is_active FROM salespeople WHERE id = $1", [session.id]);

    const rep = repRes.rows[0];
    if (!rep || !rep.is_active) {
      return NextResponse.json({ error: "Account inactive or not found" }, { status: 403 });
    }

    // Metrics query
    const statsRes = await query<{
      total_orders: string;
      total_sales: string;
      pending_commission: string;
      approved_commission: string;
      paid_commission: string;
      total_earned: string;
    }>(
      `SELECT
        COUNT(*)::text AS total_orders,
        COALESCE(SUM(eligible_amount), 0)::text AS total_sales,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END), 0)::text AS pending_commission,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN commission_amount ELSE 0 END), 0)::text AS approved_commission,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END), 0)::text AS paid_commission,
        COALESCE(SUM(CASE WHEN status <> 'VOIDED' THEN commission_amount ELSE 0 END), 0)::text AS total_earned
      FROM commissions
      WHERE salesperson_id = $1`,
      [rep.id]
    );

    // Attributed orders (Strictly NO Customer PII: No name, phone, address, or items)
    const ordersRes = await query<{
      id: string;
      order_number: string;
      currency: string;
      eligible_amount: string;
      commission_rate: string;
      commission_amount: string;
      status: string;
      created_at: string;
      paid_at: string | null;
    }>(
      `SELECT
        id,
        order_number,
        currency,
        eligible_amount,
        commission_rate,
        commission_amount,
        status,
        created_at,
        paid_at
      FROM commissions
      WHERE salesperson_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
      [rep.id]
    );

    // Payouts history
    const payoutsRes = await query<{
      id: string;
      amount: string;
      payment_method: string;
      transaction_ref: string | null;
      status: string;
      paid_at: string | null;
      created_at: string;
    }>(
      `SELECT
        id,
        amount,
        payment_method,
        transaction_ref,
        status,
        paid_at,
        created_at
      FROM payouts
      WHERE salesperson_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
      [rep.id]
    );

    const stats = statsRes.rows[0] ?? {
      total_orders: "0",
      total_sales: "0.00",
      pending_commission: "0.00",
      approved_commission: "0.00",
      paid_commission: "0.00",
      total_earned: "0.00",
    };

    return NextResponse.json({
      salesperson: {
        id: rep.id,
        name: rep.name,
        code: rep.code,
        email: rep.email,
        phone: rep.phone,
        commission_rate: Number(rep.commission_rate),
      },
      stats: {
        totalOrders: Number(stats.total_orders),
        totalSales: Number(stats.total_sales),
        pendingCommission: Number(stats.pending_commission),
        approvedCommission: Number(stats.approved_commission),
        paidCommission: Number(stats.paid_commission),
        totalEarned: Number(stats.total_earned),
      },
      orders: ordersRes.rows,
      payouts: payoutsRes.rows,
    });
  } catch (error) {
    console.error("Failed to load salesperson data:", error);
    return NextResponse.json({ error: "Failed to load affiliate data" }, { status: 500 });
  }
}
