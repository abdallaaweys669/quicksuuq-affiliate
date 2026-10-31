import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSessionToken, hashPassword, REP_COOKIE_NAME, type SalespersonSession } from "@/lib/auth";
import { normalizeSomaliPhone } from "@/lib/shopify";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^[A-Z0-9_-]{2,30}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const rawPhone = String(body.phone || "").trim();
    const rawCode = String(body.code || "").trim().toUpperCase();
    const password = String(body.password || "").trim();

    // 1. Validation
    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Please enter your full name (minimum 2 characters)." }, { status: 400 });
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    // Compulsory Somali Phone check
    if (!rawPhone) {
      return NextResponse.json(
        { error: "A Somali phone number is compulsory for receiving EVC Plus commission payouts." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeSomaliPhone(rawPhone);
    if (!normalizedPhone) {
      return NextResponse.json(
        {
          error:
            "Invalid Somali phone number. Please enter a valid 9-digit Somali mobile number (e.g. 61xxxxxxx or +25261xxxxxxx).",
        },
        { status: 400 }
      );
    }

    if (!rawCode || !CODE_REGEX.test(rawCode)) {
      return NextResponse.json(
        { error: "Referral code must be 2 to 30 alphanumeric characters (e.g. ALI10, SARA20)." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // 2. Uniqueness check for email
    const emailCheck = await query<{ id: string }>(
      "SELECT id FROM salespeople WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return NextResponse.json(
        { error: "An affiliate account with this email address already exists. Please log in instead." },
        { status: 409 }
      );
    }

    // 3. Uniqueness check for referral code
    const codeCheck = await query<{ id: string }>(
      "SELECT id FROM salespeople WHERE UPPER(code) = $1 LIMIT 1",
      [rawCode]
    );
    if (codeCheck.rows.length > 0) {
      return NextResponse.json(
        { error: `Referral code "${rawCode}" is already taken. Please choose a different code.` },
        { status: 409 }
      );
    }

    // 4. Hash password and insert
    const hashedPassword = hashPassword(password);
    const defaultRate = 0.02; // 2% commission rate

    const insertSql = `
      INSERT INTO salespeople (name, email, phone, code, hashed_pin, commission_rate, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, name, email, phone, code, commission_rate
    `;
    const res = await query<{
      id: string;
      name: string;
      email: string;
      phone: string;
      code: string;
      commission_rate: string;
    }>(insertSql, [name, email, normalizedPhone, rawCode, hashedPassword, defaultRate]);

    const rep = res.rows[0];

    // 5. Establish session token
    const sessionPayload: SalespersonSession = {
      id: rep.id,
      code: rep.code,
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      commission_rate: Number(rep.commission_rate),
    };

    const token = createSessionToken(sessionPayload);
    const response = NextResponse.json(
      {
        success: true,
        message: "Affiliate account created successfully!",
        salesperson: sessionPayload,
      },
      { status: 201 }
    );

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
  } catch (error: any) {
    console.error("Affiliate registration failed:", error);
    if (error?.code === "23505") {
      // Postgres unique constraint violation
      return NextResponse.json(
        { error: "Email or referral code is already registered. Please use different details." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}
