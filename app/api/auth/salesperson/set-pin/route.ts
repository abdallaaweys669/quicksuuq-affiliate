import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSessionToken, hashPin, REP_COOKIE_NAME, type SalespersonSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const salespersonId = String(body.salespersonId || "").trim();
    const pin = String(body.pin || "").trim();

    if (!salespersonId) {
      return NextResponse.json({ error: "Missing salesperson ID." }, { status: 400 });
    }

    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be between 4 and 6 numeric digits." }, { status: 400 });
    }

    const check = await query<{
      id: string;
      name: string;
      code: string;
      email: string | null;
      phone: string | null;
      hashed_pin: string | null;
      commission_rate: string;
      is_active: boolean;
    }>("SELECT id, name, code, email, phone, hashed_pin, commission_rate, is_active FROM salespeople WHERE id = $1", [salespersonId]);

    const rep = check.rows[0];
    if (!rep) {
      return NextResponse.json({ error: "Salesperson not found." }, { status: 404 });
    }

    // Only allow setting PIN if it was null
    if (rep.hashed_pin) {
      return NextResponse.json({ error: "PIN is already set. Please login with your existing PIN or contact Admin." }, { status: 400 });
    }

    const hashed = hashPin(pin);
    await query("UPDATE salespeople SET hashed_pin = $1, updated_at = NOW() WHERE id = $2", [hashed, rep.id]);

    const sessionPayload: SalespersonSession = {
      id: rep.id,
      code: rep.code,
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      commission_rate: Number(rep.commission_rate),
    };

    const token = createSessionToken(sessionPayload);
    const response = NextResponse.json({ success: true, salesperson: sessionPayload });

    response.cookies.set({
      name: REP_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 72 * 3600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Salesperson set-pin failed:", error);
    return NextResponse.json({ error: "Failed to set PIN." }, { status: 500 });
  }
}
