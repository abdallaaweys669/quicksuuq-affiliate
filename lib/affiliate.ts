import type { PoolClient } from "pg";
import { inTransaction } from "@/lib/db";
import { findOrderPhone, getCurrency, getEligibleSubtotal, getReferralCode } from "@/lib/shopify";

type ShopifyOrder = Record<string, any>;
const money = (value: number) => Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);

export async function processPaidOrder(order: ShopifyOrder) {
  if (!order?.id) throw new Error("orders/paid payload is missing the order ID");
  const phone = findOrderPhone(order);
  const code = getReferralCode(order);
  const eligibleAmount = getEligibleSubtotal(order);
  const currency = getCurrency(order);
  const orderId = String(order.id);
  const orderNumber = String(order.name ?? order.order_number ?? order.id);

  return inTransaction(async (client) => {
    let salespersonId: string | null = null;
    if (phone) {
      const existing = await client.query<{ salesperson_id: string }>(
        "SELECT salesperson_id FROM customer_mappings WHERE normalized_phone = $1 FOR UPDATE", [phone]);
      salespersonId = existing.rows[0]?.salesperson_id ?? null;
    }

    // Existing phone attribution always wins. Only a first valid referral can create a mapping.
    if (!salespersonId && phone && code) {
      const rep = await client.query<{ id: string }>(
        "SELECT id FROM salespeople WHERE upper(code) = $1 AND is_active = TRUE", [code]);
      if (rep.rows[0]) {
        await client.query(
          `INSERT INTO customer_mappings (normalized_phone, salesperson_id, first_order_id)
           VALUES ($1, $2, $3) ON CONFLICT (normalized_phone) DO NOTHING`, [phone, rep.rows[0].id, orderId]);
        const saved = await client.query<{ salesperson_id: string }>(
          "SELECT salesperson_id FROM customer_mappings WHERE normalized_phone = $1", [phone]);
        salespersonId = saved.rows[0]?.salesperson_id ?? null;
      }
    }

    if (!salespersonId) return { outcome: "not_attributed" as const };
    const rep = await client.query<{ id: string; commission_rate: string; is_active: boolean }>(
      "SELECT id, commission_rate, is_active FROM salespeople WHERE id = $1", [salespersonId]);
    if (!rep.rows[0]?.is_active) return { outcome: "salesperson_inactive" as const };

    const rate = Number(rep.rows[0].commission_rate);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO commissions
        (shopify_order_id, order_number, salesperson_id, currency, eligible_amount,
         refunded_eligible_amount, commission_rate, commission_amount, status)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,'PENDING')
       ON CONFLICT (shopify_order_id) DO NOTHING RETURNING id`,
      [orderId, orderNumber, salespersonId, currency, eligibleAmount, rate, money(eligibleAmount * rate)]);

    if (!inserted.rowCount) return { outcome: "duplicate_ignored" as const };

    // Handle the unusual case where a refund webhook arrived before the paid-order webhook.
    const refunds = await client.query<{ total: string }>(
      "SELECT COALESCE(SUM(refunded_eligible_amount),0)::text AS total FROM shopify_refunds WHERE shopify_order_id = $1", [orderId]);
    const refunded = Math.min(eligibleAmount, Number(refunds.rows[0]?.total ?? 0));
    if (refunded > 0) {
      const net = money(Math.max(0, eligibleAmount - refunded));
      await client.query(
        `UPDATE commissions SET refunded_eligible_amount=$2, commission_amount=$3,
          status=CASE WHEN $4 <= 0 THEN 'VOIDED' ELSE status END, updated_at=NOW() WHERE id=$1`,
        [inserted.rows[0].id, refunded, money(net * rate), net]);
    }
    return { outcome: "commission_created" as const };
  });
}

export async function processCancelledOrder(order: ShopifyOrder) {
  if (!order?.id) throw new Error("orders/cancelled payload is missing the order ID");
  return inTransaction(async (client) => {
    const result = await client.query(
      `UPDATE commissions SET status='VOIDED', commission_amount=0, updated_at=NOW()
       WHERE shopify_order_id=$1 AND status <> 'PAID' RETURNING id`, [String(order.id)]);
    const paid = await client.query("SELECT id FROM commissions WHERE shopify_order_id=$1 AND status='PAID'", [String(order.id)]);
    return { outcome: result.rowCount ? "commission_voided" : paid.rowCount ? "paid_commission_requires_reconciliation" : "no_commission_found" };
  });
}

function refundEligibleAmount(refund: ShopifyOrder): number {
  const items = Array.isArray(refund.refund_line_items) ? refund.refund_line_items : [];
  return money(items.reduce((sum: number, item: ShopifyOrder) => {
    const value = item.subtotal ?? item.subtotal_set?.shop_money?.amount ?? 0;
    const amount = Number(value);
    return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
  }, 0));
}

export async function processRefund(refund: ShopifyOrder) {
  if (!refund?.id || !refund?.order_id) throw new Error("refunds/create payload is missing refund or order ID");
  const refundId = String(refund.id);
  const orderId = String(refund.order_id);
  const amount = refundEligibleAmount(refund);

  return inTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO shopify_refunds (shopify_refund_id, shopify_order_id, refunded_eligible_amount)
       VALUES ($1,$2,$3) ON CONFLICT (shopify_refund_id) DO NOTHING RETURNING shopify_refund_id`, [refundId, orderId, amount]);
    if (!inserted.rowCount) return { outcome: "duplicate_refund_ignored" };

    const commission = await client.query<{ id: string; eligible_amount: string; commission_rate: string; status: string }>(
      "SELECT id, eligible_amount, commission_rate, status FROM commissions WHERE shopify_order_id=$1 FOR UPDATE", [orderId]);
    if (!commission.rows[0]) return { outcome: "refund_recorded_no_commission_found" };
    const row = commission.rows[0];
    if (row.status === "PAID") return { outcome: "paid_commission_requires_reconciliation" };

    const totalResult = await client.query<{ total: string }>(
      "SELECT COALESCE(SUM(refunded_eligible_amount),0)::text AS total FROM shopify_refunds WHERE shopify_order_id=$1", [orderId]);
    const refunded = Math.min(Number(row.eligible_amount), Number(totalResult.rows[0]?.total ?? 0));
    const netEligible = Math.max(0, Number(row.eligible_amount) - refunded);
    const status = netEligible === 0 ? "VOIDED" : row.status;
    await client.query(
      `UPDATE commissions SET refunded_eligible_amount=$2, commission_amount=$3, status=$4, updated_at=NOW() WHERE id=$1`,
      [row.id, money(refunded), money(netEligible * Number(row.commission_rate)), status]);
    return { outcome: "commission_adjusted" };
  });
}
