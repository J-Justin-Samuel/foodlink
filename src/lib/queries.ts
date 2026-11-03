import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { DonationItem, FoodClassification } from "@/types/donation";

/* Read-side queries for the dashboards. Raw SQL because of the lateral joins
   and PostGIS distance; every function is scoped to the calling user's id. */

const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;
const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];

// --------------------------------------------------------------------------
// Donor
// --------------------------------------------------------------------------
export interface DonorBoardItem {
  id: string;
  title: string;
  status: string;
  classification: FoodClassification;
  servings: number;
  expiresAt: string;
  disposition: string;
  freshnessScore: number | null;
  freshnessStatus: string | null;
  quantityKg: number;
  /** Stage 5: the batch's auction, if it has one. Prices in paise. */
  auction: null | {
    id: string;
    status: string;
    startMinor: number;
    floorMinor: number;
    stepMinor: number;
    intervalMinutes: number;
    startsAtMs: number;
    finalMinor: number | null;
    orderStatus: string | null;
    cancelReason: string | null;
  };
  delivery: null | {
    id: string;
    status: string;
    volunteerName: string;
    ngoName: string | null;
    hasPhoto: boolean;
    lockedUntil: string | null;
  };
}

export async function getDonorBoard(
  donorId: string,
): Promise<DonorBoardItem[]> {
  const r = await rows<Record<string, any>>(sql`
    SELECT d.id, d.title, d.status, d.food_classification, d.estimated_servings,
           d.shelf_life_expires_at, d.disposition, d.quantity_kg::float8 AS quantity_kg,
           ls.freshness_score, ls.verdict AS freshness_status,
           fa.id AS auction_id, fa.status AS auction_status, fa.start_price::float8 AS a_start,
           fa.reserve_price::float8 AS a_floor, fa.decrement_step::float8 AS a_step,
           fa.interval_minutes AS a_interval, fa.starts_at AS a_starts_at,
           fa.final_price::float8 AS a_final, fa.cancel_reason AS a_cancel, ao.status AS order_status,
           dl.id AS delivery_id, dl.status AS delivery_status, dl.otp_locked_until,
           (dl.handoff_photo_key IS NOT NULL) AS has_photo,
           COALESCE(vp.display_name, 'A volunteer') AS volunteer_name,
           COALESCE(np.organization_name, np.display_name) AS ngo_name
    FROM donations d
    LEFT JOIN LATERAL (
      SELECT s.freshness_score, s.verdict FROM food_quality_scans s
      WHERE s.donation_id = d.id ORDER BY s.scanned_at DESC LIMIT 1
    ) ls ON true
    LEFT JOIN food_auctions fa ON fa.donation_id = d.id
    LEFT JOIN LATERAL (
      SELECT o.status FROM auction_orders o
      WHERE o.auction_id = fa.id AND o.status IN ('PENDING_PAYMENT','AUTHORIZED','CAPTURE_REQUESTED','CAPTURED')
      ORDER BY o.created_at DESC LIMIT 1
    ) ao ON true
    LEFT JOIN LATERAL (
      SELECT x.* FROM deliveries x WHERE x.donation_id = d.id
      ORDER BY (x.status <> 'FAILED') DESC, x.created_at DESC LIMIT 1
    ) dl ON true
    LEFT JOIN profiles vp ON vp.user_id = dl.volunteer_id
    LEFT JOIN profiles np ON np.user_id = dl.ngo_id
    WHERE d.donor_id = ${donorId}
    ORDER BY d.created_at DESC
    LIMIT 50
  `);
  return r.map((x) => ({
    id: x.id,
    title: x.title,
    status: x.status,
    classification: x.food_classification,
    servings: x.estimated_servings,
    expiresAt: iso(x.shelf_life_expires_at)!,
    disposition: x.disposition,
    freshnessScore: x.freshness_score,
    freshnessStatus: x.freshness_status,
    quantityKg: x.quantity_kg,
    auction: x.auction_id
      ? {
          id: x.auction_id,
          status: x.auction_status,
          startMinor: Math.round(x.a_start * 100),
          floorMinor: Math.round(x.a_floor * 100),
          stepMinor: Math.round((x.a_step ?? 0) * 100),
          intervalMinutes: x.a_interval,
          startsAtMs: new Date(x.a_starts_at).getTime(),
          finalMinor: x.a_final == null ? null : Math.round(x.a_final * 100),
          orderStatus: x.order_status,
          cancelReason: x.a_cancel,
        }
      : null,
    delivery: x.delivery_id
      ? {
          id: x.delivery_id,
          status: x.delivery_status,
          volunteerName: x.volunteer_name,
          ngoName: x.ngo_name,
          hasPhoto: x.has_photo,
          lockedUntil: iso(x.otp_locked_until),
        }
      : null,
  }));
}

// --------------------------------------------------------------------------
// Volunteer
// --------------------------------------------------------------------------
export interface VolunteerBoardItem {
  deliveryId: string;
  status: string;
  title: string;
  donationStatus: string;
  address: string | null;
  servings: number;
  expiresAt: string;
  ngoName: string | null;
  failureReason: string | null;
  createdAt: string;
}

export async function getVolunteerBoard(
  volunteerId: string,
): Promise<VolunteerBoardItem[]> {
  const r = await rows<Record<string, any>>(sql`
    SELECT dl.id AS delivery_id, dl.status, dl.failure_reason, dl.created_at,
           d.title, d.status AS donation_status, d.pickup_address,
           d.estimated_servings, d.shelf_life_expires_at,
           COALESCE(np.organization_name, np.display_name) AS ngo_name
    FROM deliveries dl
    JOIN donations d ON d.id = dl.donation_id
    LEFT JOIN profiles np ON np.user_id = dl.ngo_id
    WHERE dl.volunteer_id = ${volunteerId}
    ORDER BY dl.created_at DESC
    LIMIT 30
  `);
  return r.map((x) => ({
    deliveryId: x.delivery_id,
    status: x.status,
    title: x.title,
    donationStatus: x.donation_status,
    address: x.pickup_address,
    servings: x.estimated_servings,
    expiresAt: iso(x.shelf_life_expires_at)!,
    ngoName: x.ngo_name,
    failureReason: x.failure_reason,
    createdAt: iso(x.created_at)!,
  }));
}

export interface NgoOption {
  id: string;
  name: string;
  city: string | null;
  distanceKm: number;
}

export interface DeliveryRun {
  id: string;
  status: string;
  failureReason: string | null;
  /** Shown to the volunteer so they can read it out to the donor. */
  pickupOtp: string | null;
  /** Revealed only after the donor has confirmed pickup. */
  dropoffOtp: string | null;
  lockedUntil: string | null;
  hasPhoto: boolean;
  photoKey: string | null;
  ngoId: string | null;
  ngoName: string | null;
  /** Stage 5: the food was bought in an auction, so the destination is the buyer and can't be changed. */
  ngoIsBuyer: boolean;
  donation: {
    id: string;
    title: string;
    status: string;
    disposition: string;
    classification: FoodClassification;
    servings: number;
    quantityKg: number;
    items: DonationItem[];
    address: string | null;
    instructions: string | null;
    expiresAt: string;
    donorName: string | null;
    divertedReason: string | null;
  };
  latestScan: null | { score: number; status: string; at: string };
  ngoOptions: NgoOption[];
}

export async function getDeliveryRun(
  deliveryId: string,
  volunteerId: string,
): Promise<DeliveryRun | null> {
  const [x] = await rows<Record<string, any>>(sql`
    SELECT dl.id, dl.status, dl.failure_reason, dl.pickup_otp, dl.dropoff_otp,
           dl.otp_locked_until, dl.handoff_photo_key, dl.ngo_id,
           COALESCE(np.organization_name, np.display_name) AS ngo_name,
           (nu.role = 'BUYER') AS ngo_is_buyer,
           d.id AS donation_id, d.title, d.status AS donation_status, d.disposition,
           d.food_classification, d.estimated_servings, d.quantity_kg::float8 AS quantity_kg,
           d.items, d.pickup_address, d.pickup_instructions, d.shelf_life_expires_at,
           d.diversion_reason,
           COALESCE(dp.organization_name, dp.display_name) AS donor_name,
           ls.freshness_score, ls.verdict AS scan_status, ls.scanned_at
    FROM deliveries dl
    JOIN donations d ON d.id = dl.donation_id
    LEFT JOIN profiles dp ON dp.user_id = d.donor_id
    LEFT JOIN profiles np ON np.user_id = dl.ngo_id
    LEFT JOIN users nu ON nu.id = dl.ngo_id
    LEFT JOIN LATERAL (
      SELECT s.freshness_score, s.verdict, s.scanned_at FROM food_quality_scans s
      WHERE s.donation_id = d.id ORDER BY s.scanned_at DESC LIMIT 1
    ) ls ON true
    WHERE dl.id = ${deliveryId} AND dl.volunteer_id = ${volunteerId}
  `);
  if (!x) return null;

  const ngoOptions = (
    await rows<Record<string, any>>(sql`
      SELECT u.id, COALESCE(p.organization_name, p.display_name) AS name, p.city,
             (ST_Distance(p.location, d.pickup_location) / 1000.0)::float8 AS distance_km
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      CROSS JOIN donations d
      WHERE d.id = ${x.donation_id}
        AND u.role = 'NGO' AND u.is_active
        AND u.onboarding_status IN ('SUBMITTED', 'VERIFIED')
        AND p.location IS NOT NULL
      ORDER BY distance_km
      LIMIT 10
    `)
  ).map((n) => ({
    id: n.id,
    name: n.name,
    city: n.city,
    distanceKm: n.distance_km,
  }));

  const afterPickup = ["PICKED_UP", "EN_ROUTE", "DELIVERED"].includes(x.status);
  return {
    id: x.id,
    status: x.status,
    failureReason: x.failure_reason,
    pickupOtp: x.status === "ASSIGNED" ? x.pickup_otp : null,
    dropoffOtp: afterPickup ? x.dropoff_otp : null,
    lockedUntil: iso(x.otp_locked_until),
    hasPhoto: !!x.handoff_photo_key,
    photoKey: x.handoff_photo_key,
    ngoId: x.ngo_id,
    ngoName: x.ngo_name,
    ngoIsBuyer: !!x.ngo_is_buyer,
    donation: {
      id: x.donation_id,
      title: x.title,
      status: x.donation_status,
      disposition: x.disposition,
      classification: x.food_classification,
      servings: x.estimated_servings,
      quantityKg: x.quantity_kg,
      items: x.items ?? [],
      address: x.pickup_address,
      instructions: x.pickup_instructions,
      expiresAt: iso(x.shelf_life_expires_at)!,
      donorName: x.donor_name,
      divertedReason: x.diversion_reason,
    },
    latestScan:
      x.freshness_score == null
        ? null
        : {
            score: x.freshness_score,
            status: x.scan_status,
            at: iso(x.scanned_at)!,
          },
    ngoOptions,
  };
}

// --------------------------------------------------------------------------
// NGO
// --------------------------------------------------------------------------
export interface NgoBoardItem {
  id: string;
  status: string;
  title: string;
  classification: FoodClassification;
  servings: number;
  items: DonationItem[];
  pickupAddress: string | null;
  donorName: string | null;
  volunteerName: string | null;
  photoKey: string | null;
  lockedUntil: string | null;
  freshnessScore: number | null;
  freshnessStatus: string | null;
  deliveredAt: string | null;
}

export async function getNgoBoard(ngoId: string): Promise<NgoBoardItem[]> {
  const r = await rows<Record<string, any>>(sql`
    SELECT dl.id, dl.status, dl.handoff_photo_key, dl.otp_locked_until, dl.dropoff_confirmed_at,
           d.title, d.food_classification, d.estimated_servings, d.items, d.pickup_address,
           COALESCE(dp.organization_name, dp.display_name) AS donor_name,
           vp.display_name AS volunteer_name,
           ls.freshness_score, ls.verdict AS freshness_status
    FROM deliveries dl
    JOIN donations d ON d.id = dl.donation_id
    LEFT JOIN profiles dp ON dp.user_id = d.donor_id
    LEFT JOIN profiles vp ON vp.user_id = dl.volunteer_id
    LEFT JOIN LATERAL (
      SELECT s.freshness_score, s.verdict FROM food_quality_scans s
      WHERE s.donation_id = d.id ORDER BY s.scanned_at DESC LIMIT 1
    ) ls ON true
    WHERE dl.ngo_id = ${ngoId} AND dl.status <> 'FAILED'
    ORDER BY (dl.status = 'DELIVERED'), dl.created_at DESC
    LIMIT 40
  `);
  return r.map((x) => ({
    id: x.id,
    status: x.status,
    title: x.title,
    classification: x.food_classification,
    servings: x.estimated_servings,
    items: x.items ?? [],
    pickupAddress: x.pickup_address,
    donorName: x.donor_name,
    volunteerName: x.volunteer_name,
    photoKey: x.handoff_photo_key,
    lockedUntil: iso(x.otp_locked_until),
    freshnessScore: x.freshness_score,
    freshnessStatus: x.freshness_status,
    deliveredAt: iso(x.dropoff_confirmed_at),
  }));
}
