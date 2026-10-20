import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";

/** Uniformly random 6-digit code (000000–999999) from the OS CSPRNG. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Two codes for one delivery; guaranteed different from each other. */
export function generateOtpPair(): { pickup: string; dropoff: string } {
  const pickup = generateOtp();
  let dropoff = generateOtp();
  while (dropoff === pickup) dropoff = generateOtp();
  return { pickup, dropoff };
}

/** Constant-time comparison so response timing can't leak digits. */
export function otpMatches(
  expected: string | null | undefined,
  provided: string,
): boolean {
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
