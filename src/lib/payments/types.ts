export type HoldState =
  | "requires_payment"
  | "authorized"
  | "captured"
  | "canceled"
  | "failed";

/**
 * What the escrow code needs from a payment company. Stripe is the real
 * implementation; "mock" is an in-memory stand-in for local development.
 * (Razorpay Route could be added by implementing this same interface.)
 */
export interface PaymentProvider {
  readonly name: "stripe" | "mock";
  /** Creates a hold: the buyer's card is checked and the money reserved, but not taken. */
  createHold(input: {
    orderId: string;
    auctionId: string;
    amountMinor: number;
    currency: string;
    buyerEmail: string;
  }): Promise<{ ref: string; clientSecret: string }>;
  getHoldState(ref: string): Promise<{ state: HoldState; chargeId?: string }>;
  /** Releases a hold. Safe to call twice. */
  cancelHold(ref: string): Promise<void>;
  /** Takes the money. Safe to call twice for the same order. */
  captureHold(input: {
    ref: string;
    amountMinor: number;
    orderId: string;
  }): Promise<{ chargeId: string }>;
  /** Moves money from the platform to a connected account. Safe to call twice for the same order. */
  transfer(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    destinationAccountId: string;
    chargeId: string;
  }): Promise<{ transferId: string }>;
}

export interface PayoutAccountStatus {
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
}

/** Donor payout accounts (Stripe Connect Express). */
export interface ConnectProvider {
  createAccount(input: {
    userId: string;
    email: string;
  }): Promise<{ accountId: string }>;
  createOnboardingLink(input: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }>;
  getAccountStatus(accountId: string): Promise<PayoutAccountStatus>;
}
