import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN || "quicksuuq-test.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";

async function shopifyGql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  return res.json();
}

function resolveStage(
  financialStatus: string,
  fulfillmentStatus: string,
  deliveryStatusMeta: string,
  assignedDriverMeta: string
): "UNPAID" | "NOT_PREPARED" | "IN_PROCESS" | "OUT_FOR_DELIVERY" | "DELIVERED" {
  const fin = (financialStatus || "").toUpperCase();
  const ful = (fulfillmentStatus || "").toUpperCase();
  const meta = (deliveryStatusMeta || "").toLowerCase();
  const driver = (assignedDriverMeta || "").toLowerCase();

  if (fin.includes("PENDING") || fin.includes("UNPAID") || fin.includes("AUTHORIZED")) {
    return "UNPAID";
  }
  if (meta.includes("delivered") || ful === "FULFILLED") {
    return "DELIVERED";
  }
  if (meta.includes("out for delivery")) {
    return "OUT_FOR_DELIVERY";
  }
  if (
    meta.includes("in process") ||
    meta.includes("preparing") ||
    meta.includes("assigned") ||
    (driver && !driver.includes("unassigned"))
  ) {
    return "IN_PROCESS";
  }
  return "NOT_PREPARED";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const cleanNum = orderNumber.replace(/^#/, "").trim();

    if (!cleanNum) {
      return NextResponse.json({ error: "Order number is required" }, { status: 400 });
    }

    const gqlRes = await shopifyGql(`
      query GetTrackOrder {
        orders(first: 1, query: "name:#${cleanNum}") {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              note
              totalPriceSet {
                shopMoney { amount currencyCode }
              }
              customAttributes {
                key
                value
              }
              customerPhoneMeta: metafield(namespace: "quicksuuq", key: "customer_phone") {
                value
              }
              deliveryStatusMeta: metafield(namespace: "quicksuuq", key: "delivery_status") {
                value
              }
              assignedDriverMeta: metafield(namespace: "quicksuuq", key: "assigned_driver") {
                value
              }
              recommendedVehicleMeta: metafield(namespace: "quicksuuq", key: "recommended_vehicle") {
                value
              }
              deliveryAreaMeta: metafield(namespace: "quicksuuq", key: "delivery_area") {
                value
              }
              lineItems(first: 20) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPriceSet {
                      shopMoney { amount }
                    }
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);

    const edge = gqlRes?.data?.orders?.edges?.[0];
    if (!edge?.node) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const n = edge.node;
    const attrs: Record<string, string> = {};
    for (const a of n.customAttributes || []) {
      if (a?.key) attrs[a.key] = a.value || "";
    }

    const deliveryStatus = n.deliveryStatusMeta?.value || "";
    const assignedDriver = n.assignedDriverMeta?.value || "";
    const stage = resolveStage(
      n.displayFinancialStatus,
      n.displayFulfillmentStatus,
      deliveryStatus,
      assignedDriver
    );

    // Parse driver name & phone
    let driverName = "";
    let driverPhone = "";
    if (assignedDriver && !assignedDriver.toLowerCase().includes("unassigned")) {
      const parts = assignedDriver.split("—");
      driverName = parts[0]?.trim() || "";
      driverPhone = parts[1]?.trim() || "";
    }

    const items = (n.lineItems?.edges || []).map((le: any) => ({
      title: le.node.title,
      quantity: le.node.quantity,
      price: Number(le.node.originalUnitPriceSet?.shopMoney?.amount || 0).toFixed(2),
      image: le.node.image?.url || null,
    }));

    return NextResponse.json({
      order: {
        gid: n.id,
        order_number: n.name,
        created_at: n.createdAt,
        total: `$${Number(n.totalPriceSet?.shopMoney?.amount || 0).toFixed(2)}`,
        stage,
        delivery_status: deliveryStatus || "Processing",
        delivery_area: n.deliveryAreaMeta?.value || attrs["Delivery Area"] || "Mogadishu",
        detailed_address: attrs["Detailed Address"] || "",
        driver_name: driverName,
        driver_phone: driverPhone,
        vehicle: n.recommendedVehicleMeta?.value?.split("(")[0]?.trim() || "Delivery Courier",
        items,
        is_delivered: stage === "DELIVERED",
      },
    });
  } catch (error) {
    console.error("Error fetching order tracking info:", error);
    return NextResponse.json({ error: "Failed to fetch order tracking info" }, { status: 500 });
  }
}

// Customer 1-Click "Confirm Received / Delivered"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const cleanNum = orderNumber.replace(/^#/, "").trim();

    // Look up the order GID
    const lookupRes = await shopifyGql(`
      query GetOrderGid {
        orders(first: 1, query: "name:#${cleanNum}") {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `);

    const orderGid = lookupRes?.data?.orders?.edges?.[0]?.node?.id;
    if (!orderGid) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Set delivery_status metafield to "5. Delivered (Confirmed by Customer)"
    const mutationRes = await shopifyGql(
      `
      mutation ConfirmDelivery($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
      {
        metafields: [
          {
            ownerId: orderGid,
            namespace: "quicksuuq",
            key: "delivery_status",
            type: "single_line_text_field",
            value: "5. Delivered",
          },
          {
            ownerId: orderGid,
            namespace: "quicksuuq",
            key: "customer_confirmed_delivery",
            type: "single_line_text_field",
            value: new Date().toISOString(),
          },
        ],
      }
    );

    const userErrors = mutationRes?.data?.metafieldsSet?.userErrors || [];
    if (userErrors.length > 0) {
      console.warn("Delivery confirm userErrors:", userErrors);
    }

    return NextResponse.json({
      success: true,
      message: "Mahadsanid! Dalabkaaga waxaa loo xaqiijiyay in lagu soo gaarsiiyay.",
      stage: "DELIVERED",
    });
  } catch (error) {
    console.error("Error confirming order delivery:", error);
    return NextResponse.json({ error: "Failed to confirm delivery" }, { status: 500 });
  }
}
