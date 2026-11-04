/*
 * Points rules (pure).
 *   DELIVERY_COMPLETED: 10 for finishing a delivery, +1 per whole kilo carried (that part capped at 40)
 *   QUALITY_VERIFIED:   +5 when the batch's latest freshness scan was SAFE, +2 for CONSUME_SOON
 * A batch that failed its scan is never delivered, so it earns nothing.
 */
export const BASE_DELIVERY_POINTS = 10;
export const MAX_WEIGHT_POINTS = 40;

export const deliveryPoints = (kg: number): number =>
  BASE_DELIVERY_POINTS +
  Math.min(MAX_WEIGHT_POINTS, Math.max(0, Math.floor(kg)));

export const qualityPoints = (scanStatus: string | null | undefined): number =>
  scanStatus === "SAFE" ? 5 : scanStatus === "CONSUME_SOON" ? 2 : 0;

// ---- Leaderboard periods, keyed by Indian calendar date ------------------------------------
export type Period = "day" | "month" | "all";
export const PERIODS: Period[] = ["day", "month", "all"];
export const isPeriod = (v: unknown): v is Period =>
  v === "day" || v === "month" || v === "all";

const IST_OFFSET_MS = 5.5 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

export function leaderboardKey(period: Period, at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear(),
    m = pad(ist.getUTCMonth() + 1),
    d = pad(ist.getUTCDate());
  return period === "all"
    ? "lb:all"
    : period === "month"
      ? `lb:month:${y}-${m}`
      : `lb:day:${y}-${m}-${d}`;
}

/** Seconds a period key may live after it is last written (history is rebuilt from the ledger anyway). */
export const KEY_TTL_SECONDS: Record<Period, number | null> = {
  day: 3 * 86400,
  month: 70 * 86400,
  all: null,
};

export const periodLabel: Record<Period, string> = {
  day: "Today",
  month: "This month",
  all: "All time",
};

/** First instant of the period containing `at` (IST day / month), or null for all-time. */
export function periodStart(period: Period, at: Date): Date | null {
  if (period === "all") return null;
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear(),
    m = ist.getUTCMonth(),
    d = ist.getUTCDate();
  return new Date(
    (period === "month" ? Date.UTC(y, m, 1) : Date.UTC(y, m, d)) -
      IST_OFFSET_MS,
  );
}
