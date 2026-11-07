import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN || "quicksuuq-test.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";

export type OrderWorkflowStage =
  | "UNPAID"
  | "NOT_PREPARED"
  | "IN_PROCESS"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

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
): OrderWorkflowStage {
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

function stageToMetafieldStatus(stage: OrderWorkflowStage): string {
  switch (stage) {
    case "UNPAID":
      return "Pending Dispatch";
    case "NOT_PREPARED":
      return "Pending Dispatch";
    case "IN_PROCESS":
      return "In Process (Preparing)";
    case "OUT_FOR_DELIVERY":
      return "Out for Delivery";
    case "DELIVERED":
      return "Delivered";
  }
}

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gqlRes = await shopifyGql(`
      query GetAdminOrders {
        orders(first: 40, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              legacyResourceId
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              note
              tags
              totalPriceSet {
                shopMoney { amount currencyCode }
              }
              subtotalPriceSet {
                shopMoney { amount }
              }
              totalShippingPriceSet {
                shopMoney { amount }
              }
              customer {
                firstName
                lastName
                phone
                email
              }
              shippingAddress {
                firstName
                lastName
                phone
                address1
                city
              }
              customAttributes {
                key
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
              orderWeightMeta: metafield(namespace: "quicksuuq", key: "order_weight") {
                value
              }
              lineItems(first: 30) {
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

    const edges = gqlRes?.data?.orders?.edges || [];
    const orders = edges.map((edge: any) => {
      const n = edge.node;
      const attrs: Record<string, string> = {};
      for (const a of n.customAttributes || []) {
        if (a?.key) attrs[a.key] = a.value || "";
      }

      const custName =
        [n.shippingAddress?.firstName, n.shippingAddress?.lastName].filter(Boolean).join(" ") ||
        [n.customer?.firstName, n.customer?.lastName].filter(Boolean).join(" ") ||
        attrs["Customer Name"] ||
        "QuickSuuq Customer";

      const phone =
        n.shippingAddress?.phone ||
        n.customer?.phone ||
        attrs["Phone"] ||
        "—";

      const deliveryArea =
        n.deliveryAreaMeta?.value ||
        attrs["Delivery Area"] ||
        n.shippingAddress?.city ||
        "Mogadishu";

      const detailedAddress =
        attrs["Detailed Address"] ||
        n.shippingAddress?.address1 ||
        n.note ||
        "—";

      const orderWeight =
        n.orderWeightMeta?.value ||
        attrs["Estimated Order Weight"] ||
        "—";

      const recommendedVehicle =
        n.recommendedVehicleMeta?.value ||
        attrs["Recommended Vehicle"] ||
        "Fekon / Bajaj";

      const assignedDriver =
        n.assignedDriverMeta?.value ||
        attrs["Assigned Driver / Vehicle"] ||
        "Unassigned (Pending Dispatch)";

      const deliveryStatus =
        n.deliveryStatusMeta?.value ||
        attrs["Delivery Status"] ||
        "Pending Dispatch";

      const referralCode =
        attrs["Referral Code"] ||
        attrs["referral_code"] ||
        attrs["agent_code"] ||
        "";

      const stage = resolveStage(
        n.displayFinancialStatus || "PAID",
        n.displayFulfillmentStatus || "UNFULFILLED",
        deliveryStatus,
        assignedDriver
      );

      const items = (n.lineItems?.edges || []).map((le: any) => ({
        title: le.node.title,
        quantity: le.node.quantity,
        unit_price: parseFloat(le.node.originalUnitPriceSet?.shopMoney?.amount || "0"),
        image_url: le.node.image?.url || "",
      }));

      return {
        gid: n.id,
        shopify_id: n.legacyResourceId,
        order_number: n.name,
        created_at: n.createdAt,
        financial_status: n.displayFinancialStatus || "PAID",
        fulfillment_status: n.displayFulfillmentStatus || "UNFULFILLED",
        subtotal_usd: parseFloat(n.subtotalPriceSet?.shopMoney?.amount || "0"),
        shipping_usd: parseFloat(n.totalShippingPriceSet?.shopMoney?.amount || "0"),
        total_usd: parseFloat(n.totalPriceSet?.shopMoney?.amount || "0"),
        customer_name: custName,
        phone,
        delivery_area: deliveryArea,
        detailed_address: detailedAddress,
        order_weight: orderWeight,
        recommended_vehicle: recommendedVehicle,
        assigned_driver: assignedDriver,
        delivery_status: deliveryStatus,
        referral_code: referralCode,
        workflow_stage: stage,
        items,
      };
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Failed to fetch Shopify orders for dispatch board:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const gid = String(body.gid || "").trim();
    if (!gid) {
      return NextResponse.json({ error: "Order GID is required" }, { status: 400 });
    }

    const metafieldsToSet: Array<Record<string, string>> = [];

    if (body.workflow_stage) {
      const stage = body.workflow_stage as OrderWorkflowStage;
      const statusText = stageToMetafieldStatus(stage);
      metafieldsToSet.push({
        ownerId: gid,
        namespace: "quicksuuq",
        key: "delivery_status",
        type: "single_line_text_field",
        value: statusText,
      });
    }

    if (body.assigned_driver !== undefined) {
      metafieldsToSet.push({
        ownerId: gid,
        namespace: "quicksuuq",
        key: "assigned_driver",
        type: "single_line_text_field",
        value: String(body.assigned_driver || "Unassigned (Pending Dispatch)"),
      });
    }

    if (metafieldsToSet.length > 0) {
      const gqlRes = await shopifyGql(
        `
        mutation UpdateOrderDispatch($metafields: [MetafieldsSetInput!]!) {
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
        { metafields: metafieldsToSet }
      );

      const errs = gqlRes?.data?.metafieldsSet?.userErrors || [];
      if (errs.length > 0) {
        console.warn("MetafieldsSet userErrors:", errs);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update order dispatch state:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
