import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  normalisePhone,
  sendSms,
  sendWebPush,
  type AlertMessage,
  type PushResult,
  type PushTarget,
} from "@/lib/notify";

/*
 * Background jobs, written as plain functions so they can be tested directly;
 * lib/inngest/functions.ts only schedules them.
 *
 * Lock order matches the rest of the app: donation first, then delivery.
 */

export const ALERT_WINDOW_MINUTES = 45;
export const ALERT_RADIUS_METERS = 15_000;
const MAX_ACTIVE_CLAIMS = 3; // keep equal to claims.ts
const BATCH = 200;

const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];

// ---------------------------------------------------------------------------
// 1. Expire uncollected food
// ---------------------------------------------------------------------------
export interface SweepResult {
  expiredListed: number;
  expiredClaimed: number;
  scrubbedLocations: number;
}

/**
 * Once the hard expiry time passes:
 *  - LISTED batches become EXPIRED (they vanish from volunteer search),
 *  - CLAIMED batches whose pickup never happened become EXPIRED and the
 *    volunteer's delivery FAILS, so nobody drives out for spoiled food.
 * Food already collected (IN_TRANSIT) is left alone: the volunteer has it.
 * Finished deliveries also lose their saved GPS fix (we don't keep locations).
 */
export async function sweepExpiredDonations(
  now = new Date(),
): Promise<SweepResult> {
  const nowIso = now.toISOString(); // raw SQL: pass ISO strings, the driver can't bind Date objects
  const due = await rows<{ id: string }>(sql`
    SELECT id FROM donations
    WHERE status IN ('LISTED', 'CLAIMED') AND shelf_life_expires_at <= ${nowIso}::timestamptz
    ORDER BY shelf_life_expires_at
    LIMIT ${BATCH}
  `);

  let expiredListed = 0;
  let expiredClaimed = 0;

  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT status FROM donations WHERE id = ${id} AND shelf_life_expires_at <= ${nowIso}::timestamptz FOR UPDATE
      `)) as unknown as { status: string }[];
      const status = locked[0]?.status;
      if (status === "LISTED") {
        await tx.execute(
          sql`UPDATE donations SET status = 'EXPIRED', expired_at = ${nowIso}::timestamptz, updated_at = ${nowIso}::timestamptz WHERE id = ${id}`,
        );
        expiredListed++;
      } else if (status === "CLAIMED") {
        const active = (await tx.execute(sql`
          SELECT id, status FROM deliveries WHERE donation_id = ${id} AND status <> 'FAILED' FOR UPDATE
        `)) as unknown as { id: string; status: string }[];
        if (active.some((d) => d.status !== "ASSIGNED")) return; // already collected
        await tx.execute(sql`
          UPDATE deliveries
          SET status = 'FAILED', failure_reason = 'The food expired before pickup.', updated_at = ${nowIso}::timestamptz
          WHERE donation_id = ${id} AND status = 'ASSIGNED'
        `);
        await tx.execute(
          sql`UPDATE donations SET status = 'EXPIRED', expired_at = ${nowIso}::timestamptz, updated_at = ${nowIso}::timestamptz WHERE id = ${id}`,
        );
        expiredClaimed++;
      }
    });
  }

  const scrubbed = (await db.execute(sql`
    UPDATE deliveries
    SET last_lat = NULL, last_lng = NULL, last_heading = NULL, last_speed_mps = NULL, last_location_at = NULL
    WHERE status IN ('DELIVERED', 'FAILED') AND last_lat IS NOT NULL
    RETURNING id
  `)) as unknown as unknown[];

  return { expiredListed, expiredClaimed, scrubbedLocations: scrubbed.length };
}

// ---------------------------------------------------------------------------
// 2. Warn volunteers about food about to expire
// ---------------------------------------------------------------------------
export interface ExpiringDonation {
  id: string;
  title: string;
  address: string | null;
  lat: number;
  lng: number;
  /** ISO time. */
  expiresAt: string;
}

/**
 * Finds LISTED batches with <= 45 minutes left and marks each as alerted in the
 * same statement, so two overlapping runs can never alert the same batch twice.
 */
export async function claimExpiringDonations(
  now = new Date(),
): Promise<ExpiringDonation[]> {
  const nowIso = now.toISOString();
  const untilIso = new Date(
    now.getTime() + ALERT_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const r = await rows<Record<string, any>>(sql`
    UPDATE donations SET expiry_alerted_at = ${nowIso}::timestamptz
    WHERE id IN (
      SELECT id FROM donations
      WHERE status = 'LISTED' AND expiry_alerted_at IS NULL
        AND shelf_life_expires_at > ${nowIso}::timestamptz AND shelf_life_expires_at <= ${untilIso}::timestamptz
      ORDER BY shelf_life_expires_at
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, title, pickup_address, shelf_life_expires_at,
              ST_Y(pickup_location::geometry) AS lat, ST_X(pickup_location::geometry) AS lng
  `);
  return r.map((x) => ({
    id: x.id,
    title: x.title,
    address: x.pickup_address,
    lat: x.lat,
    lng: x.lng,
    expiresAt: new Date(x.shelf_life_expires_at).toISOString(),
  }));
}

export interface NearbyVolunteer {
  userId: string;
  name: string;
  phone: string | null;
  distanceKm: number;
}

/** Active volunteers whose base location is within 15 km and who still have room for another pickup. */
export async function volunteersNear(
  lat: number,
  lng: number,
): Promise<NearbyVolunteer[]> {
  const r = await rows<Record<string, any>>(sql`
    SELECT u.id, p.display_name, p.phone,
           (ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0)::float8 AS km
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.role = 'VOLUNTEER' AND u.is_active
      AND u.onboarding_status IN ('SUBMITTED', 'VERIFIED')
      AND p.location IS NOT NULL
      AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${ALERT_RADIUS_METERS})
      AND (SELECT count(*) FROM deliveries dl
           WHERE dl.volunteer_id = u.id AND dl.status IN ('ASSIGNED', 'PICKED_UP', 'EN_ROUTE')) < ${MAX_ACTIVE_CLAIMS}
    ORDER BY km
  `);
  return r.map((x) => ({
    userId: x.id,
    name: x.display_name,
    phone: x.phone,
    distanceKm: x.km,
  }));
}

export interface AlertDeps {
  push: (t: PushTarget, m: AlertMessage) => Promise<PushResult>;
  sms: (to: string, body: string) => Promise<boolean>;
}
export const realAlertDeps: AlertDeps = { push: sendWebPush, sms: sendSms };

export interface AlertSummary {
  volunteers: number;
  pushed: number;
  smsSent: number;
  removedSubscriptions: number;
}

export function alertText(d: ExpiringDonation, now = new Date()) {
  const mins = Math.max(
    1,
    Math.round((new Date(d.expiresAt).getTime() - now.getTime()) / 60_000),
  );
  const where = d.address ? ` at ${d.address}` : "";
  return {
    title: "Food expiring soon",
    body: `${d.title}${where} expires in ${mins} min. Open FoodLink to claim it.`,
  };
}

/**
 * Alerts every nearby volunteer about one batch: Web Push to each of their
 * devices, and an SMS only if no push reached them (so people aren't alerted twice).
 * Dead push subscriptions (browser unsubscribed) are deleted along the way.
 */
export async function alertVolunteersAbout(
  d: ExpiringDonation,
  deps: AlertDeps = realAlertDeps,
  now = new Date(),
): Promise<AlertSummary> {
  const volunteers = await volunteersNear(d.lat, d.lng);
  const text = alertText(d, now);
  const message: AlertMessage = {
    ...text,
    url: "/volunteer/discover",
    tag: `expiring-${d.id}`,
  };
  const summary: AlertSummary = {
    volunteers: volunteers.length,
    pushed: 0,
    smsSent: 0,
    removedSubscriptions: 0,
  };

  for (const v of volunteers) {
    const subs = await rows<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>(sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${v.userId}
    `);
    let reached = false;
    for (const s of subs) {
      const res = await deps.push(s, message);
      if (res === "sent") {
        reached = true;
        summary.pushed++;
      } else if (res === "gone") {
        await db.execute(
          sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`,
        );
        summary.removedSubscriptions++;
      }
    }
    if (!reached) {
      const to = normalisePhone(v.phone);
      if (to && (await deps.sms(to, `FoodLink: ${text.body}`)))
        summary.smsSent++;
    }
  }
  return summary;
}
