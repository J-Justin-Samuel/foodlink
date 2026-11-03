import "server-only";
import { randomUUID } from "node:crypto";
import type { ConnectProvider, HoldState, PaymentProvider } from "./types";

/*
 * Local-development stand-in for Stripe (PAYMENTS_MODE=mock). It remembers
 * holds in memory, so a server restart forgets them. Never used in production.
 */
interface MockHold {
  state: HoldState;
  amountMinor: number;
}
const g = globalThis as unknown as {
  __foodlinkMock?: {
    holds: Map<string, MockHold>;
    captured: Map<string, string>;
    transfers: Map<string, string>;
  };
};
const store = (g.__foodlinkMock ??= {
  holds: new Map(),
  captured: new Map(),
  transfers: new Map(),
});

/** Simulates the buyer entering a test card. Used by the mock checkout button and by tests. */
export function mockAuthorize(ref: string): boolean {
  const h = store.holds.get(ref);
  if (!h || h.state !== "requires_payment") return false;
  h.state = "authorized";
  return true;
}
export function mockFail(ref: string) {
  const h = store.holds.get(ref);
  if (h) h.state = "failed";
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createHold({ amountMinor }) {
    const ref = `mock_pi_${randomUUID()}`;
    store.holds.set(ref, { state: "requires_payment", amountMinor });
    return { ref, clientSecret: `${ref}_secret` };
  },
  async getHoldState(ref) {
    const h = store.holds.get(ref);
    return {
      state: h?.state ?? "requires_payment",
      chargeId: store.captured.get(ref),
    };
  },
  async cancelHold(ref) {
    const h = store.holds.get(ref);
    if (h && h.state !== "captured") h.state = "canceled";
  },
  async captureHold({ ref, orderId }) {
    const done = store.captured.get(orderId);
    if (done) return { chargeId: done };
    const h = store.holds.get(ref);
    if (h?.state === "canceled" || h?.state === "failed")
      throw new Error("The hold is no longer active.");
    const chargeId = `mock_ch_${randomUUID()}`;
    if (h) h.state = "captured";
    store.captured.set(orderId, chargeId);
    store.captured.set(ref, chargeId);
    return { chargeId };
  },
  async transfer({ orderId, destinationAccountId }) {
    const key = `${orderId}:${destinationAccountId}`;
    const existing = store.transfers.get(key);
    if (existing) return { transferId: existing };
    const transferId = `mock_tr_${randomUUID()}`;
    store.transfers.set(key, transferId);
    return { transferId };
  },
};

export const mockConnect: ConnectProvider = {
  async createAccount({ userId }) {
    return { accountId: `mock_acct_${userId.slice(0, 8)}` };
  },
  async createOnboardingLink({ returnUrl }) {
    return { url: returnUrl };
  },
  async getAccountStatus() {
    return { detailsSubmitted: true, payoutsEnabled: true };
  },
};
