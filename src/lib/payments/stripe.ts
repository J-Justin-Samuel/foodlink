import "server-only";
import Stripe from "stripe";
import type { ConnectProvider, HoldState, PaymentProvider } from "./types";

/*
 * Stripe implementation: separate charges and transfers.
 *   hold     = PaymentIntent with capture_method "manual" (card authorised, not charged)
 *   capture  = capture the PaymentIntent on delivery
 *   split    = Transfer of the donor's share to their Connected account
 * The remaining 25% (volunteer reimbursement + platform fee) stays in the
 * platform balance and is tracked in payout_ledger.
 * Every write carries an idempotency key built from the order id, so retries
 * after a crash can never charge or pay twice.
 */

export interface StripeOptions {
  host?: string;
  port?: number;
  protocol?: "http" | "https";
}

export function makeStripe(
  secretKey: string,
  opts: StripeOptions = {},
): Stripe {
  return new Stripe(secretKey, { maxNetworkRetries: 2, ...opts });
}

const mapState = (s: Stripe.PaymentIntent.Status): HoldState => {
  switch (s) {
    case "requires_capture":
      return "authorized";
    case "succeeded":
      return "captured";
    case "canceled":
      return "canceled";
    default:
      return "requires_payment";
  }
};

const chargeIdOf = (pi: Stripe.PaymentIntent): string | undefined =>
  typeof pi.latest_charge === "string"
    ? pi.latest_charge
    : pi.latest_charge?.id;

export function createStripeProvider(stripe: Stripe): PaymentProvider {
  return {
    name: "stripe",
    async createHold({
      orderId,
      auctionId,
      amountMinor,
      currency,
      buyerEmail,
    }) {
      const pi = await stripe.paymentIntents.create(
        {
          amount: amountMinor,
          currency,
          capture_method: "manual",
          automatic_payment_methods: { enabled: true },
          transfer_group: `order_${orderId}`,
          receipt_email: buyerEmail,
          metadata: { orderId, auctionId },
        },
        { idempotencyKey: `hold-${orderId}` },
      );
      if (!pi.client_secret)
        throw new Error("Stripe returned no client secret.");
      return { ref: pi.id, clientSecret: pi.client_secret };
    },
    async getHoldState(ref) {
      const pi = await stripe.paymentIntents.retrieve(ref);
      return { state: mapState(pi.status), chargeId: chargeIdOf(pi) };
    },
    async cancelHold(ref) {
      try {
        await stripe.paymentIntents.cancel(ref);
      } catch (err) {
        // Already cancelled is fine; anything else is a real problem.
        const pi = await stripe.paymentIntents.retrieve(ref).catch(() => null);
        if (pi?.status !== "canceled") throw err;
      }
    },
    async captureHold({ ref, amountMinor, orderId }) {
      const pi = await stripe.paymentIntents.capture(
        ref,
        { amount_to_capture: amountMinor },
        { idempotencyKey: `capture-${orderId}` },
      );
      const chargeId = chargeIdOf(pi);
      if (!chargeId)
        throw new Error("Stripe captured the payment but returned no charge.");
      return { chargeId };
    },
    async transfer({
      orderId,
      amountMinor,
      currency,
      destinationAccountId,
      chargeId,
    }) {
      const t = await stripe.transfers.create(
        {
          amount: amountMinor,
          currency,
          destination: destinationAccountId,
          transfer_group: `order_${orderId}`,
          source_transaction: chargeId,
          metadata: { orderId, kind: "DONOR_PAYOUT" },
        },
        { idempotencyKey: `transfer-donor-${orderId}` },
      );
      return { transferId: t.id };
    },
  };
}

export function createStripeConnect(
  stripe: Stripe,
  country: string,
): ConnectProvider {
  return {
    async createAccount({ userId, email }) {
      const acct = await stripe.accounts.create({
        type: "express",
        country,
        email,
        capabilities: { transfers: { requested: true } },
        metadata: { userId },
      });
      return { accountId: acct.id };
    },
    async createOnboardingLink({ accountId, returnUrl, refreshUrl }) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: "account_onboarding",
      });
      return { url: link.url };
    },
    async getAccountStatus(accountId) {
      const a = await stripe.accounts.retrieve(accountId);
      return {
        detailsSubmitted: !!a.details_submitted,
        payoutsEnabled: !!a.payouts_enabled,
      };
    },
  };
}
