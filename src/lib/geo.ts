/* Small, pure geography helpers shared by server and browser. */

export interface LatLng {
  lat: number;
  lng: number;
}

export function isValidLatLng(p: { lat: unknown; lng: unknown }): p is LatLng {
  return (
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle (straight-line) distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** City driving speed used when the routing service is unavailable. */
export const FALLBACK_SPEED_KMH = 20;

/**
 * Rough ETA from straight-line distance. Roads are longer than the crow flies,
 * so the distance is padded by 30%. Only used as a fallback for Mapbox Directions.
 */
export function fallbackEtaSeconds(
  from: LatLng,
  to: LatLng,
  speedKmh = FALLBACK_SPEED_KMH,
): number {
  const km = haversineKm(from, to) * 1.3;
  return Math.round((km / speedKmh) * 3600);
}

/** "Arriving", "5 min", "1 h 10 min". */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return "Arriving";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "350 m" or "4.2 km". */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "—";
  return km < 1
    ? `${Math.round((km * 1000) / 10) * 10} m`
    : `${km.toFixed(1)} km`;
}

/** How long ago a timestamp was, for "updated 12 s ago" labels. */
export function ageSeconds(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
}
