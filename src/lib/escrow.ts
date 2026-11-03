import "server-only";
import type Stripe from "stripe";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auctionOrders,
  deliveries,
  donations,
  foodAuctions,
  payoutAccounts,
  payoutLedger,
} from "@/db/schema";
import { eventFor } from "@/lib/auctions";
import { splitAmount } from "@/lib/escrow-split";
import { getPayments, paymentsMode } from "@/lib/payments";
import { publishAuctionEvent } from "@/lib/realtime";

/*
 * Escrow: hold -> (delivery confirmed) -> capture -> 75/15/10 split.
 *
 * Every step that talks to the payment company happens OUTSIDE a database
 * transaction, and every step is safe to repeat (status guards here, idempotency
 * keys at Stripe). The delivery code only records "CAPTURE_REQUESTED" in its own
 * transaction; settleOrder() — or the reconcile job if the server died in between
 * — does the rest. So a crash can delay money, but never lose it or move it twice.
 *
 * Lock order across the app: donation -> auction -> order.
 */

export const RESERVATION_MINUTES = 5;
const BATCH = 50;
const log = (...a: unknown[]) => console.error("[escrow]", ...a);

export type OrderOutcome =
  | "SOLD"
  | "PENDING"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED"
  | "NOT_FOUND";

// ---------------------------------------------------------------------------
// Hold confirmed -> the buyer wins the auction
// ---------------------------------------------------------------------------
export async function finalizeAuthorization(
  orderId: string,
): Promise<OrderOutcome> {
  const [order] = await db
    .select()
    .from(auctionOrders)
    .where(eq(auctionOrders.id, orderId));
  if (!order) return "NOT_FOUND";
  if (["AUTHORIZED", "CAPTURE_REQUESTED", "CAPTURED"].includes(order.status))
    return "SOLD";
  if (order.status === "EXPIRED") return "EXPIRED";
  if (order.status === "FAILED") return "FAILED";
  if (order.status !== "PENDING_PAYMENT") return "CANCELLED";
  if (!order.providerRef) return "PENDING";

  const { provider } = getPayments();
  const hold = await provider.getHoldState(order.providerRef);
  if (hold.state === "requires_payment") return "PENDING";
  if (hold.state === "failed" || hold.state === "canceled") {
    await db
      .update(auctionOrders)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(
        and(
          eq(auctionOrders.id, orderId),
          eq(auctionOrders.status, "PENDING_PAYMENT"),
        ),
      );
    return "FAILED";
  }

  const result = await db.transaction(
    async (
      tx,
    ): Promise<{
      outcome: OrderOutcome;
      event?: ReturnType<typeof eventFor>;
    }> => {
      const [a] = await tx
        .select()
        .from(foodAuctions)
        .where(eq(foodAuctions.id, order.auctionId))
        .for("update");
      const [o] = await tx
        .select()
        .from(auctionOrders)
        .where(eq(auctionOrders.id, orderId))
        .for("update");
      if (!a || !o) return { outcome: "NOT_FOUND" };
      if (o.status !== "PENDING_PAYMENT") {
        return {
          outcome: ["AUTHORIZED", "CAPTURE_REQUESTED", "CAPTURED"].includes(
            o.status,
          )
            ? "SOLD"
            : o.status === "EXPIRED"
              ? "EXPIRED"
              : "CANCELLED",
        };
      }
      const now = new Date();
      if (a.status !== "ACTIVE") {
        // The buyer's card was authorised but the auction closed (spoiled / ended): give the money back.
        await tx
          .update(auctionOrders)
          .set({
            status: "VOID_REQUESTED",
            voidReason: "The auction ended before payment finished.",
            updatedAt: now,
          })
          .where(eq(auctionOrders.id, orderId));
        return { outcome: "CANCELLED" };
      }
      await tx
        .update(auctionOrders)
        .set({ status: "AUTHORIZED", authorizedAt: now, updatedAt: now })
        .where(eq(auctionOrders.id, orderId));
      await tx
        .update(foodAuctions)
        .set({
          status: "SOLD",
          winningBuyerId: o.buyerId,
          finalPrice: (o.amountMinor / 100).toFixed(2),
          soldAt: now,
        })
        .where(eq(foodAuctions.id, a.id));
      return { outcome: "SOLD", event: eventFor("SOLD", a, now.getTime()) };
    },
  );

  if (result.event)
    await publishAuctionEvent({
      ...result.event,
      priceMinor: order.amountMinor,
    });
  if (result.outcome === "CANCELLED")
    await processVoids().catch((e) => log("void failed", e));
  return result.outcome;
}

// ---------------------------------------------------------------------------
// Releasing holds
// ---------------------------------------------------------------------------
export async function processVoids(limit = BATCH): Promise<number> {
  const pending = await db
    .select()
    .from(auctionOrders)
    .where(eq(auctionOrders.status, "VOID_REQUESTED"))
    .limit(limit);
  if (pending.length === 0) return 0;
  let done = 0;
  for (const o of pending) {
    try {
      if (o.providerRef) await getPayments().provider.cancelHold(o.providerRef);
      const upd = await db
        .update(auctionOrders)
        .set({
          status: "CANCELLED",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(auctionOrders.id, o.id),
            eq(auctionOrders.status, "VOID_REQUESTED"),
          ),
        )
        .returning({ id: auctionOrders.id });
      done += upd.length;
    } catch (err) {
      log("could not release hold", o.id, err); // stays VOID_REQUESTED; retried next run
    }
  }
  return done;
}

// ---------------------------------------------------------------------------
// Delivery confirmed -> capture and split
// ---------------------------------------------------------------------------
export type SettleResult =
  | "NOTHING"
  | "CAPTURED"
  | "SETTLED"
  | "WAITING_FOR_PAYOUT_ACCOUNT"
  | "RETRY";

export async function settleOrder(orderId: string): Promise<SettleResult> {
  let [o] = await db
    .select()
    .from(auctionOrders)
    .where(eq(auctionOrders.id, orderId));
  if (!o) return "NOTHING";
  const { provider } = getPayments();

  if (o.status === "CAPTURE_REQUESTED") {
    if (!o.providerRef) return "RETRY";
    let chargeId: string;
    try {
      ({ chargeId } = await provider.captureHold({
        ref: o.providerRef,
        amountMinor: o.amountMinor,
        orderId,
      }));
    } catch (err) {
      log("capture failed", orderId, err);
      return "RETRY";
    }
    const [auction] = await db
      .select()
      .from(foodAuctions)
      .where(eq(foodAuctions.id, o.auctionId));
    const [donation] = await db
      .select()
      .from(donations)
      .where(eq(donations.id, auction.donationId));
    const [delivery] = await db
      .select({ volunteerId: deliveries.volunteerId })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.donationId, donation.id),
          eq(deliveries.status, "DELIVERED"),
        ),
      )
      .limit(1);
    const split = splitAmount(o.amountMinor);
    const now = new Date();
    await db.transaction(async (tx) => {
      const upd = await tx
        .update(auctionOrders)
        .set({
          status: "CAPTURED",
          capturedAt: now,
          chargeId,
          donorMinor: split.donorMinor,
          volunteerMinor: split.volunteerMinor,
          platformMinor: split.platformMinor,
          updatedAt: now,
        })
        .where(
          and(
            eq(auctionOrders.id, orderId),
            eq(auctionOrders.status, "CAPTURE_REQUESTED"),
          ),
        )
        .returning({ id: auctionOrders.id });
      if (upd.length === 0) return;
      await tx
        .insert(payoutLedger)
        .values([
          {
            orderId,
            userId: donation.donorId,
            kind: "DONOR_PAYOUT",
            amountMinor: split.donorMinor,
            currency: o.currency,
            status: "PENDING",
          },
          {
            orderId,
            userId: delivery?.volunteerId ?? null,
            kind: "VOLUNTEER_REIMBURSEMENT",
            amountMinor: split.volunteerMinor,
            currency: o.currency,
            status: "PENDING",
          },
          {
            orderId,
            userId: null,
            kind: "PLATFORM_FEE",
            amountMinor: split.platformMinor,
            currency: o.currency,
            status: "RECORDED",
          },
        ])
        .onConflictDoNothing();
    });
    [o] = await db
      .select()
      .from(auctionOrders)
      .where(eq(auctionOrders.id, orderId));
  }

  if (o.status === "CAPTURED" && o.donorMinor != null && !o.donorTransferId) {
    const [auction] = await db
      .select()
      .from(foodAuctions)
      .where(eq(foodAuctions.id, o.auctionId));
    const [donation] = await db
      .select()
      .from(donations)
      .where(eq(donations.id, auction.donationId));
    const [acct] = await db
      .select()
      .from(payoutAccounts)
      .where(eq(payoutAccounts.userId, donation.donorId));
    if (!acct?.payoutsEnabled || !o.chargeId)
      return "WAITING_FOR_PAYOUT_ACCOUNT";
    let transferId: string;
    try {
      ({ transferId } = await provider.transfer({
        orderId,
        amountMinor: o.donorMinor,
        currency: o.currency,
        destinationAccountId: acct.providerAccountId,
        chargeId: o.chargeId,
      }));
    } catch (err) {
      log("donor transfer failed", orderId, err);
      return "RETRY";
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(auctionOrders)
        .set({
          donorTransferId: transferId,
          donorTransferredAt: now,
          settledAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(auctionOrders.id, orderId),
            isNull(auctionOrders.donorTransferId),
          ),
        );
      await tx
        .update(payoutLedger)
        .set({ status: "PAID", providerRef: transferId, paidAt: now })
        .where(
          and(
            eq(payoutLedger.orderId, orderId),
            eq(payoutLedger.kind, "DONOR_PAYOUT"),
          ),
        );
    });
    return "SETTLED";
  }
  return o.status === "CAPTURED" ? "SETTLED" : "NOTHING";
}

/** Called right after a delivery is confirmed. Never throws: the reconcile job retries. */
export async function settleOrdersForDonation(
  donationId: string,
): Promise<void> {
  try {
    if (paymentsMode() === "off") return;
    const rows = await db
      .select({ id: auctionOrders.id })
      .from(auctionOrders)
      .innerJoin(foodAuctions, eq(foodAuctions.id, auctionOrders.auctionId))
      .where(
        and(
          eq(foodAuctions.donationId, donationId),
          eq(auctionOrders.status, "CAPTURE_REQUESTED"),
        ),
      );
    for (const r of rows) await settleOrder(r.id);
  } catch (err) {
    log("settle after delivery failed; will be retried", err);
  }
}

// ---------------------------------------------------------------------------
// Background reconcile (every 5 minutes)
// ---------------------------------------------------------------------------
export interface ReconcileResult {
  reservationsExpired: number;
  lateAuthorizations: number;
  holdsReleased: number;
  settled: number;
}

export async function reconcileEscrow(
  now = new Date(),
): Promise<ReconcileResult> {
  const out: ReconcileResult = {
    reservationsExpired: 0,
    lateAuthorizations: 0,
    holdsReleased: 0,
    settled: 0,
  };
  if (paymentsMode() === "off") return out;

  const stale = await db
    .select()
    .from(auctionOrders)
    .where(
      and(
        eq(auctionOrders.status, "PENDING_PAYMENT"),
        lt(auctionOrders.reservedUntil, now),
      ),
    )
    .limit(BATCH);
  for (const o of stale) {
    try {
      if (o.providerRef) {
        const hold = await getPayments().provider.getHoldState(o.providerRef);
        if (hold.state === "authorized") {
          // The buyer finished paying but nobody confirmed it (closed the tab, webhook missed): honour it.
          if ((await finalizeAuthorization(o.id)) === "SOLD")
            out.lateAuthorizations++;
          continue;
        }
      }
      const upd = await db
        .update(auctionOrders)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(
          and(
            eq(auctionOrders.id, o.id),
            eq(auctionOrders.status, "PENDING_PAYMENT"),
          ),
        )
        .returning({ id: auctionOrders.id });
      if (upd.length && o.providerRef)
        await getPayments()
          .provider.cancelHold(o.providerRef)
          .catch((e) => log("cancel stale hold", e));
      out.reservationsExpired += upd.length;
    } catch (err) {
      log("stale reservation handling failed", o.id, err);
    }
  }

  out.holdsReleased = await processVoids();

  const toSettle = await db
    .select({ id: auctionOrders.id })
    .from(auctionOrders)
    .where(
      sql`${auctionOrders.status} = 'CAPTURE_REQUESTED' OR (${auctionOrders.status} = 'CAPTURED' AND ${auctionOrders.donorTransferId} IS NULL AND ${auctionOrders.donorMinor} IS NOT NULL)`,
    )
    .limit(BATCH);
  for (const r of toSettle) {
    const res = await settleOrder(r.id);
    if (res === "SETTLED") out.settled++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stripe webhooks (the backup path when the buyer's browser never reports back)
// ---------------------------------------------------------------------------
export async function handleStripeEvent(
  event: Stripe.Event,
): Promise<"handled" | "ignored"> {
  switch (event.type) {
    case "payment_intent.amount_capturable_updated": {
      const pi = event.data.object;
      const [o] = await db
        .select({ id: auctionOrders.id })
        .from(auctionOrders)
        .where(eq(auctionOrders.providerRef, pi.id));
      if (!o) return "ignored";
      await finalizeAuthorization(o.id);
      return "handled";
    }
    case "payment_intent.canceled": {
      const pi = event.data.object;
      await db
        .update(auctionOrders)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(
          and(
            eq(auctionOrders.providerRef, pi.id),
            eq(auctionOrders.status, "PENDING_PAYMENT"),
          ),
        );
      return "handled";
    }
    case "account.updated": {
      const a = event.data.object;
      await db
        .update(payoutAccounts)
        .set({
          detailsSubmitted: !!a.details_submitted,
          payoutsEnabled: !!a.payouts_enabled,
          updatedAt: new Date(),
        })
        .where(eq(payoutAccounts.providerAccountId, a.id));
      return "handled";
    }
    default:
      return "ignored";
  }
}
