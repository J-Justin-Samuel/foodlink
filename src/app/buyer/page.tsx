import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { LivePrice } from "@/components/shared/live-price";
import { OtpForm } from "@/components/shared/otp-form";
import { DeliveryStatus } from "@/components/shared/status-badge";
import { confirmDropoff } from "@/lib/actions/deliveries";
import { getBuyerOrders, listLiveAuctions } from "@/lib/auction-queries";
import { requireDashboardUser } from "@/lib/guards";
import { formatMoney } from "@/lib/money";
import { paymentCurrency } from "@/lib/payments";
import { getNgoBoard } from "@/lib/queries";
import { isRealtimeConfigured } from "@/lib/realtime";
import { canTrackStatus } from "@/lib/tracking-queries";
import { formatTimeLeft } from "@/lib/urgency";
import { CLASSIFICATION_LABELS } from "@/types/donation";

export const dynamic = "force-dynamic";

export default async function BuyerHomePage() {
  const user = await requireDashboardUser(["BUYER", "ADMIN"]);
  const [{ serverNowMs, auctions }, orders, deliveries] = await Promise.all([
    listLiveAuctions(user.id),
    getBuyerOrders(user.id),
    getNgoBoard(user.id),
  ]);
  const realtime = isRealtimeConfigured();
  const currency = paymentCurrency();
  const byAuctionDelivery = new Map(deliveries.map((d) => [d.id, d]));
  const waiting = orders.some(
    (o) => o.status === "AUTHORIZED" || o.status === "CAPTURE_REQUESTED",
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8">
      <AutoRefresh everyMs={waiting ? 8000 : 30000} />

      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Surplus food auctions</h1>
          <p className="text-sm text-muted-foreground">
            Large batches of surplus food, priced to fall every 15 minutes. Buy
            early for certainty, or wait for a lower price.
          </p>
        </div>

        {auctions.length === 0 && (
          <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm">
            <p className="font-medium">No auctions are running right now.</p>
            <p className="mt-1 text-muted-foreground">
              This page updates by itself when a donor starts one.
            </p>
          </div>
        )}

        <ul className="space-y-4">
          {auctions.map((a) => (
            <li key={a.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{a.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {a.donorName ?? "Donor"} · {a.quantityKg} kg · {a.servings}{" "}
                    servings · {CLASSIFICATION_LABELS[a.classification]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTimeLeft(a.expiresAt)}
                    {a.distanceKm !== null
                      ? ` · ${a.distanceKm.toFixed(1)} km from you`
                      : ""}
                  </p>
                </div>
                <LivePrice
                  auctionId={a.id}
                  serverNowMs={serverNowMs}
                  realtime={realtime}
                  currency={currency}
                  pricing={{
                    startMinor: a.startMinor,
                    floorMinor: a.floorMinor,
                    stepMinor: a.stepMinor,
                    intervalMinutes: a.intervalMinutes,
                    startsAtMs: a.startsAtMs,
                  }}
                />
              </div>
              <Link
                href={`/buyer/auctions/${a.id}`}
                className={buttonVariants({ size: "sm" })}
              >
                View and buy
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="purchases" className="scroll-mt-20 space-y-4">
        <div>
          <h2 className="text-xl font-bold">My purchases</h2>
          <p className="text-sm text-muted-foreground">
            Your card is only held until the food arrives. When the volunteer
            shows you the drop-off code, enter it here to take the food and pay.
          </p>
        </div>
        {orders.length === 0 && (
          <p className="rounded-lg border-2 border-dashed p-6 text-center text-sm">
            You haven&apos;t bought anything yet.
          </p>
        )}
        <ul className="space-y-4">
          {orders.map((o) => {
            const run = o.deliveryId
              ? byAuctionDelivery.get(o.deliveryId)
              : undefined;
            const open =
              run && ["ASSIGNED", "PICKED_UP", "EN_ROUTE"].includes(run.status);
            return (
              <li key={o.orderId} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{o.title}</h3>
                  <span className="text-sm font-medium">
                    {formatMoney(o.amountMinor, o.currency)}
                  </span>
                  {run && <DeliveryStatus status={run.status} />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {orderLine(o.status, !!run)}
                </p>
                {run && canTrackStatus(run.status) && (
                  <Link
                    href={`/track/${run.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Track live on map
                  </Link>
                )}
                {open && run && (
                  <OtpForm
                    deliveryId={run.id}
                    action={confirmDropoff}
                    label="Drop-off code (from the volunteer)"
                    submitLabel="Confirm delivery and pay"
                    disabledReason={
                      run.status !== "PICKED_UP"
                        ? "Waiting for the volunteer to collect the food."
                        : !run.photoKey
                          ? "Waiting for the volunteer's handoff photo."
                          : undefined
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function orderLine(status: string, hasDelivery: boolean): string {
  switch (status) {
    case "AUTHORIZED":
      return hasDelivery
        ? "Card on hold. A volunteer is bringing your food."
        : "Card on hold. Waiting for a volunteer to pick the food up.";
    case "CAPTURE_REQUESTED":
    case "CAPTURED":
      return "Delivered and paid. Thank you.";
    case "VOID_REQUESTED":
    case "CANCELLED":
      return "This purchase didn't go ahead. The hold on your card is released and you weren't charged.";
    default:
      return status;
  }
}
