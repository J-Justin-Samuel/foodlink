/*
 * Reverse Dutch auction pricing. Pure functions, shared by the server (which is
 * authoritative) and the browser (which only displays).
 *
 *   price = max(floor, start - floor(elapsedMinutes / interval) * step)
 *
 * It is computed from the clock every time it is read, so nothing is written
 * to the database while the price falls. All money is in minor units (paise).
 */

export const DEFAULT_INTERVAL_MINUTES = 15;
/** The food must reach the floor price at least this long before it expires, so the charity fallback still has time to run. */
export const CHARITY_CUTOFF_MINUTES = 30;
/** Only batches heavier than this can be auctioned. */
export const MIN_AUCTION_KG = 50;

export interface AuctionPricing {
  startMinor: number;
  floorMinor: number;
  stepMinor: number;
  intervalMinutes: number;
  /** Epoch milliseconds. */
  startsAtMs: number;
}

export const toMinor = (amount: number | string): number =>
  Math.round(Number(amount) * 100);
export const fromMinor = (minor: number): number => minor / 100;

const intervalMs = (p: AuctionPricing) => p.intervalMinutes * 60_000;

/** How many price drops have happened by `nowMs` (0 before the start). */
export function tierAt(p: AuctionPricing, nowMs: number): number {
  const elapsed = nowMs - p.startsAtMs;
  return elapsed <= 0 ? 0 : Math.floor(elapsed / intervalMs(p));
}

export function priceAt(p: AuctionPricing, nowMs: number): number {
  return Math.max(p.floorMinor, p.startMinor - tierAt(p, nowMs) * p.stepMinor);
}

/** The drop number at which the price first equals the floor. */
export function floorTier(p: AuctionPricing): number {
  return Math.ceil((p.startMinor - p.floorMinor) / p.stepMinor);
}

export function floorReachedAtMs(p: AuctionPricing): number {
  return p.startsAtMs + floorTier(p) * intervalMs(p);
}

export function atFloor(p: AuctionPricing, nowMs: number): boolean {
  return priceAt(p, nowMs) <= p.floorMinor;
}

/** When the next drop happens, or null once the price is at the floor. */
export function nextDropAtMs(p: AuctionPricing, nowMs: number): number | null {
  if (atFloor(p, nowMs)) return null;
  const nowTier = tierAt(p, nowMs);
  return p.startsAtMs + (nowTier + 1) * intervalMs(p);
}

export interface AuctionTermsInput {
  startMinor: number;
  floorMinor: number;
  stepMinor: number;
  intervalMinutes: number;
  /** Food expiry, epoch ms. */
  expiresAtMs: number;
  nowMs: number;
}

/** Returns an error message for the donor, or null when the terms are sound. */
export function validateAuctionTerms(t: AuctionTermsInput): string | null {
  if (![t.startMinor, t.floorMinor, t.stepMinor].every(Number.isInteger))
    return "Prices must be whole paise amounts.";
  if (t.floorMinor < 0) return "The floor price can't be negative.";
  if (t.startMinor <= t.floorMinor)
    return "The starting price must be higher than the floor price.";
  if (t.stepMinor <= 0)
    return "The price drop per step must be more than zero.";
  if (t.stepMinor > t.startMinor - t.floorMinor)
    return "The price drop is bigger than the gap between start and floor. Use a smaller step.";
  const pricing: AuctionPricing = { ...t, startsAtMs: t.nowMs };
  const floorAt = floorReachedAtMs(pricing);
  const latest = t.expiresAtMs - CHARITY_CUTOFF_MINUTES * 60_000;
  if (floorAt > latest) {
    const needMin = Math.max(0, Math.floor((latest - t.nowMs) / 60_000));
    return `The price would reach the floor after ${Math.round((floorAt - t.nowMs) / 60_000)} minutes, but this food only leaves ${needMin} minutes before the final ${CHARITY_CUTOFF_MINUTES} minutes. Raise the step or lower the starting price.`;
  }
  return null;
}
