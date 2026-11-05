import { NextResponse } from "next/server";
import { getDeliveryConfig } from "@/lib/delivery-db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const config = await getDeliveryConfig();
    return NextResponse.json(
      {
        areas: config.areas.filter((a) => a.is_active),
        vehicles: config.vehicles.filter((v) => v.is_active),
        settings: config.settings,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to load public delivery config:", error);
    return NextResponse.json(
      { error: "Failed to load delivery config" },
      { status: 500, headers: corsHeaders }
    );
  }
}

