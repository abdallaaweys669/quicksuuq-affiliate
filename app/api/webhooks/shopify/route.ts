import { NextRequest, NextResponse } from "next/server";
import { processCancelledOrder, processPaidOrder, processRefund } from "@/lib/affiliate";
import { validateShopifyStore, verifyShopifyHmac } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!verifyShopifyHmac(rawBody, request.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  if (!validateShopifyStore(request)) {
    return NextResponse.json({ error: "Unexpected Shopify store" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic")?.toLowerCase();
  const webhookId = request.headers.get("x-shopify-webhook-id");
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    let result: unknown;
    switch (topic) {
      case "orders/paid": result = await processPaidOrder(payload); break;
      case "orders/cancelled": result = await processCancelledOrder(payload); break;
      case "refunds/create": result = await processRefund(payload); break;
      default: return NextResponse.json({ received: true, ignored: true, topic });
    }
    // Never log payloads or customer phone numbers.
    console.info("Shopify webhook processed", { topic, webhookId, result });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("Shopify webhook processing failed", {
      topic,
      webhookId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
