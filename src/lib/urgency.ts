/**
 * Mirror of the SQL priority formula in `findNearbyDonations`:
 *   10 / max(hoursUntilExpiry, 0.5) + 10 / max(distanceKm, 1.0)
 * The database is the source of truth for ranking; this exists so the UI can
 * classify a score without another round trip.
 */
export function urgencyScore(hoursUntilExpiry: number, distanceKm: number) {
  return 10 / Math.max(hoursUntilExpiry, 0.5) + 10 / Math.max(distanceKm, 1.0);
}

export type UrgencyTier = "CRITICAL" | "HIGH" | "NORMAL";

export function urgencyTier(score: number): UrgencyTier {
  if (score >= 10) return "CRITICAL";
  if (score >= 5) return "HIGH";
  return "NORMAL";
}

export const TIER_META: Record<
  UrgencyTier,
  { label: string; hex: string; badgeClass: string }
> = {
  CRITICAL: {
    label: "Urgent",
    hex: "#dc2626",
    badgeClass: "bg-red-100 text-red-800",
  },
  HIGH: {
    label: "Soon",
    hex: "#d97706",
    badgeClass: "bg-amber-100 text-amber-800",
  },
  NORMAL: {
    label: "Relaxed",
    hex: "#16a34a",
    badgeClass: "bg-green-100 text-green-800",
  },
};

export function formatTimeLeft(expiresAtIso: string, now = Date.now()) {
  const ms = new Date(expiresAtIso).getTime() - now;
  if (ms <= 0) return "Expired";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}
