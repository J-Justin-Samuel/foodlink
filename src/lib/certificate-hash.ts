import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Tamper-evident hashes for certificates and reports. The hash is an HMAC-SHA256 over the exact
 * facts printed on the document, keyed with CERTIFICATE_SECRET, so nobody can edit a number
 * or invent a serial and still produce a valid code. The QR code points at the verify page,
 * which recomputes the hash from our database and compares.
 */
function secret(): string {
  const s = process.env.CERTIFICATE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "CERTIFICATE_SECRET must be set (16+ characters) in production.",
    );
  return "dev-only-certificate-secret-change-me";
}

export const sign = (parts: (string | number)[]): string =>
  createHmac("sha256", secret())
    .update(parts.map(String).join("|"))
    .digest("hex");

export function hashMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "hex"),
    b = Buffer.from(actual, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I
export function newSerial(prefix: "FL" | "ESG"): string {
  const bytes = randomBytes(10);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${s.slice(0, 5)}-${s.slice(5)}`;
}

export const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
export const verifyUrl = (serial: string, hash: string) =>
  `${appUrl()}/verify/${encodeURIComponent(serial)}?h=${hash.slice(0, 16)}`;

export const certificateParts = (c: {
  serial: string;
  userId: string;
  holderName: string;
  deliveriesCount: number;
  foodKg: string | number;
  meals: number;
  points: number;
  issuedAt: Date;
}) => [
  "CERT",
  c.serial,
  c.userId,
  c.holderName,
  c.deliveriesCount,
  Number(c.foodKg).toFixed(2),
  c.meals,
  c.points,
  c.issuedAt.toISOString(),
];

export const reportParts = (r: {
  serial: string;
  donorId: string;
  year: number;
  quarter: number;
  deliveriesCount: number;
  foodKg: string | number;
  co2eKg: string | number;
  waterL: string | number;
  meals: number;
}) => [
  "ESG",
  r.serial,
  r.donorId,
  r.year,
  r.quarter,
  r.deliveriesCount,
  Number(r.foodKg).toFixed(2),
  Number(r.co2eKg).toFixed(2),
  Number(r.waterL).toFixed(2),
  r.meals,
];
