import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { processPaidOrder } from "@/lib/affiliate";
import { normalizeSomaliPhone } from "@/lib/shopify";

export const runtime = "nodejs";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN || "quicksuuq-test.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawPhone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const district = String(body.district || "").trim();
    const neighborhood = String(body.neighborhood || "").trim();
    const branch = String(body.branch || "").trim();
    const apartment = String(body.apartment || "").trim();
    const rawAgentCode = String(body.agent_code || "").trim().toUpperCase();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedPhone = normalizeSomaliPhone(rawPhone);
    const formattedPhone = normalizedPhone
      ? `+252${normalizedPhone.replace(/^\+?252/, "")}`
      : rawPhone.startsWith("+")
      ? rawPhone
      : `+252${rawPhone.replace(/^0/, "")}`;

    let effectiveAgentCode = "";
    let isLifetimeApplied = false;

    // 1. Check if customer phone already has a lifetime mapping in Supabase
    if (normalizedPhone) {
      const existingMap = await query<{ code: string; is_active: boolean }>(
        `SELECT s.code, s.is_active
         FROM customer_mappings cm
         JOIN salespeople s ON s.id = cm.salesperson_id
         WHERE cm.normalized_phone = $1
         LIMIT 1`,
        [normalizedPhone]
      );
      if (existingMap.rows[0]?.is_active) {
        effectiveAgentCode = existingMap.rows[0].code.toUpperCase();
        if (!rawAgentCode || rawAgentCode !== effectiveAgentCode) {
          isLifetimeApplied = true;
        }
      }
    }

    // 2. Otherwise check if entered agent_code is an active salesperson in Supabase
    if (!effectiveAgentCode && rawAgentCode) {
      const repRes = await query<{ code: string }>(
        `SELECT code FROM salespeople WHERE UPPER(code) = $1 AND is_active = TRUE LIMIT 1`,
        [rawAgentCode]
      );
      if (repRes.rows[0]) {
        effectiveAgentCode = repRes.rows[0].code.toUpperCase();
      }
    }

    const fullAddress = [district, neighborhood, branch, apartment]
      .filter(Boolean)
      .join(", ") || "Mogadishu, Somalia";

    const noteAttributes = [
      { name: "Phone", value: formattedPhone },
      { name: "Dagmada", value: district || "Mogadishu" },
      { name: "Xaafada", value: neighborhood || "Taleex" },
      { name: "Apartment", value: apartment || "" },
      { name: "PaymentMethod", value: "EVC Plus (Online Mobile Money)" },
    ];

    let orderTags = "EVC Plus, Local Delivery";
    if (effectiveAgentCode) {
      noteAttributes.push({ name: "referral_code", value: effectiveAgentCode });
      noteAttributes.push({ name: "agent_code", value: effectiveAgentCode });
      if (isLifetimeApplied) {
        noteAttributes.push({ name: "LifetimeCommission", value: "true" });
      }
      orderTags += `, QuickSuuq_Affiliate, Agent:${effectiveAgentCode}`;
    } else {
      orderTags += ", DirectCustomer";
    }

    const lineItems = items.map((it: { variant_id: number | string; quantity: number }) => ({
      variant_id: Number(it.variant_id),
      quantity: Number(it.quantity) || 1,
    }));

    const orderPayload = {
      order: {
        line_items: lineItems,
        phone: formattedPhone,
        email: email || undefined,
        shipping_address: {
          first_name: "QuickSuuq",
          last_name: "Customer",
          phone: formattedPhone,
          address1: fullAddress,
          city: district || "Mogadishu",
          province: "Banadir",
          country: "Somalia",
          country_code: "SO",
        },
        billing_address: {
          first_name: "QuickSuuq",
          last_name: "Customer",
          phone: formattedPhone,
          address1: fullAddress,
          city: district || "Mogadishu",
          province: "Banadir",
          country: "Somalia",
          country_code: "SO",
        },
        financial_status: "paid",
        gateway: "EVC Plus / Zaad / Sahal (Mobile Money)",
        payment_gateway_names: ["EVC Plus / Zaad / Sahal (Mobile Money)"],
        tags: orderTags,
        note: `EVC Plus Online Payment from ${formattedPhone}. 100% Paid.${
          effectiveAgentCode ? ` Rep: ${effectiveAgentCode}` : " Direct Customer."
        }`,
        note_attributes: noteAttributes,
      },
    };

    const shopifyRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-01/orders.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        },
        body: JSON.stringify(orderPayload),
      }
    );

    const data = await shopifyRes.json();
    if (!shopifyRes.ok || !data.order) {
      console.error("[EVC Checkout] Shopify order creation failed:", data);
      return NextResponse.json(
        { error: data.errors || "Failed to create order on Shopify" },
        { status: shopifyRes.status || 500, headers: corsHeaders }
      );
    }

    // Record commission and lifetime phone mapping immediately in Supabase
    try {
      await processPaidOrder(data.order);
    } catch (err) {
      console.error("[EVC Checkout] Commission recording error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        order: {
          id: data.order.id,
          name: String(data.order.name || data.order.order_number).replace(/^#/, ""),
          total: data.order.total_price,
          phone: formattedPhone,
          agent_code: effectiveAgentCode,
          is_lifetime_applied: isLifetimeApplied,
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[EVC Checkout] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to process EVC Plus checkout" },
      { status: 500, headers: corsHeaders }
    );
  }
}

