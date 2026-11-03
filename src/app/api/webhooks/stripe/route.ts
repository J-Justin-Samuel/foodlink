import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/escrow";
import { makeStripe } from "@/lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 * Stripe calls this when a buyer's card is authorised or a payout account changes.
 * The body is verified with STRIPE_WEBHOOK_SECRET before anything is trusted.
 * The same work is also done when the buyer returns to the site and by a
 * background job, so a missed webhook is harmless.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key)
    return NextResponse.json(
      { error: "Webhooks are not configured." },
      { status: 503 },
    );

  const signature = req.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const raw = await req.text(); // the signature covers the exact raw bytes
  let event;
  try {
    event = makeStripe(key).webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (err) {
    console.error("Stripe webhook handler failed:", err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 }); // Stripe retries
  }
}
