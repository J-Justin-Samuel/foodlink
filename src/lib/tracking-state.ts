import { haversineKm, type LatLng } from "@/lib/geo";

/* Pure decisions behind the live map, kept out of the component so they can be tested. */

export type TargetKind = "PICKUP" | "DROPOFF";

/** Where the volunteer is heading right now: the donor until the food is collected, then the NGO. */
export function pickTarget<P extends LatLng>(
  status: string,
  pickup: P | null,
  dropoff: P | null,
): { kind: TargetKind; point: P } | null {
  if (status === "ASSIGNED")
    return pickup ? { kind: "PICKUP", point: pickup } : null;
  if (status === "PICKED_UP" || status === "EN_ROUTE")
    return dropoff ? { kind: "DROPOFF", point: dropoff } : null;
  return null;
}

export type Health = "WAITING" | "LIVE" | "STALE";

/** WAITING: nothing shared yet. LIVE: recent fix. STALE: the last fix is older than `staleAfterSec`. */
export function trackingHealth(
  lastAtIso: string | null,
  nowMs: number,
  staleAfterSec: number,
): Health {
  if (!lastAtIso) return "WAITING";
  const age = (nowMs - new Date(lastAtIso).getTime()) / 1000;
  return age > staleAfterSec ? "STALE" : "LIVE";
}

export const ROUTE_MIN_MOVE_METERS = 150;
export const ROUTE_MAX_AGE_MS = 30_000;

/**
 * Whether to ask the routing service for a fresh route/ETA: first time, the
 * destination changed, the vehicle moved >150 m, or the last answer is >30 s old.
 * Keeps requests (and cost) low while the ETA still tracks the trip.
 */
export function shouldRefetchRoute(
  last: null | { from: LatLng; kind: TargetKind; atMs: number },
  now: { from: LatLng; kind: TargetKind; atMs: number },
): boolean {
  if (!last) return true;
  if (last.kind !== now.kind) return true;
  if (now.atMs - last.atMs >= ROUTE_MAX_AGE_MS) return true;
  return haversineKm(last.from, now.from) * 1000 >= ROUTE_MIN_MOVE_METERS;
}

/** Keeps only finite, in-range heading/speed values coming from the browser's geolocation. */
export function cleanMotion(
  heading: number | null | undefined,
  speed: number | null | undefined,
) {
  const h =
    typeof heading === "number" &&
    Number.isFinite(heading) &&
    heading >= 0 &&
    heading <= 360
      ? heading
      : null;
  const s =
    typeof speed === "number" &&
    Number.isFinite(speed) &&
    speed >= 0 &&
    speed <= 120
      ? speed
      : null;
  return { heading: h, speedMps: s };
}

/** "Waiting for…", "Live", "Signal lost 2 min ago" label for the status chip. */
export function healthLabel(
  health: Health,
  lastAtIso: string | null,
  nowMs: number,
): string {
  if (health === "WAITING")
    return "Waiting for the volunteer to share their location";
  if (health === "LIVE") return "Live";
  const secs = Math.round((nowMs - new Date(lastAtIso!).getTime()) / 1000);
  return secs < 90
    ? `Signal lost ${secs} s ago`
    : `Signal lost ${Math.round(secs / 60)} min ago`;
}
