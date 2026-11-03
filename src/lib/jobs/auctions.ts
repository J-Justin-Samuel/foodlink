import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { foodAuctions } from "@/db/schema";
import { atFloor, CHARITY_CUTOFF_MINUTES, tierAt } from "@/lib/auction-price";
import { convertToFreeDonation, eventFor, pricingOf } from "@/lib/auctions";
import { publishAuctionEvent } from "@/lib/realtime";

/**
 * Tells buyers' open screens when the price steps down (once per step, per auction).
 * The price itself is never stored: this only wakes up clients so they re-sync.
 * Runs every minute; steps are 15 minutes apart, so at most one minute late.
 */
export async function publishPriceTiers(now = new Date()): Promise<number> {
  const active = await db
    .select()
    .from(foodAuctions)
    .where(eq(foodAuctions.status, "ACTIVE"));
  let published = 0;
  for (const a of active) {
    const tier = tierAt(pricingOf(a), now.getTime());
    if (tier <= a.lastPublishedTier) continue;
    // The conditional UPDATE makes overlapping runs publish each step only once.
    const claimed = await db
      .update(foodAuctions)
      .set({ lastPublishedTier: tier })
      .where(
        and(
          eq(foodAuctions.id, a.id),
          eq(foodAuctions.status, "ACTIVE"),
          sql`${foodAuctions.lastPublishedTier} < ${tier}`,
        ),
      )
      .returning({ id: foodAuctions.id });
    if (claimed.length === 0) continue;
    await publishAuctionEvent(eventFor("TIER", a, now.getTime()));
    published++;
  }
  return published;
}

export interface FallbackResult {
  converted: string[];
  skipped: number;
}

/**
 * Auto-charity fallback. An auction that has already fallen to its floor price,
 * still has no buyer, and is within 30 minutes of the food's expiry is cancelled and the
 * batch becomes an ordinary free donation, so volunteers can take it to an NGO while
 * there is still time. (Terms are validated so the floor is always reached at least 30
 * minutes before expiry.) A buyer who is mid-checkout or has paid is never overridden.
 */
export async function runCharityFallback(
  now = new Date(),
): Promise<FallbackResult> {
  const nowMs = now.getTime();
  const cutoffIso = new Date(
    nowMs + CHARITY_CUTOFF_MINUTES * 60_000,
  ).toISOString();
  const candidates = await db
    .select()
    .from(foodAuctions)
    .where(
      and(
        eq(foodAuctions.status, "ACTIVE"),
        sql`${foodAuctions.endsAt} <= ${cutoffIso}::timestamptz`,
        gt(foodAuctions.endsAt, now),
      ),
    );

  const result: FallbackResult = { converted: [], skipped: 0 };
  for (const a of candidates) {
    if (!atFloor(pricingOf(a), nowMs)) {
      result.skipped++;
      continue;
    }
    const res = await db.transaction((tx) =>
      convertToFreeDonation(
        tx,
        a.id,
        "No buyer came by the charity cutoff, so the food was given away free.",
      ),
    );
    if (res.ok) {
      result.converted.push(a.id);
      await publishAuctionEvent(res.event);
    } else {
      result.skipped++;
    }
  }
  return result;
}
