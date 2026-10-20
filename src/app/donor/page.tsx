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
import { formatTimeLeft } from "@/lib/urgency";
import { CLASSIFICATION_LABELS } from "@/types/donation";

export const dynamic = "force-dynamic";

export default async function DonorHomePage() {
  const user = await requireDashboardUser(["DONOR", "ADMIN"]);
  const board = await getDonorBoard(user.id);
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
        <Link href="/donor/donations/new" className={buttonVariants()}>
          List surplus food
        </Link>
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

            {!b.delivery && b.status === "LISTED" && (
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
