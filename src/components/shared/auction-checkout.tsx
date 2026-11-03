"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import {
  cancelCheckout,
  confirmAuthorization,
  payWithTestCard,
  startPurchase,
  type Checkout,
} from "@/lib/actions/auctions";
import { formatMoney } from "@/lib/money";
import { useAuctionClock, type LivePricingProps } from "./live-price";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= loadStripe(key);
  return stripePromise;
};

interface Props extends LivePricingProps {
  mode: "stripe" | "mock";
  /** Reasons the buyer can't buy (not verified, etc.), already worded for the user. */
  blockedReason?: string | null;
}

/** Live price + "Buy now" + card step. Nothing is charged: the card is only held until the drop-off code is entered. */
export function AuctionCheckout(props: Props) {
  const { mode, blockedReason, auctionId, currency } = props;
  const router = useRouter();
  const clock = useAuctionClock(props);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"SOLD" | "PENDING" | null>(null);
  const [pending, start] = useTransition();

  function buy() {
    setError(null);
    start(async () => {
      const res = await startPurchase({
        auctionId,
        expectedPriceMinor: clock.priceMinor,
      });
      if (res.ok) setCheckout(res.data);
      else {
        setError(res.error);
        router.refresh();
      }
    });
  }

  function testCard() {
    if (!checkout) return;
    setError(null);
    start(async () => {
      const res = await payWithTestCard({ orderId: checkout.orderId });
      if (res.ok) {
        setDone(res.data.status);
        router.refresh();
      } else setError(res.error);
    });
  }

  function giveUp() {
    if (!checkout) return;
    const id = checkout.orderId;
    setCheckout(null);
    start(async () => {
      await cancelCheckout({ orderId: id });
      router.refresh();
    });
  }

  if (done) {
    return (
      <div
        role="status"
        className="space-y-2 rounded-lg border-2 border-green-600 p-4"
      >
        <p className="font-semibold">
          {done === "SOLD" ? "It's yours." : "Payment is being confirmed."}
        </p>
        <p className="text-sm text-muted-foreground">
          {done === "SOLD"
            ? "Your card is on hold, not charged. It is charged when the delivery arrives and you enter the drop-off code from the volunteer."
            : "This page will update in a moment. You haven't been charged."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-4xl font-black tabular-nums">
          {formatMoney(clock.priceMinor, currency)}
        </p>
        <p className="text-sm text-muted-foreground" role="timer">
          {clock.secondsToDrop === null
            ? "This is the lowest price. If nobody buys, the food is given away free."
            : `Drops to ${formatMoney(clock.nextDropMinor!, currency)} in ${Math.floor(clock.secondsToDrop / 60)}:${String(clock.secondsToDrop % 60).padStart(2, "0")}`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {clock.link === "live"
            ? "Live updates on."
            : "Price is calculated on your device and re-checked by the server when you buy."}
        </p>
      </div>

      {!checkout && (
        <>
          <Button
            onClick={buy}
            disabled={pending || !!blockedReason}
            className="h-12 w-full text-base"
          >
            {pending
              ? "Reserving…"
              : `Buy now for ${formatMoney(clock.priceMinor, currency)}`}
          </Button>
          {blockedReason && (
            <p className="text-sm text-destructive">{blockedReason}</p>
          )}
        </>
      )}

      {checkout && (
        <div className="space-y-3 rounded-lg border-2 p-4">
          <p className="text-sm">
            We are holding this price for{" "}
            <strong>
              {formatMoney(checkout.amountMinor, checkout.currency)}
            </strong>{" "}
            for 5 minutes. Your card is only <strong>held</strong>, and is
            charged after delivery.
          </p>
          {checkout.provider === "mock" ? (
            <div className="space-y-2">
              <p className="rounded-md bg-muted p-2 text-xs">
                Test mode: no real card is used.
              </p>
              <Button onClick={testCard} disabled={pending} className="w-full">
                {pending ? "Holding…" : "Pay with test card"}
              </Button>
            </div>
          ) : (
            <StripeForm
              checkout={checkout}
              onAuthorized={async () => {
                const res = await confirmAuthorization({
                  orderId: checkout.orderId,
                });
                if (res.ok) {
                  setDone(res.data.status);
                  router.refresh();
                } else setError(res.error);
              }}
              onError={setError}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={giveUp}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {mode === "mock" && !checkout && (
        <p className="text-xs text-muted-foreground">
          Test mode: payments are simulated.
        </p>
      )}
    </div>
  );
}

function StripeForm({
  checkout,
  onAuthorized,
  onError,
}: {
  checkout: Checkout;
  onAuthorized: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const stripe = getStripe();
  if (!stripe)
    return (
      <p className="text-sm text-destructive">
        Card payments aren&apos;t configured (missing publishable key).
      </p>
    );
  return (
    <Elements stripe={stripe} options={{ clientSecret: checkout.clientSecret }}>
      <InnerForm onAuthorized={onAuthorized} onError={onError} />
    </Elements>
  );
}

function InnerForm({
  onAuthorized,
  onError,
}: {
  onAuthorized: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    onError("");
    // The PaymentIntent uses manual capture, so success here means the money is on hold ("requires_capture").
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (error) {
      onError(error.message ?? "The card was declined.");
      setBusy(false);
      return;
    }
    if (
      paymentIntent &&
      (paymentIntent.status === "requires_capture" ||
        paymentIntent.status === "processing")
    ) {
      await onAuthorized();
    } else {
      onError("The payment needs another step. Please try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || busy} className="w-full">
        {busy ? "Holding…" : "Hold payment"}
      </Button>
    </form>
  );
}
