import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import {
  certificateParts,
  hashMatches,
  newSerial,
  sign,
} from "@/lib/certificate-hash";
import { impactFromHundredths } from "@/lib/esg";
import { isUniqueViolation } from "@/lib/action-utils";

export type Certificate = typeof certificates.$inferSelect;

/** Issues a certificate for the volunteer's work so far. Returns the latest one again if nothing new has been delivered since. */
export async function issueCertificate(
  userId: string,
): Promise<
  | { ok: true; certificate: Certificate; isNew: boolean }
  | { ok: false; error: string }
> {
  const [stats] = (await db.execute(sql`
    SELECT count(*)::int AS n,
           COALESCE(SUM(ROUND(d.quantity_kg * 100)), 0)::bigint AS h,
           COALESCE((SELECT SUM(points) FROM reward_ledger WHERE user_id = ${userId}), 0)::int AS points,
           (SELECT COALESCE(p.display_name, 'Volunteer') FROM profiles p WHERE p.user_id = ${userId}) AS name
    FROM deliveries x JOIN donations d ON d.id = x.donation_id
    WHERE x.volunteer_id = ${userId} AND x.status = 'DELIVERED'
  `)) as unknown as {
    n: number;
    h: string;
    points: number;
    name: string | null;
  }[];
  if (stats.n < 1)
    return {
      ok: false,
      error: "Complete your first delivery to earn a certificate.",
    };

  const [latest] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), isNull(certificates.revokedAt)))
    .orderBy(desc(certificates.issuedAt))
    .limit(1);
  if (latest && latest.deliveriesCount === stats.n)
    return { ok: true, certificate: latest, isNew: false };

  const impact = impactFromHundredths(Number(stats.h));
  for (let attempt = 0; attempt < 3; attempt++) {
    const base = {
      serial: newSerial("FL"),
      userId,
      holderName: stats.name ?? "Volunteer",
      deliveriesCount: stats.n,
      foodKg: impact.foodKg.toFixed(2),
      meals: impact.meals,
      points: stats.points,
      issuedAt: new Date(),
    };
    try {
      const [row] = await db
        .insert(certificates)
        .values({ ...base, hash: sign(certificateParts(base)) })
        .returning();
      return { ok: true, certificate: row, isNew: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // serial clash: try another
    }
  }
  return {
    ok: false,
    error: "Could not create the certificate. Please try again.",
  };
}

export type Verification =
  | {
      status: "VALID";
      kind: "CERTIFICATE";
      serial: string;
      name: string;
      summary: string;
      issuedAt: Date;
    }
  | {
      status: "VALID";
      kind: "REPORT";
      serial: string;
      name: string;
      summary: string;
      issuedAt: Date;
    }
  | { status: "REVOKED" | "INVALID" | "NOT_FOUND"; serial: string };

/** Recomputes the hash from our records. `h` is the code from the QR link (first 16 characters). */
export async function verifySerial(
  serial: string,
  h: string | null,
): Promise<Verification> {
  const clean = serial.trim().toUpperCase().slice(0, 20);
  if (clean.startsWith("FL-")) {
    const [c] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.serial, clean));
    if (!c) return { status: "NOT_FOUND", serial: clean };
    const ok =
      hashMatches(sign(certificateParts(c)), c.hash) &&
      (!h || c.hash.startsWith(h.toLowerCase()));
    if (!ok) return { status: "INVALID", serial: clean };
    if (c.revokedAt) return { status: "REVOKED", serial: clean };
    return {
      status: "VALID",
      kind: "CERTIFICATE",
      serial: clean,
      name: c.holderName,
      summary: `${c.deliveriesCount} deliveries, ${Number(c.foodKg).toFixed(1)} kg of food rescued, ${c.points} points`,
      issuedAt: c.issuedAt,
    };
  }
  if (clean.startsWith("ESG-")) {
    const { verifyReport } = await import("@/lib/esg-reports");
    return verifyReport(clean, h);
  }
  return { status: "NOT_FOUND", serial: clean };
}
