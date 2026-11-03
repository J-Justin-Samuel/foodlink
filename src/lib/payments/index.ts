import "server-only";
import type { ConnectProvider, PaymentProvider } from "./types";
import { mockConnect, mockProvider } from "./mock";
import {
  createStripeConnect,
  createStripeProvider,
  makeStripe,
} from "./stripe";

export type PaymentsMode = "stripe" | "mock" | "off";

/**
 * PAYMENTS_MODE=mock  -> local fake payments (refused in production unless ALLOW_MOCK_PAYMENTS=true)
 * STRIPE_SECRET_KEY   -> real Stripe
 * neither             -> payments are off and auctions can't be bought
 */
export function paymentsMode(): PaymentsMode {
  const mock = process.env.PAYMENTS_MODE === "mock";
  if (
    mock &&
    (process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_MOCK_PAYMENTS === "true")
  )
    return "mock";
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  return "off";
}

export const paymentCurrency = () =>
  (process.env.PAYMENT_CURRENCY ?? "inr").toLowerCase();

let cached: { provider: PaymentProvider; connect: ConnectProvider } | null =
  null;
let cachedKey = "";

export function getPayments(): {
  provider: PaymentProvider;
  connect: ConnectProvider;
} {
  const mode = paymentsMode();
  if (mode === "off") throw new PaymentsOffError();
  const key = mode + (process.env.STRIPE_SECRET_KEY ?? "");
  if (cached && cachedKey === key) return cached;
  if (mode === "mock") {
    cached = { provider: mockProvider, connect: mockConnect };
  } else {
    // STRIPE_API_BASE_URL is only for pointing at Stripe's local test server (stripe-mock); leave it unset normally.
    const base = process.env.STRIPE_API_BASE_URL
      ? new URL(process.env.STRIPE_API_BASE_URL)
      : null;
    const stripe = makeStripe(
      process.env.STRIPE_SECRET_KEY!,
      base
        ? {
            host: base.hostname,
            port: Number(base.port) || 80,
            protocol: base.protocol === "https:" ? "https" : "http",
          }
        : {},
    );
    cached = {
      provider: createStripeProvider(stripe),
      connect: createStripeConnect(
        stripe,
        process.env.STRIPE_CONNECT_COUNTRY ?? "IN",
      ),
    };
  }
  cachedKey = key;
  return cached;
}

export class PaymentsOffError extends Error {
  constructor() {
    super("Payments aren't set up on this server yet.");
    this.name = "PaymentsOffError";
  }
}
