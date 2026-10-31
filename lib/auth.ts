import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const AUTH_SECRET = process.env.SHOPIFY_API_SECRET || "quicksuuq_affiliate_auth_secret_key_2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "quicksuuq-admin-2026";

export const REP_COOKIE_NAME = "quicksuuq_rep_session";
export const ADMIN_COOKIE_NAME = "quicksuuq_admin_session";

export interface SalespersonSession {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  commission_rate: number;
}

export interface AdminSession {
  isAdmin: true;
  authenticatedAt: number;
}

// Password / PIN Hashing using scrypt with cryptographically random salt
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const derivedKey = scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, "hex");
    return keyBuffer.length === derivedKey.length && timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// Aliases for PIN backward compatibility
export const hashPin = hashPassword;
export const verifyPin = verifyPassword;

// Session Token Creation & Verification using HMAC SHA-256
export function createSessionToken(payload: Record<string, unknown> | object, expiresInHours = 72): string {
  const data = {
    ...payload,
    exp: Date.now() + expiresInHours * 60 * 60 * 1000,
  };
  const jsonStr = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  const signature = createHmac("sha256", AUTH_SECRET).update(jsonStr).digest("base64url");
  return `${jsonStr}.${signature}`;
}

export function verifySessionToken<T>(token: string | null | undefined): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [dataPart, signature] = parts;
  try {
    const expected = createHmac("sha256", AUTH_SECRET).update(dataPart).digest("base64url");
    const expBuf = Buffer.from(expected, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (expBuf.length !== sigBuf.length || !timingSafeEqual(expBuf, sigBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(dataPart, "base64url").toString("utf8"));
    if (typeof decoded.exp === "number" && Date.now() > decoded.exp) {
      return null;
    }
    return decoded as T;
  } catch {
    return null;
  }
}

// Helper to get active salesperson from cookies
export async function getSalespersonSession(): Promise<SalespersonSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(REP_COOKIE_NAME)?.value;
  return verifySessionToken<SalespersonSession>(token);
}

// Helper to get active admin from cookies
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken<AdminSession>(token);
}

// Validate admin passcode
export function verifyAdminPasscode(passcode: string): boolean {
  if (!passcode || typeof passcode !== "string") return false;
  const a = Buffer.from(passcode.trim(), "utf8");
  const b = Buffer.from(ADMIN_SECRET.trim(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
