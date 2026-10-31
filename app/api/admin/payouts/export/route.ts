import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "approved"; // 'approved' or 'paid'

    let sql = "";
    if (scope === "approved") {
      sql = `
        SELECT
          s.name AS salesperson_name,
          s.phone AS mobile_number,
          s.code AS referral_code,
          COUNT(c.id)::int AS orders_count,
          COALESCE(SUM(c.commission_amount), 0)::float AS payout_amount_usd,
          'EVC_PLUS' AS suggested_payment_method,
          'APPROVED_UNPAID' AS payout_status,
          NOW()::date::text AS export_date
        FROM salespeople s
        JOIN commissions c ON c.salesperson_id = s.id AND c.status = 'APPROVED'
        GROUP BY s.id
        HAVING SUM(c.commission_amount) > 0
        ORDER BY s.name ASC
      `;
    } else {
      sql = `
        SELECT
          s.name AS salesperson_name,
          s.phone AS mobile_number,
          s.code AS referral_code,
          p.amount::float AS payout_amount_usd,
          p.payment_method,
          p.transaction_ref,
          p.status AS payout_status,
          p.paid_at::date::text AS paid_date
        FROM payouts p
        JOIN salespeople s ON s.id = p.salesperson_id
        ORDER BY p.paid_at DESC
        LIMIT 500
      `;
    }

    const res = await query(sql);

    // Build CSV string
    const rows = res.rows;
    if (rows.length === 0) {
      return new NextResponse("No data to export", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=quicksuuq-payouts-${scope}.csv`,
        },
      });
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [headers.join(",")];

    for (const row of rows) {
      const values = headers.map((header) => {
        const val = (row as Record<string, unknown>)[header];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvLines.push(values.join(","));
    }

    const csvData = csvLines.join("\n");
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=quicksuuq-payouts-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  } catch (error) {
    console.error("Payout export failed:", error);
    return NextResponse.json({ error: "Failed to export payouts CSV" }, { status: 500 });
  }
}
