import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSessionToken, hashPin, REP_COOKIE_NAME, verifyPin, type SalespersonSession } from "@/lib/auth";
import { normalizeSomaliPhone } from "@/lib/shopify";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailInput = String(body.email || body.identifier || "").trim();
    const password = String(body.password || body.pin || "").trim();

    if (!emailInput) {
      return NextResponse.json({ error: "Please enter your registered email address or referral code." }, { status: 400 });
    }

    const emailQuery = emailInput.toLowerCase();
    const codeQuery = emailInput.toUpperCase();
    const normalizedPhone = normalizeSomaliPhone(emailInput);

    // Lookup salesperson by email first, then code, then phone fallback
    const sql = `
      SELECT id, name, code, email, phone, hashed_pin, commission_rate, is_active
      FROM salespeople
      WHERE (
        LOWER(email) = $1
        OR UPPER(code) = $2
        OR ($3::text IS NOT NULL AND phone LIKE '%' || $3::text)
      )
      LIMIT 1
    `;
    const res = await query<{
      id: string;
      name: string;
      code: string;
      email: string | null;
      phone: string | null;
      hashed_pin: string | null;
      commission_rate: string;
      is_active: boolean;
    }>(sql, [emailQuery, codeQuery, normalizedPhone]);

    const rep = res.rows[0];
    if (!rep) {
      return NextResponse.json({ error: "No account found with this email or referral code." }, { status: 404 });
    }

    if (!rep.is_active) {
      return NextResponse.json({ error: "Your affiliate account is currently inactive. Please contact QuickSuuq support." }, { status: 403 });
    }

    // First-time onboarding without password set
    if (!rep.hashed_pin) {
      return NextResponse.json({
        requiresPinSetup: true,
        salespersonId: rep.id,
        name: rep.name,
        code: rep.code,
        email: rep.email,
      });
    }

    // Password check
    if (!password) {
      return NextResponse.json({ error: "Please enter your password." }, { status: 400 });
    }

    if (!verifyPin(password, rep.hashed_pin)) {
      return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });
    }

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
      maxAge: 72 * 3600, // 3 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Salesperson login failed:", error);
    return NextResponse.json({ error: "An error occurred during login. Please try again." }, { status: 500 });
  }
}
