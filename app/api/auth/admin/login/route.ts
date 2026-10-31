import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, createSessionToken, verifyAdminPasscode, type AdminSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const passcode = String(body.passcode || "").trim();

    if (!passcode) {
      return NextResponse.json({ error: "Please enter the admin passcode." }, { status: 400 });
    }

    if (!verifyAdminPasscode(passcode)) {
      return NextResponse.json({ error: "Incorrect admin passcode." }, { status: 401 });
    }

    const sessionPayload: AdminSession = {
      isAdmin: true,
      authenticatedAt: Date.now(),
    };

    const token = createSessionToken(sessionPayload as unknown as Record<string, unknown>, 48);
    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 48 * 3600, // 2 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Admin authentication failed" }, { status: 500 });
  }
}
