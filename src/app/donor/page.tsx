import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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
  const waiting = board.some((b) => b.delivery?.status === "ASSIGNED");

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
      {(waiting ||
        board.some((b) => b.delivery && b.delivery.status !== "DELIVERED")) && (
        <AutoRefresh everyMs={8000} />
      )}

      {/* Header and Hero Action */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-forest">
            Donor Operations
          </h1>
          <p className="mt-1 text-sm text-charcoal/70">
            Active donations, assigned pickups, and handoff code verifications.
          </p>
        </div>
        <Link
          href="/donor/donations/new"
          className={buttonVariants({ variant: "cta", size: "default" })}
        >
          + List New Surplus Food
        </Link>
      </div>

      {board.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-soft text-orange-vibrant">
            🍱
          </div>
          <h3 className="mt-4 text-base font-bold text-forest">
            No surplus food listed yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-charcoal/70">
            Have excess cooked meals or raw produce? Post a batch to alert
            nearby volunteers.
          </p>
          <Link
            href="/donor/donations/new"
            className={`${buttonVariants({ variant: "cta" })} mt-5`}
          >
            Create Your First Listing
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {board.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-orange-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-forest text-lg">
                    {b.title}
                  </span>
                  <DonationStatus status={b.status} />
                  {b.freshnessStatus && b.freshnessScore !== null && (
                    <FreshnessBadge
                      status={b.freshnessStatus}
                      score={b.freshnessScore}
                    />
                  )}
                </div>

                <div className="rounded-full bg-soft-gray px-3 py-1 font-mono text-xs font-semibold text-charcoal">
                  Expires in: {formatTimeLeft(b.expiresAt)}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-charcoal/70">
                <span>
                  <strong>Category:</strong>{" "}
                  {CLASSIFICATION_LABELS[b.classification]}
                </span>
                <span>
                  <strong>Estimated:</strong> {b.servings} servings
                </span>
              </div>

              {b.status === "DIVERTED" && (
                <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                  Batch reclassified for{" "}
                  {DISPOSITION_LABELS[
                    b.disposition as Disposition
                  ]?.toLowerCase() ?? "secondary use"}{" "}
                  due to biochemical test thresholds.
                </div>
              )}

              {b.delivery && (
                <div className="mt-4 space-y-3 rounded-lg border border-orange-100 bg-orange-soft/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      Courier:{" "}
                      <strong className="text-forest">
                        {b.delivery.volunteerName}
                      </strong>
                      {b.delivery.ngoName && (
                        <span>
                          {" "}
                          → Destination:{" "}
                          <strong className="text-forest">
                            {b.delivery.ngoName}
                          </strong>
                        </span>
                      )}
                    </div>
                    <DeliveryStatus status={b.delivery.status} />
                  </div>

                  {canTrackStatus(b.delivery.status) && (
                    <div className="pt-1">
                      <Link
                        href={`/track/${b.delivery.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        📍 View Volunteer Live Route
                      </Link>
                    </div>
                  )}

                  {b.delivery.status === "ASSIGNED" && (
                    <div className="mt-2 rounded-lg border border-orange-200 bg-white p-3">
                      <OtpForm
                        deliveryId={b.delivery.id}
                        action={confirmPickup}
                        label="Enter Volunteer Handoff Code"
                        submitLabel="Authorize Collection"
                      />
                    </div>
                  )}

                  {b.delivery.status === "PICKED_UP" && (
                    <p className="text-xs font-bold text-forest">
                      ✓ Package picked up and in transit.
                    </p>
                  )}

                  {b.delivery.status === "DELIVERED" && (
                    <p className="text-xs font-bold text-fresh">
                      ✓ Safely delivered to recipient shelter.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
