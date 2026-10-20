import { AutoRefresh } from "@/components/shared/auto-refresh";
import { OtpForm } from "@/components/shared/otp-form";
import {
  DeliveryStatus,
  FreshnessBadge,
} from "@/components/shared/status-badge";
import { confirmDropoff } from "@/lib/actions/deliveries";
import { requireDashboardUser } from "@/lib/guards";
import { getNgoBoard } from "@/lib/queries";
import { presignView } from "@/lib/storage";
import { CLASSIFICATION_LABELS } from "@/types/donation";

export const dynamic = "force-dynamic";

export default async function NgoHomePage() {
  const user = await requireDashboardUser(["NGO", "ADMIN"]);
  const board = await getNgoBoard(user.id);
  const photos = await Promise.all(board.map((b) => presignView(b.photoKey)));
  const open = board.filter(
    (b) =>
      b.status === "ASSIGNED" ||
      b.status === "PICKED_UP" ||
      b.status === "EN_ROUTE",
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {open.length > 0 && <AutoRefresh everyMs={8000} />}
      <div>
        <h1 className="text-2xl font-bold">Incoming deliveries</h1>
        <p className="text-sm text-muted-foreground">
          When the volunteer arrives, check the photo and the food, then enter
          the code they show you.
        </p>
      </div>

      {board.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm">
          <p className="font-medium">No deliveries are heading your way yet.</p>
          <p className="mt-1 text-muted-foreground">
            This page updates by itself.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {board.map((b, i) => {
          const photo = photos[i];
          const isOpen = open.includes(b);
          return (
            <li key={b.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{b.title}</h2>
                <DeliveryStatus status={b.status} />
                {b.freshnessStatus && b.freshnessScore !== null && (
                  <FreshnessBadge
                    status={b.freshnessStatus}
                    score={b.freshnessScore}
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                From {b.donorName ?? "donor"} · carried by{" "}
                {b.volunteerName ?? "volunteer"} ·{" "}
                {CLASSIFICATION_LABELS[b.classification]} · {b.servings}{" "}
                servings
              </p>
              {b.items.length > 0 && (
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {b.items.map((it, k) => (
                    <li key={k}>
                      {it.name} — {it.quantity}
                    </li>
                  ))}
                </ul>
              )}
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt="Handoff photo from the volunteer"
                  className="max-h-56 rounded-md border"
                />
              )}
              {isOpen && (
                <OtpForm
                  deliveryId={b.id}
                  action={confirmDropoff}
                  label="Drop-off code (from the volunteer)"
                  submitLabel="Confirm delivery"
                  disabledReason={
                    b.status !== "PICKED_UP"
                      ? "Waiting for the volunteer to collect the food."
                      : !b.photoKey
                        ? "Waiting for the volunteer's handoff photo."
                        : undefined
                  }
                />
              )}
              {b.status === "DELIVERED" && (
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Delivered and confirmed.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
