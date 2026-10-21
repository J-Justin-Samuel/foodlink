import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Role } from "@/types/roles";

export const ACTIVE_DELIVERY_STATUSES = [
  "ASSIGNED",
  "PICKED_UP",
  "EN_ROUTE",
] as const;

const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

export interface TrackingPoint {
  lat: number;
  lng: number;
  label: string;
  address: string | null;
}

export interface TrackingSnapshot {
  deliveryId: string;
  status: string;
  active: boolean;
  title: string;
  volunteerName: string;
  /** Who is looking: the volunteer gets the sharing controls. */
  viewer: "VOLUNTEER" | "DONOR" | "NGO" | "ADMIN";
  pickup: TrackingPoint | null;
  dropoff: TrackingPoint | null;
  /** Last shared position. Only returned while the delivery is active (privacy). */
  position: null | {
    lat: number;
    lng: number;
    heading: number | null;
    speedMps: number | null;
    at: string;
  };
}

/**
 * The tracking view of one delivery, or null if this user may not see it.
 * Access: the volunteer carrying it, the donor who listed it, the NGO it is
 * assigned to, or an admin. Nobody else — and nobody sees a volunteer's
 * location once the delivery is over.
 */
export async function getTrackingSnapshot(
  deliveryId: string,
  user: { id: string; role: Role },
): Promise<TrackingSnapshot | null> {
  const r = (await db.execute(sql`
    SELECT dl.id, dl.status, dl.volunteer_id, dl.ngo_id, d.donor_id, d.title,
           dl.last_lat, dl.last_lng, dl.last_heading, dl.last_speed_mps, dl.last_location_at,
           ST_Y(d.pickup_location::geometry) AS pickup_lat, ST_X(d.pickup_location::geometry) AS pickup_lng,
           d.pickup_address,
           COALESCE(dp.organization_name, dp.display_name, 'Donor') AS donor_name,
           ST_Y(np.location::geometry) AS ngo_lat, ST_X(np.location::geometry) AS ngo_lng,
           np.address_line AS ngo_address,
           COALESCE(np.organization_name, np.display_name) AS ngo_name,
           COALESCE(vp.display_name, 'Volunteer') AS volunteer_name
    FROM deliveries dl
    JOIN donations d ON d.id = dl.donation_id
    LEFT JOIN profiles dp ON dp.user_id = d.donor_id
    LEFT JOIN profiles np ON np.user_id = dl.ngo_id
    LEFT JOIN profiles vp ON vp.user_id = dl.volunteer_id
    WHERE dl.id = ${deliveryId}
  `)) as unknown as Record<string, any>[];
  const x = r[0];
  if (!x) return null;

  let viewer: TrackingSnapshot["viewer"] | null = null;
  if (user.role === "ADMIN") viewer = "ADMIN";
  else if (x.volunteer_id === user.id) viewer = "VOLUNTEER";
  else if (x.donor_id === user.id) viewer = "DONOR";
  else if (x.ngo_id === user.id) viewer = "NGO";
  if (!viewer) return null;

  const active = (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(
    x.status,
  );
  return {
    deliveryId: x.id,
    status: x.status,
    active,
    title: x.title,
    volunteerName: x.volunteer_name,
    viewer,
    pickup:
      x.pickup_lat == null
        ? null
        : {
            lat: x.pickup_lat,
            lng: x.pickup_lng,
            label: x.donor_name,
            address: x.pickup_address,
          },
    dropoff:
      x.ngo_lat == null
        ? null
        : {
            lat: x.ngo_lat,
            lng: x.ngo_lng,
            label: x.ngo_name ?? "NGO",
            address: x.ngo_address,
          },
    position:
      active && x.last_lat != null
        ? {
            lat: x.last_lat,
            lng: x.last_lng,
            heading: x.last_heading,
            speedMps: x.last_speed_mps,
            at: iso(x.last_location_at)!,
          }
        : null,
  };
}

export interface ActiveTrackingItem {
  deliveryId: string;
  title: string;
  status: string;
}

/** Deliveries a donor/NGO can currently watch — for the "Track" buttons. */
export function canTrackStatus(status: string | null | undefined): boolean {
  return (
    !!status && (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(status)
  );
}
