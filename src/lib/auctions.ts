import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auctionOrders, donations, foodAuctions } from "@/db/schema";
import {
  priceAt,
  nextDropAtMs,
  tierAt,
  toMinor,
  type AuctionPricing,
} from "@/lib/auction-price";
import type { AuctionEvent } from "@/lib/realtime";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const LIVE_ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "AUTHORIZED",
  "CAPTURE_REQUESTED",
  "CAPTURED",
] as const;

export function pricingOf(a: {
  startPrice: string;
  reservePrice: string;
  decrementStep: string | null;
  intervalMinutes: number;
  startsAt: Date;
}): AuctionPricing {
  return {
    startMinor: toMinor(a.startPrice),
    floorMinor: toMinor(a.reservePrice),
    stepMinor: toMinor(a.decrementStep ?? "0"),
    intervalMinutes: a.intervalMinutes,
    startsAtMs: a.startsAt.getTime(),
  };
}

export function eventFor(
  type: AuctionEvent["type"],
  a: {
    id: string;
    startPrice: string;
    reservePrice: string;
    decrementStep: string | null;
    intervalMinutes: number;
    startsAt: Date;
  },
  now = Date.now(),
): AuctionEvent {
  const p = pricingOf(a);
  const closed = type === "SOLD" || type === "CANCELLED" || type === "EXPIRED";
  const next = closed ? null : nextDropAtMs(p, now);
  return {
    type,
    auctionId: a.id,
    priceMinor: priceAt(p, now),
    tier: tierAt(p, now),
    nextDropAt: next ? new Date(next).toISOString() : null,
    at: new Date(now).toISOString(),
  };
}

/**
 * Ends an auction because the food can no longer be sold (spoiled, expired).
 * Any order still waiting for payment or holding a payment hold is marked
 * VOID_REQUESTED so the money is released by the escrow job.
 * The caller must already hold the donation's row lock (lock order: donation, auction, order).
 */
export async function closeAuctionForDonation(
  tx: Tx,
  donationId: string,
  status: "EXPIRED" | "CANCELLED",
  reason: string,
): Promise<AuctionEvent | null> {
  const [a] = await tx
    .select()
    .from(foodAuctions)
    .where(eq(foodAuctions.donationId, donationId))
    .for("update");
  if (!a || !["ACTIVE", "SOLD", "SCHEDULED"].includes(a.status)) return null;
  const now = new Date();
  await tx
    .update(auctionOrders)
    .set({ status: "VOID_REQUESTED", voidReason: reason, updatedAt: now })
    .where(
      and(
        eq(auctionOrders.auctionId, a.id),
        inArray(auctionOrders.status, ["PENDING_PAYMENT", "AUTHORIZED"]),
      ),
    );
  await tx
    .update(foodAuctions)
    .set({ status, cancelledAt: now, cancelReason: reason })
    .where(eq(foodAuctions.id, a.id));
  return eventFor(status, a, now.getTime());
}

export type ConvertResult =
  | { ok: true; donationId: string; event: AuctionEvent }
  | { ok: false; reason: string };

/**
 * Turns an unsold auction into an ordinary free donation: the auction is
 * cancelled and the batch becomes claimable by volunteers again, to be
 * delivered to an NGO. Refuses while a buyer is mid-checkout or has paid.
 */
export async function convertToFreeDonation(
  tx: Tx,
  auctionId: string,
  reason: string,
): Promise<ConvertResult> {
  const [pre] = await tx
    .select({ donationId: foodAuctions.donationId })
    .from(foodAuctions)
    .where(eq(foodAuctions.id, auctionId));
  if (!pre) return { ok: false, reason: "Auction not found." };
  const [donation] = await tx
    .select()
    .from(donations)
    .where(eq(donations.id, pre.donationId))
    .for("update");
  const [a] = await tx
    .select()
    .from(foodAuctions)
    .where(eq(foodAuctions.id, auctionId))
    .for("update");
  if (!donation || !a) return { ok: false, reason: "Auction not found." };
  if (a.status !== "ACTIVE")
    return { ok: false, reason: "This auction is no longer running." };
  const live = await tx
    .select({ id: auctionOrders.id })
    .from(auctionOrders)
    .where(
      and(
        eq(auctionOrders.auctionId, a.id),
        inArray(auctionOrders.status, [...LIVE_ORDER_STATUSES]),
      ),
    )
    .limit(1);
  if (live.length > 0)
    return { ok: false, reason: "A buyer is checking out right now." };

  const now = new Date();
  await tx
    .update(foodAuctions)
    .set({ status: "CANCELLED", cancelledAt: now, cancelReason: reason })
    .where(eq(foodAuctions.id, a.id));
  // expiryAlertedAt = null so the Stage 4 watchdog announces it to nearby volunteers.
  await tx
    .update(donations)
    .set({ isBulkAuction: false, expiryAlertedAt: null, updatedAt: now })
    .where(eq(donations.id, donation.id));
  return {
    ok: true,
    donationId: donation.id,
    event: eventFor("CANCELLED", a, now.getTime()),
  };
}
