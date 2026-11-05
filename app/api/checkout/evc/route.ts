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

// 20 Provisional Delivery Areas & Categories (A: $1.50, B: $2.00, C: $3.00, D: $3.50)
const DELIVERY_AREAS: Record<string, { category: "A" | "B" | "C" | "D"; fee: number }> = {
  // Category A — $1.50
  "Howlwadaag": { category: "A", fee: 1.50 },
  "Warta Nabadda": { category: "A", fee: 1.50 },
  "Hodan": { category: "A", fee: 1.50 },
  "Boondheere": { category: "A", fee: 1.50 },
  // Category B — $2.00
  "Waaberi": { category: "B", fee: 2.00 },
  "Xamar Weyne": { category: "B", fee: 2.00 },
  "Xamar Jajab": { category: "B", fee: 2.00 },
  "Shibis": { category: "B", fee: 2.00 },
  "Shangaani": { category: "B", fee: 2.00 },
  // Category C — $3.00
  "Yaaqshiid": { category: "C", fee: 3.00 },
  "Kaaraan": { category: "C", fee: 3.00 },
  "Huriwaa": { category: "C", fee: 3.00 },
  "Dayniile": { category: "C", fee: 3.00 },
  "Wadajir": { category: "C", fee: 3.00 },
  "Dharkenley": { category: "C", fee: 3.00 },
  "Cabdicasiis": { category: "C", fee: 3.00 },
  // Category D — $3.50
  "Kaxda": { category: "D", fee: 3.50 },
  "Daarusalaam": { category: "D", fee: 3.50 },
  "Gubadley": { category: "D", fee: 3.50 },
  "Garasbaaley": { category: "D", fee: 3.50 },
};

// Liquid volume lookup (in Litres) + fallback weights (in kg) for store products
const PRODUCT_SPECS: Record<string, { weightKg: number; volumeL: number }> = {
  "Al Fanar Sella Basmati Rice 5kg": { weightKg: 5.0, volumeL: 0 },
  "Hilwa Spaghetti Pasta 10kg": { weightKg: 10.0, volumeL: 0 },
  "Fresh Halal Beef & Camel Cuts 1kg": { weightKg: 1.0, volumeL: 0 },
  "Somali Cheddar Cheese Block 400g": { weightKg: 0.4, volumeL: 0 },
  "Somali Camel Milk (Caano Geel) 1L": { weightKg: 1.0, volumeL: 1.0 },
  "Concentrated Laundry Detergent 2L": { weightKg: 2.0, volumeL: 2.0 },
  "Antibacterial Dishwashing Liquid 750ml": { weightKg: 0.75, volumeL: 0.75 },
  "Multi-Surface Cleaner Spray 500ml": { weightKg: 0.5, volumeL: 0.5 },
  "Apple (Tufaax)": { weightKg: 1.0, volumeL: 0 },
  "Avocado (Avokaado)": { weightKg: 1.0, volumeL: 0 },
  "Baadinjaan (Eggplant)": { weightKg: 1.0, volumeL: 0 },
  "Baamiye (Okra / Lady Finger)": { weightKg: 0.5, volumeL: 0 },
  "Banana (Moos)": { weightKg: 1.0, volumeL: 0 },
  "Baradho (Fresh Potato)": { weightKg: 1.0, volumeL: 0 },
  "Basal (Red Onion)": { weightKg: 1.0, volumeL: 0 },
  "Basbaas Qoyan (Green Chili Pepper)": { weightKg: 0.5, volumeL: 0 },
  "Fresh Lemon (Liin Dhanaan)": { weightKg: 0.5, volumeL: 0 },
  "Fresh Papaya Babaay": { weightKg: 1.5, volumeL: 0 },
  "Juicy Orange (Liin Macaan)": { weightKg: 1.0, volumeL: 0 },
  "Somali Mango (Cambo)": { weightKg: 1.0, volumeL: 0 },
  "Sweet Watermelon (Qare)": { weightKg: 3.5, volumeL: 0 },
  "Yaanyo (Fresh Tomatoes)": { weightKg: 1.0, volumeL: 0 },
  "20,000mAh Ultra-Fast Power Bank": { weightKg: 0.45, volumeL: 0 },
  "65W GaN Fast Wall Charger 3-Port": { weightKg: 0.2, volumeL: 0 },
  "Wireless Stereo Earbuds Pro TWS": { weightKg: 0.15, volumeL: 0 },
};

function recommendVehicle(totalWeightKg: number): {
  vehicleTag: string;
  vehicleLabel: string;
} {
  if (totalWeightKg > 800) {
    return {
      vehicleTag: "Fekon Cargo (Exceeds 800kg)",
      vehicleLabel: "⚠️ Exceeds Single Vehicle Capacity (> 800 kg) — Fekon Cargo / Split Dispatch Required",
    };
  }
  if (totalWeightKg > 300) {
    return {
      vehicleTag: "Fekon Cargo",
      vehicleLabel: "Fekon Cargo (Capacity: 800 kg)",
    };
  }
  if (totalWeightKg > 20) {
    return {
      vehicleTag: "Bajaj",
      vehicleLabel: "Bajaj (Capacity: 300 kg)",
    };
  }
  return {
    vehicleTag: "Fekon",
    vehicleLabel: "Fekon (Capacity: 20 kg)",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

interface CheckoutCartItem {
  variant_id: number | string;
  quantity: number;
  title?: string;
  price?: number; // in cents or dollars
  grams?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerName = String(body.customer_name || "").trim() || "QuickSuuq Customer";
    const rawPhone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const deliveryArea = String(body.delivery_area || body.district || "").trim();
    const detailedAddress = String(
      body.detailed_address ||
        [body.neighborhood, body.branch, body.apartment].filter(Boolean).join(", ") ||
        ""
    ).trim();
    const rawAgentCode = String(body.agent_code || "").trim().toUpperCase();
    const items: CheckoutCartItem[] = Array.isArray(body.items) ? body.items : [];

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!deliveryArea || !DELIVERY_AREAS[deliveryArea]) {
      return NextResponse.json(
        { error: "Please select a valid Delivery Area" },
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

    // 3. Calculate Order Subtotal, Total Weight (kg), Liquid Volume (L), and Missing Weight Warnings
    let subtotalUsd = 0;
    let totalWeightKg = 0;
    let totalSolidKg = 0;
    let totalLiquidLitres = 0;
    const missingWeightItems: string[] = [];

    for (const it of items) {
      const qty = Number(it.quantity) || 1;
      const itemTitle = String(it.title || "").trim();
      const rawPrice = Number(it.price || 0);
      // /cart.js sends price in cents (e.g. 950 = $9.50)
      const unitPriceUsd = rawPrice > 100 ? rawPrice / 100 : rawPrice;
      subtotalUsd += unitPriceUsd * qty;

      const spec = PRODUCT_SPECS[itemTitle];
      const itemGrams = Number(it.grams || 0);

      if (spec) {
        const lineKg = spec.weightKg * qty;
        totalWeightKg += lineKg;
        if (spec.volumeL > 0) {
          totalLiquidLitres += spec.volumeL * qty;
        } else {
          totalSolidKg += lineKg;
        }
      } else if (itemGrams > 0) {
        const lineKg = (itemGrams / 1000) * qty;
        totalWeightKg += lineKg;
        totalSolidKg += lineKg;
      } else {
        missingWeightItems.push(itemTitle || `Variant #${it.variant_id}`);
      }
    }

    // Also allow client subtotal_usd if item prices were not included in items payload
    if (subtotalUsd === 0 && body.subtotal_usd) {
      subtotalUsd = Number(body.subtotal_usd) || 0;
    }

    totalWeightKg = Number(totalWeightKg.toFixed(2));
    totalSolidKg = Number(totalSolidKg.toFixed(2));
    totalLiquidLitres = Number(totalLiquidLitres.toFixed(2));

    // 4. Calculate Delivery Fee (Base Category A-D Fee + $1.00 Heavy Order Surcharge if > 100 kg)
    const areaInfo = DELIVERY_AREAS[deliveryArea];
    const baseDeliveryFee = areaInfo.fee;
    const isHeavyOrder = totalWeightKg > 100;
    const heavyOrderSurcharge = isHeavyOrder ? 1.00 : 0.00;
    const finalDeliveryFee = Number((baseDeliveryFee + heavyOrderSurcharge).toFixed(2));

    // 5. Internal Vehicle Recommendation (Staff-Only)
    const { vehicleTag, vehicleLabel } = recommendVehicle(totalWeightKg);

    // Format Customer Name into first_name / last_name for Shopify
    const nameParts = customerName.split(/\s+/);
    const firstName = nameParts[0] || "QuickSuuq";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Customer";

    const fullShippingAddress = detailedAddress
      ? `${deliveryArea} — ${detailedAddress}`
      : `${deliveryArea}, Mogadishu`;

    const weightSummaryParts: string[] = [];
    if (totalSolidKg > 0) weightSummaryParts.push(`${totalSolidKg} kg`);
    if (totalLiquidLitres > 0) weightSummaryParts.push(`${totalLiquidLitres} L liquid`);
    const weightSummaryText =
      weightSummaryParts.length > 0
        ? `${totalWeightKg} kg total (${weightSummaryParts.join(" + ")})`
        : "0 kg (No product weights recorded)";

    const missingWeightStatus =
      missingWeightItems.length > 0
        ? `⚠️ Missing weight/volume for: ${missingWeightItems.join(", ")}`
        : "Complete (All items measured)";

    const feeBreakdownText =
      heavyOrderSurcharge > 0
        ? `$${finalDeliveryFee.toFixed(2)} (Category ${areaInfo.category} $${baseDeliveryFee.toFixed(2)} + $${heavyOrderSurcharge.toFixed(2)} Heavy Order Fee)`
        : `$${finalDeliveryFee.toFixed(2)} (Category ${areaInfo.category})`;

    // Shopify "Additional Details" (note_attributes) for QuickSuuq Staff in Shopify Admin Orders
    const noteAttributes = [
      { name: "Customer Name", value: customerName },
      { name: "Phone", value: formattedPhone },
      { name: "Delivery Area", value: `${deliveryArea} (Category ${areaInfo.category})` },
      { name: "Delivery Fee", value: feeBreakdownText },
      { name: "Detailed Address", value: detailedAddress || "Not provided" },
      { name: "Estimated Order Weight", value: weightSummaryText },
      { name: "Weight / Volume Check", value: missingWeightStatus },
      { name: "Recommended Vehicle", value: vehicleLabel },
      { name: "Payment Status", value: "Paid Online (EVC Plus)" },
    ];

    // Shopify Order Tags for instant filtering/visibility on the Orders list
    const orderTagList = [
      `Area: ${deliveryArea}`,
      `Category: ${areaInfo.category}`,
      `Vehicle: ${vehicleTag}`,
      `Fee: $${finalDeliveryFee.toFixed(2)}`,
      "Delivery: Pending",
      "EVC Plus",
    ];
    if (missingWeightItems.length > 0) {
      orderTagList.push("Weight-Incomplete");
    }
    if (effectiveAgentCode) {
      noteAttributes.push({ name: "referral_code", value: effectiveAgentCode });
      noteAttributes.push({ name: "agent_code", value: effectiveAgentCode });
      if (isLifetimeApplied) {
        noteAttributes.push({ name: "LifetimeCommission", value: "true" });
      }
      orderTagList.push("QuickSuuq_Affiliate", `Agent:${effectiveAgentCode}`);
    } else {
      orderTagList.push("DirectCustomer");
    }

    const lineItems = items.map((it) => ({
      variant_id: Number(it.variant_id),
      quantity: Number(it.quantity) || 1,
    }));

    const shippingLineTitle =
      heavyOrderSurcharge > 0
        ? `Delivery - ${deliveryArea} (Cat ${areaInfo.category} + Heavy Order Fee)`
        : `Delivery - ${deliveryArea} (Category ${areaInfo.category})`;

    const orderPayload = {
      order: {
        line_items: lineItems,
        phone: formattedPhone,
        email: email || undefined,
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          phone: formattedPhone,
          address1: fullShippingAddress,
          city: deliveryArea,
          province: "Banadir",
          country: "Somalia",
          country_code: "SO",
        },
        billing_address: {
          first_name: firstName,
          last_name: lastName,
          phone: formattedPhone,
          address1: fullShippingAddress,
          city: deliveryArea,
          province: "Banadir",
          country: "Somalia",
          country_code: "SO",
        },
        shipping_lines: [
          {
            title: shippingLineTitle,
            price: finalDeliveryFee.toFixed(2),
            code: `DELIVERY_CAT_${areaInfo.category}`,
          },
        ],
        financial_status: "paid",
        gateway: "EVC Plus / Zaad / Sahal (Mobile Money)",
        payment_gateway_names: ["EVC Plus / Zaad / Sahal (Mobile Money)"],
        tags: orderTagList.join(", "),
        note: `Customer: ${customerName} | Area: ${deliveryArea} (Cat ${areaInfo.category}) | Fee: $${finalDeliveryFee.toFixed(2)} | Weight: ${weightSummaryText} | Recommended Vehicle: ${vehicleLabel} | Phone: ${formattedPhone}`,
        note_attributes: noteAttributes,
        metafields: [
          {
            namespace: "quicksuuq",
            key: "assigned_driver",
            type: "single_line_text_field",
            value: "Unassigned (Pending Dispatch)",
          },
          {
            namespace: "quicksuuq",
            key: "delivery_status",
            type: "single_line_text_field",
            value: "Pending Dispatch",
          },
          {
            namespace: "quicksuuq",
            key: "recommended_vehicle",
            type: "single_line_text_field",
            value: vehicleLabel,
          },
          {
            namespace: "quicksuuq",
            key: "delivery_area",
            type: "single_line_text_field",
            value: `${deliveryArea} — ${feeBreakdownText}`,
          },
          {
            namespace: "quicksuuq",
            key: "order_weight",
            type: "single_line_text_field",
            value: weightSummaryText,
          },
        ],
      },
    };

    let shopifyRes = await fetch(
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

    let data = await shopifyRes.json();

    // If Shopify rejects top-level phone/email due to existing customer record conflict (422),
    // retry with customer first/last name only while preserving phone/email in shipping_address and note_attributes
    if (!shopifyRes.ok || !data.order) {
      console.warn("[EVC Checkout] Retrying without top-level customer phone/email conflict:", data);
      const fallbackPayload = {
        order: {
          ...orderPayload.order,
          phone: undefined,
          email: undefined,
          customer: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      };
      shopifyRes = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2025-01/orders.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
          },
          body: JSON.stringify(fallbackPayload),
        }
      );
      data = await shopifyRes.json();
    }

    if (!shopifyRes.ok || !data.order) {
      console.error("[EVC Checkout] Shopify order creation failed:", data);
      const errMsg =
        typeof data.errors === "string"
          ? data.errors
          : data.errors
          ? JSON.stringify(data.errors)
          : "Failed to create order on Shopify";
      return NextResponse.json(
        { error: errMsg },
        { status: shopifyRes.status || 500, headers: corsHeaders }
      );
    }

    // Record 2% product commission (excludes delivery fee) and lifetime phone mapping in Supabase
    try {
      await processPaidOrder(data.order);
    } catch (err) {
      console.error("[EVC Checkout] Commission recording error:", err);
    }

    // Note: Do NOT return vehicle recommendation to customer-facing response
    return NextResponse.json(
      {
        success: true,
        order: {
          id: data.order.id,
          name: String(data.order.name || data.order.order_number).replace(/^#/, ""),
          subtotal: data.order.subtotal_price,
          delivery_area: deliveryArea,
          delivery_fee: finalDeliveryFee.toFixed(2),
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
