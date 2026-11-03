import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { GiveAwayFreeButton } from "@/components/shared/donor-auction-actions";
import { LivePrice } from "@/components/shared/live-price";
import { MIN_AUCTION_KG } from "@/lib/auction-price";
import { paymentCurrency } from "@/lib/payments";
import { isRealtimeConfigured } from "@/lib/realtime";
import { formatMoney } from "@/lib/money";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { OtpForm } from "@/components/shared/otp-form";
import {
  DeliveryStatus,
  DonationStatus,
  FreshnessBadge,
} from "@/components/shared/status-badge";
import { confirmPickup } from "@/lib/actions/deliveries";
import { DISPOSITION_LABELS, type Disposition } from "@/lib/freshness";
import { requireDashboardUser } from "@/lib/guards";
import { getDonorBoard } from "@/lib/queries";
import { canTrackStatus } from "@/lib/tracking-queries";
import { formatTimeLeft } from "@/lib/urgency";
import { CLASSIFICATION_LABELS } from "@/types/donation";

export const dynamic = "force-dynamic";

export default async function DonorHomePage() {
  const user = await requireDashboardUser(["DONOR", "ADMIN"]);
  const board = await getDonorBoard(user.id);
  const realtime = isRealtimeConfigured();
  const currency = paymentCurrency();
  const nowMs = Date.now();
  const waiting = board.some((b) => b.delivery?.status === "ASSIGNED");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {(waiting ||
        board.some((b) => b.delivery && b.delivery.status !== "DELIVERED")) && (
        <AutoRefresh everyMs={8000} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My donations</h1>
          <p className="text-sm text-muted-foreground">
            When a volunteer arrives, enter the 6-digit code they show you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/donor/payouts"
            className={buttonVariants({ variant: "outline" })}
          >
            Payouts
          </Link>
          <Link href="/donor/donations/new" className={buttonVariants()}>
            List surplus food
          </Link>
        </div>
      </div>

      {board.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <p className="font-medium">You haven&apos;t listed any food yet.</p>
          <Link
            href="/donor/donations/new"
            className={`${buttonVariants()} mt-4`}
          >
            List your first batch
          </Link>
        </div>
      )}

      <ul className="space-y-4">
        {board.map((b) => (
          <li key={b.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{b.title}</h2>
              <DonationStatus status={b.status} />
              {b.freshnessStatus && b.freshnessScore !== null && (
                <FreshnessBadge
                  status={b.freshnessStatus}
                  score={b.freshnessScore}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {CLASSIFICATION_LABELS[b.classification]} · {b.servings} servings
              · {formatTimeLeft(b.expiresAt)}
            </p>

            {b.status === "DIVERTED" && (
              <p className="rounded-md border-2 border-destructive p-3 text-sm">
                This batch failed a freshness check and was reclassified for{" "}
                {DISPOSITION_LABELS[
                  b.disposition as Disposition
                ]?.toLowerCase() ?? "other use"}
                . It will not be given out as food.
              </p>
            )}

            {b.delivery && (
              <div className="space-y-3 border-t pt-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span>
                    Volunteer <strong>{b.delivery.volunteerName}</strong>
                    {b.delivery.ngoName ? (
                      <>
                        {" "}
                        is taking this to <strong>{b.delivery.ngoName}</strong>
                      </>
                    ) : null}
                  </span>
                  <DeliveryStatus status={b.delivery.status} />
                </p>
                {canTrackStatus(b.delivery.status) && (
                  <Link
                    href={`/track/${b.delivery.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Track live on map
                  </Link>
                )}
                {b.delivery.status === "ASSIGNED" && (
                  <OtpForm
                    deliveryId={b.delivery.id}
                    action={confirmPickup}
                    label="Pickup code (ask the volunteer)"
                    submitLabel="Confirm pickup"
                  />
                )}
                {b.delivery.status === "PICKED_UP" && (
                  <p className="font-medium">Picked up. Thank you.</p>
                )}
                {b.delivery.status === "DELIVERED" && (
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Delivered to the NGO.
                  </p>
                )}
              </div>
            )}

            {b.auction && (
              <div className="space-y-3 border-t pt-3 text-sm">
                {b.auction.status === "ACTIVE" && (
                  <>
                    <p className="font-medium">
                      Auction running. The price falls every{" "}
                      {b.auction.intervalMinutes} minutes.
                    </p>
                    <LivePrice
                      auctionId={b.auction.id}
                      serverNowMs={nowMs}
                      realtime={realtime}
                      currency={currency}
                      pricing={{
                        startMinor: b.auction.startMinor,
                        floorMinor: b.auction.floorMinor,
                        stepMinor: b.auction.stepMinor,
                        intervalMinutes: b.auction.intervalMinutes,
                        startsAtMs: b.auction.startsAtMs,
                      }}
                    />
                    {b.auction.orderStatus === "PENDING_PAYMENT" && (
                      <p className="text-muted-foreground">
                        A buyer is paying right now.
                      </p>
                    )}
                    {b.auction.orderStatus === null && (
                      <GiveAwayFreeButton auctionId={b.auction.id} />
                    )}
                  </>
                )}
                {b.auction.status === "SOLD" && (
                  <p className="font-medium">
                    Sold for{" "}
                    {b.auction.finalMinor !== null
                      ? formatMoney(b.auction.finalMinor, currency)
                      : "the auction price"}
                    .{" "}
                    {b.auction.orderStatus === "CAPTURED"
                      ? "The buyer has paid and your share is on its way."
                      : "The buyer pays when the delivery arrives."}
                  </p>
                )}
                {b.auction.status === "CANCELLED" && (
                  <p className="text-muted-foreground">
                    Auction ended without a sale. {b.auction.cancelReason ?? ""}
                  </p>
                )}
                {b.auction.status === "EXPIRED" && (
                  <p className="text-muted-foreground">
                    The auction ended when the food expired.
                  </p>
                )}
              </div>
            )}

            {!b.delivery &&
              !b.auction &&
              b.status === "LISTED" &&
              b.quantityKg > MIN_AUCTION_KG && (
                <div className="space-y-1 border-t pt-3">
                  <p className="text-sm text-muted-foreground">
                    Over {MIN_AUCTION_KG} kg, so you can sell it to recover
                    costs.
                  </p>
                  <Link
                    href={`/donor/auctions/new?donationId=${b.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Sell by auction
                  </Link>
                </div>
              )}

            {!b.delivery &&
              b.status === "LISTED" &&
              b.auction?.status !== "ACTIVE" && (
                <p className="text-sm text-muted-foreground">
                  Waiting for a volunteer to claim it.
                </p>
              )}
          </li>
        ))}
      </ul>
    </main>
  );
}
