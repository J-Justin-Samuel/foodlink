import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { GiveAwayFreeButton } from "@/components/shared/donor-auction-actions";
import { FoodPhoto } from "@/components/shared/food-photo";
import {
  EmptyState,
  NextStep,
  QuickLinks,
  StatTiles,
} from "@/components/shared/hub";
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
import { getDonorBoard, type DonorBoardItem } from "@/lib/queries";
import { canTrackStatus } from "@/lib/tracking-queries";
import { formatTimeLeft } from "@/lib/urgency";
import { CLASSIFICATION_LABELS } from "@/types/donation";

export const dynamic = "force-dynamic";

const isActive = (b: DonorBoardItem) =>
  b.status === "LISTED" ||
  b.status === "CLAIMED" ||
  b.status === "IN_TRANSIT" ||
  (!!b.delivery &&
    b.delivery.status !== "DELIVERED" &&
    b.delivery.status !== "FAILED" &&
    b.status !== "DELIVERED");

export default async function DonorHomePage() {
  const user = await requireDashboardUser(["DONOR", "ADMIN"]);
  const board = await getDonorBoard(user.id);
  const realtime = isRealtimeConfigured();
  const currency = paymentCurrency();
  const nowMs = Date.now();

  const active = board.filter(isActive);
  const past = board.filter((b) => !isActive(b));
  const delivered = board.filter((b) => b.status === "DELIVERED");
  const waitingPickup = active.filter((b) => b.delivery?.status === "ASSIGNED");
  const kg = delivered.reduce((n, b) => n + b.quantityKg, 0);
  const meals = Math.floor(Math.round(kg * 100) / 40);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
      {active.length > 0 && <AutoRefresh everyMs={8000} />}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Donor home</h1>
          <p className="text-sm text-muted-foreground">
            List surplus food, hand it to a volunteer, and see where it ends up.
          </p>
        </div>
        <Link
          href="/donor/donations/new"
          className={buttonVariants({ size: "lg" })}
        >
          List surplus food
        </Link>
      </header>

      {waitingPickup.length > 0 ? (
        <NextStep
          tone="urgent"
          title={`${waitingPickup.length === 1 ? "A volunteer is coming for" : `${waitingPickup.length} volunteers are coming for`} ${waitingPickup[0].title}${waitingPickup.length > 1 ? " and more" : ""}`}
          body="When they arrive, enter the 6-digit pickup code they show you."
          href={`#donation-${waitingPickup[0].id}`}
          cta="Enter pickup code"
        />
      ) : board.length === 0 ? (
        <NextStep
          title="Start with your first batch"
          body="It takes about two minutes. Take a photo, add what's in it, and nearby volunteers are alerted."
          href="/donor/donations/new"
          cta="List your first batch"
        />
      ) : null}

      <StatTiles
        items={[
          { value: active.length, label: "Active listings" },
          { value: delivered.length, label: "Delivered" },
          {
            value: kg.toLocaleString("en-IN", { maximumFractionDigits: 1 }),
            label: "kg rescued",
            href: "/donor/impact",
          },
          {
            value: meals.toLocaleString("en-IN"),
            label: "meals",
            href: "/donor/impact",
          },
        ]}
      />

      <section className="space-y-4" aria-labelledby="active-h">
        <h2 id="active-h" className="text-lg font-bold">
          Active listings
        </h2>
        {active.length === 0 && board.length > 0 && (
          <EmptyState
            title="Nothing is active right now."
            body="List a new batch when you have surplus food."
            href="/donor/donations/new"
            cta="List surplus food"
          />
        )}
        {board.length === 0 && (
          <EmptyState title="You haven't listed any food yet." />
        )}
        <ul className="space-y-4">
          {active.map((b) => (
            <DonationCard
              key={b.id}
              b={b}
              nowMs={nowMs}
              realtime={realtime}
              currency={currency}
            />
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section className="space-y-4" aria-labelledby="past-h">
          <h2 id="past-h" className="text-lg font-bold">
            Past listings
          </h2>
          <ul className="space-y-4">
            {past.map((b) => (
              <DonationCard
                key={b.id}
                b={b}
                nowMs={nowMs}
                realtime={realtime}
                currency={currency}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="more-h">
        <h2 id="more-h" className="text-lg font-bold">
          More
        </h2>
        <QuickLinks
          items={[
            {
              href: "/donor/impact",
              label: "Impact and reports",
              hint: "CO2, water, meals, quarterly PDFs",
            },
            {
              href: "/donor/payouts",
              label: "Payouts",
              hint: "Bank details for auction sales",
            },
            { href: "/support", label: "Help", hint: "Report a problem" },
          ]}
        />
      </section>
    </main>
  );
}

function DonationCard({
  b,
  nowMs,
  realtime,
  currency,
}: {
  b: DonorBoardItem;
  nowMs: number;
  realtime: boolean;
  currency: string;
}) {
  return (
    <li
      id={`donation-${b.id}`}
      className="scroll-mt-20 space-y-3 rounded-lg border p-4"
    >
      <div className="flex gap-4">
        <FoodPhoto
          src={b.photos[0]}
          alt={`Photo of ${b.title}`}
          className="h-24 w-28 shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{b.title}</h3>
            <DonationStatus status={b.status} />
            {b.freshnessStatus && b.freshnessScore !== null && (
              <FreshnessBadge
                status={b.freshnessStatus}
                score={b.freshnessScore}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {CLASSIFICATION_LABELS[b.classification]} · {b.servings} servings ·{" "}
            {b.quantityKg} kg · {formatTimeLeft(b.expiresAt)}
          </p>
        </div>
      </div>

      {b.status === "DIVERTED" && (
        <p className="rounded-md border-2 border-destructive p-3 text-sm">
          This batch failed a freshness check and was reclassified for{" "}
          {DISPOSITION_LABELS[b.disposition as Disposition]?.toLowerCase() ??
            "other use"}
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
              className={buttonVariants({ variant: "outline", size: "sm" })}
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
              Over {MIN_AUCTION_KG} kg, so you can sell it to recover costs.
            </p>
            <Link
              href={`/donor/auctions/new?donationId=${b.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
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
  );
}
