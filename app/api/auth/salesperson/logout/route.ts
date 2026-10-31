import { NextResponse } from "next/server";
import { REP_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(REP_COOKIE_NAME);
  return response;
}
