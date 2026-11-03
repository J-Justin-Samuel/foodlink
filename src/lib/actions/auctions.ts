"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  auctionOrders,
  deliveries,
  donations,
  foodAuctions,
} from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import {
  isUniqueViolation,
  toFailure,
  validationFailure,
} from "@/lib/action-utils";
import {
  DEFAULT_INTERVAL_MINUTES,
  MIN_AUCTION_KG,
  priceAt,
  toMinor,
  validateAuctionTerms,
} from "@/lib/auction-price";
import {
  convertToFreeDonation,
  eventFor,
  LIVE_ORDER_STATUSES,
  pricingOf,
} from "@/lib/auctions";
import { buyerCanBuy } from "@/lib/buyer-eligibility";
import {
  finalizeAuthorization,
  processVoids,
  RESERVATION_MINUTES,
} from "@/lib/escrow";
import { getPayments, paymentCurrency, paymentsMode } from "@/lib/payments";
import { mockAuthorize } from "@/lib/payments/mock";
import { getPayoutState } from "@/lib/payouts";
import { publishAuctionEvent } from "@/lib/realtime";
import {
  auctionIdSchema,
  createAuctionSchema,
  orderIdSchema,
  startPurchaseSchema,
} from "@/lib/validations/stage5";
import type { ActionFailure, ActionResult } from "@/types/action-result";

const fail = (code: ActionFailure["code"], error: string): ActionFailure => ({
  ok: false,
  code,
  error,
});
const ACTIVE_DELIVERY = ["ASSIGNED", "PICKED_UP", "EN_ROUTE"] as const;

// ---------------------------------------------------------------------------
// Donor: start an auction for a batch over 50 kg
// ---------------------------------------------------------------------------
export async function createAuction(
  input: unknown,
): Promise<ActionResult<{ auctionId: string }>> {
  try {
    const user = await requireRole(["DONOR"]);
    const parsed = createAuctionSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const d = parsed.data;

    if (paymentsMode() === "off")
      return fail(
        "CONFLICT",
        "Payments aren't set up on this server yet, so auctions can't start.",
      );
    const payout = await getPayoutState(user.id);
    if (payout.state !== "READY") {
      return fail(
        "CONFLICT",
        "Set up your payout account first, so the sale money has somewhere to go.",
      );
    }

    const startMinor = toMinor(d.startPrice);
    const floorMinor = toMinor(d.reservePrice);
    const stepMinor = toMinor(d.decrementStep);

    const outcome = await db.transaction(
      async (
        tx,
      ): Promise<
        | ActionFailure
        | { ok: true; id: string; event: ReturnType<typeof eventFor> }
      > => {
        const [donation] = await tx
          .select()
          .from(donations)
          .where(eq(donations.id, d.donationId))
          .for("update");
        if (!donation || donation.donorId !== user.id)
          return fail("NOT_FOUND", "Donation not found.");
        if (donation.status !== "LISTED")
          return fail(
            "CONFLICT",
            "Only a batch that is still waiting for a volunteer can be auctioned.",
          );
        const now = Date.now();
        if (donation.shelfLifeExpiresAt.getTime() <= now)
          return fail("EXPIRED", "This batch has expired.");
        if (Number(donation.quantityKg) <= MIN_AUCTION_KG) {
          return fail(
            "VALIDATION",
            `Auctions are for batches over ${MIN_AUCTION_KG} kg. This one is ${donation.quantityKg} kg.`,
          );
        }
        const [existing] = await tx
          .select({ id: foodAuctions.id })
          .from(foodAuctions)
          .where(eq(foodAuctions.donationId, donation.id));
        if (existing)
          return fail("CONFLICT", "This batch already has an auction.");
        const active = await tx
          .select({ id: deliveries.id })
          .from(deliveries)
          .where(
            and(
              eq(deliveries.donationId, donation.id),
              inArray(deliveries.status, [...ACTIVE_DELIVERY]),
            ),
          )
          .limit(1);
        if (active.length > 0)
          return fail("CONFLICT", "A volunteer already took this batch.");

        const problem = validateAuctionTerms({
          startMinor,
          floorMinor,
          stepMinor,
          intervalMinutes: DEFAULT_INTERVAL_MINUTES,
          expiresAtMs: donation.shelfLifeExpiresAt.getTime(),
          nowMs: now,
        });
        if (problem) return fail("VALIDATION", problem);

        const startsAt = new Date(now);
        const [a] = await tx
          .insert(foodAuctions)
          .values({
            donationId: donation.id,
            startPrice: (startMinor / 100).toFixed(2),
            reservePrice: (floorMinor / 100).toFixed(2),
            decrementStep: (stepMinor / 100).toFixed(2),
            intervalMinutes: DEFAULT_INTERVAL_MINUTES,
            status: "ACTIVE",
            startsAt,
            endsAt: donation.shelfLifeExpiresAt,
          })
          .returning();
        await tx
          .update(donations)
          .set({ isBulkAuction: true, updatedAt: startsAt })
          .where(eq(donations.id, donation.id));
        return { ok: true, id: a.id, event: eventFor("CREATED", a, now) };
      },
    );
    if (!outcome.ok) return outcome;

    await publishAuctionEvent(outcome.event);
    revalidatePath("/donor");
    revalidatePath("/buyer");
    return { ok: true, data: { auctionId: outcome.id } };
  } catch (err) {
    if (isUniqueViolation(err))
      return fail("CONFLICT", "This batch already has an auction.");
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Donor: stop the auction and give the food away free instead
// ---------------------------------------------------------------------------
export async function giveAwayFree(
  input: unknown,
): Promise<ActionResult<{ donationId: string }>> {
  try {
    const user = await requireRole(["DONOR"]);
    const parsed = auctionIdSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);

    const [owned] = await db
      .select({ id: foodAuctions.id })
      .from(foodAuctions)
      .innerJoin(donations, eq(donations.id, foodAuctions.donationId))
      .where(
        and(
          eq(foodAuctions.id, parsed.data.auctionId),
          eq(donations.donorId, user.id),
        ),
      );
    if (!owned) return fail("NOT_FOUND", "Auction not found.");

    const res = await db.transaction((tx) =>
      convertToFreeDonation(
        tx,
        owned.id,
        "The donor chose to give the food away free.",
      ),
    );
    if (!res.ok) return fail("CONFLICT", res.reason);
    await publishAuctionEvent(res.event);
    revalidatePath("/donor");
    revalidatePath("/buyer");
    revalidatePath("/volunteer/discover");
    return { ok: true, data: { donationId: res.donationId } };
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Buyer: "Buy now" — reserve the price and open a payment hold
// ---------------------------------------------------------------------------
export interface Checkout {
  orderId: string;
  amountMinor: number;
  currency: string;
  /** ISO time the price is held until. */
  reservedUntil: string;
  provider: "stripe" | "mock";
  clientSecret: string;
}

export async function startPurchase(
  input: unknown,
): Promise<ActionResult<Checkout>> {
  try {
    const user = await requireRole(["BUYER"]);
    const why = buyerCanBuy(user);
    if (why) return fail("FORBIDDEN", why);
    const parsed = startPurchaseSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { auctionId, expectedPriceMinor } = parsed.data;
    if (paymentsMode() === "off")
      return fail("CONFLICT", "Payments aren't set up on this server yet.");
    const { provider } = getPayments();

    const reserved = await db.transaction(
      async (
        tx,
      ): Promise<
        | ActionFailure
        | {
            ok: true;
            orderId: string;
            amount: number;
            until: Date;
            staleRefs: string[];
          }
      > => {
        // The auction row lock serialises simultaneous buyers: one wins, the rest see the live order.
        const [a] = await tx
          .select()
          .from(foodAuctions)
          .where(eq(foodAuctions.id, auctionId))
          .for("update");
        if (!a) return fail("NOT_FOUND", "Auction not found.");
        if (a.status === "SOLD")
          return fail("CONFLICT", "Someone else just bought this batch.");
        if (a.status !== "ACTIVE")
          return fail("CONFLICT", "This auction has ended.");
        const [d] = await tx
          .select({ status: donations.status })
          .from(donations)
          .where(eq(donations.id, a.donationId));
        const nowMs = Date.now();
        if (a.endsAt.getTime() <= nowMs)
          return fail("EXPIRED", "This auction has ended.");
        if (d?.status !== "LISTED")
          return fail("CONFLICT", "This batch is no longer available.");

        const price = priceAt(pricingOf(a), nowMs);
        if (expectedPriceMinor < price)
          return fail(
            "CONFLICT",
            "The price changed. Refresh the page and try again.",
          );

        const staleRefs: string[] = [];
        const live = await tx
          .select()
          .from(auctionOrders)
          .where(
            and(
              eq(auctionOrders.auctionId, a.id),
              inArray(auctionOrders.status, [...LIVE_ORDER_STATUSES]),
            ),
          )
          .for("update");
        for (const o of live) {
          const lapsed =
            o.status === "PENDING_PAYMENT" &&
            (o.buyerId === user.id ||
              (o.reservedUntil?.getTime() ?? 0) < nowMs);
          if (!lapsed)
            return fail(
              "CONFLICT",
              "Another buyer is checking out right now. Try again in a few minutes.",
            );
          await tx
            .update(auctionOrders)
            .set({ status: "EXPIRED", updatedAt: new Date() })
            .where(eq(auctionOrders.id, o.id));
          if (o.providerRef) staleRefs.push(o.providerRef);
        }

        const until = new Date(nowMs + RESERVATION_MINUTES * 60_000);
        const [order] = await tx
          .insert(auctionOrders)
          .values({
            auctionId: a.id,
            buyerId: user.id,
            amountMinor: price,
            currency: paymentCurrency(),
            provider: provider.name,
            reservedUntil: until,
          })
          .returning({ id: auctionOrders.id });
        return { ok: true, orderId: order.id, amount: price, until, staleRefs };
      },
    );
    if (!reserved.ok) return reserved;

    for (const ref of reserved.staleRefs)
      await provider
        .cancelHold(ref)
        .catch((e) => console.error("cancel stale hold", e));

    try {
      const hold = await provider.createHold({
        orderId: reserved.orderId,
        auctionId,
        amountMinor: reserved.amount,
        currency: paymentCurrency(),
        buyerEmail: user.email,
      });
      await db
        .update(auctionOrders)
        .set({ providerRef: hold.ref, updatedAt: new Date() })
        .where(eq(auctionOrders.id, reserved.orderId));
      return {
        ok: true,
        data: {
          orderId: reserved.orderId,
          amountMinor: reserved.amount,
          currency: paymentCurrency(),
          reservedUntil: reserved.until.toISOString(),
          provider: provider.name,
          clientSecret: hold.clientSecret,
        },
      };
    } catch (err) {
      console.error("createHold failed:", err);
      // Free the slot at once so the next buyer isn't blocked.
      await db
        .update(auctionOrders)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(auctionOrders.id, reserved.orderId));
      return fail(
        "UNKNOWN",
        "We couldn't start the payment. Please try again.",
      );
    }
  } catch (err) {
    if (isUniqueViolation(err))
      return fail(
        "CONFLICT",
        "Another buyer is checking out right now. Try again in a few minutes.",
      );
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Buyer: the card form finished — confirm the hold and win the auction
// ---------------------------------------------------------------------------
export async function confirmAuthorization(
  input: unknown,
): Promise<ActionResult<{ status: "SOLD" | "PENDING" }>> {
  try {
    const user = await requireRole(["BUYER"]);
    const parsed = orderIdSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const [order] = await db
      .select()
      .from(auctionOrders)
      .where(
        and(
          eq(auctionOrders.id, parsed.data.orderId),
          eq(auctionOrders.buyerId, user.id),
        ),
      );
    if (!order) return fail("NOT_FOUND", "Order not found.");

    const outcome = await finalizeAuthorization(order.id);
    revalidatePath("/buyer");
    switch (outcome) {
      case "SOLD":
        return { ok: true, data: { status: "SOLD" } };
      case "PENDING":
        return { ok: true, data: { status: "PENDING" } };
      case "EXPIRED":
        return fail(
          "EXPIRED",
          "Your reservation ran out before the payment finished. You haven't been charged.",
        );
      case "FAILED":
        return fail(
          "CONFLICT",
          "The payment didn't go through. You haven't been charged.",
        );
      default:
        return fail(
          "CONFLICT",
          "This auction ended before the payment finished. Your card hold is being released.",
        );
    }
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Local development only: pretend the buyer entered a test card
// ---------------------------------------------------------------------------
export async function payWithTestCard(
  input: unknown,
): Promise<ActionResult<{ status: "SOLD" | "PENDING" }>> {
  try {
    if (paymentsMode() !== "mock")
      return fail("FORBIDDEN", "Test payments are switched off.");
    const user = await requireRole(["BUYER"]);
    const parsed = orderIdSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const [order] = await db
      .select()
      .from(auctionOrders)
      .where(
        and(
          eq(auctionOrders.id, parsed.data.orderId),
          eq(auctionOrders.buyerId, user.id),
        ),
      );
    if (!order?.providerRef) return fail("NOT_FOUND", "Order not found.");
    mockAuthorize(order.providerRef);
    return confirmAuthorization(input);
  } catch (err) {
    return toFailure(err);
  }
}

/** The buyer abandons checkout: free the slot and release the hold. */
export async function cancelCheckout(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["BUYER"]);
    const parsed = orderIdSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const upd = await db
      .update(auctionOrders)
      .set({
        status: "VOID_REQUESTED",
        voidReason: "The buyer cancelled checkout.",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(auctionOrders.id, parsed.data.orderId),
          eq(auctionOrders.buyerId, user.id),
          eq(auctionOrders.status, "PENDING_PAYMENT"),
        ),
      )
      .returning({ id: auctionOrders.id });
    if (upd.length) await processVoids().catch(() => {});
    return { ok: true, data: undefined };
  } catch (err) {
    return toFailure(err);
  }
}
