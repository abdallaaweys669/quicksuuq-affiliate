import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function verifyShopifyHmac(rawBody: Buffer, suppliedHmac: string | null): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !suppliedHmac) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(suppliedHmac, "utf8");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function validateShopifyStore(request: NextRequest): boolean {
  const expected = process.env.SHOPIFY_STORE_DOMAIN?.toLowerCase().trim();
  const received = request.headers.get("x-shopify-shop-domain")?.toLowerCase().trim();
  return Boolean(expected && received && expected === received);
}

export function normalizeSomaliPhone(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("00252")) digits = digits.slice(5);
  else if (digits.startsWith("252")) digits = digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);
  // Somali mobile numbers are normally 9 digits beginning with 6 or 7.
  if (!/^([67])\d{8}$/.test(digits)) return null;
  return digits;
}

export function findOrderPhone(order: Record<string, unknown>): string | null {
  const noteAttributes = Array.isArray(order.note_attributes) ? order.note_attributes as Array<{ name?: string; key?: string; value?: unknown }> : [];
  const phoneAttribute = noteAttributes.find((attribute) => {
    const key = String(attribute.name ?? attribute.key ?? "").toLowerCase().replace(/[^a-z]/g, "");
    return ["phone", "customerphone", "contactphone", "normalizedphone"].includes(key);
  });
  const shipping = order.shipping_address as Record<string, unknown> | undefined;
  const billing = order.billing_address as Record<string, unknown> | undefined;
  const customer = order.customer as Record<string, unknown> | undefined;
  const candidates = [phoneAttribute?.value, order.phone, shipping?.phone, billing?.phone, customer?.phone];
  for (const candidate of candidates) {
    const normalized = normalizeSomaliPhone(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function getReferralCode(order: Record<string, unknown>): string {
  const attrs = Array.isArray(order.note_attributes) ? order.note_attributes as Array<{ name?: string; key?: string; value?: unknown }> : [];
  const attr = attrs.find((item) => {
    const key = String(item.name ?? item.key ?? "").toLowerCase().replace(/[^a-z]/g, "");
    return ["referralcode", "agentcode"].includes(key);
  });
  return typeof attr?.value === "string" ? attr.value.trim().toUpperCase().slice(0, 64) : "";
}

export function getEligibleSubtotal(order: Record<string, unknown>): number {
  const candidates = [order.current_subtotal_price, order.subtotal_price,
    (order.current_subtotal_price_set as any)?.shop_money?.amount,
    (order.subtotal_price_set as any)?.shop_money?.amount];
  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== "") {
      const amount = Number(value);
      if (Number.isFinite(amount)) return Math.max(0, Math.round((amount + Number.EPSILON) * 100) / 100);
    }
  }
  return 0;
}

export function getCurrency(order: Record<string, unknown>): string {
  const setCurrency = (order.current_total_price_set as any)?.shop_money?.currency_code;
  return String(order.currency ?? setCurrency ?? "USD").slice(0, 3).toUpperCase();
}
