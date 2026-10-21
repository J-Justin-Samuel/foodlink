import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AlertsToggle } from "@/components/shared/alerts-toggle";
import { DeliveryStatus } from "@/components/shared/status-badge";
import { requireDashboardUser } from "@/lib/guards";
import { getVolunteerBoard } from "@/lib/queries";
import { formatTimeLeft } from "@/lib/urgency";

export const dynamic = "force-dynamic";

export default async function VolunteerHomePage() {
  const user = await requireDashboardUser(["VOLUNTEER", "ADMIN"]);
  const board = await getVolunteerBoard(user.id);
  const active = board.filter(
    (b) =>
      b.status === "ASSIGNED" ||
      b.status === "PICKED_UP" ||
      b.status === "EN_ROUTE",
  );
  const past = board.filter((b) => !active.includes(b));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My deliveries</h1>
          <p className="text-sm text-muted-foreground">
            Open a delivery to see your codes and next step.
          </p>
        </div>
        <Link href="/volunteer/discover" className={buttonVariants()}>
          Find pickups
        </Link>
      </div>

      <AlertsToggle
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      />

      <section className="space-y-3">
        <h2 className="font-semibold">In progress</h2>
        {active.length === 0 && (
          <div className="rounded-lg border-2 border-dashed p-6 text-center text-sm">
            <p>Nothing in progress.</p>
            <Link
              href="/volunteer/discover"
              className={`${buttonVariants({ variant: "outline" })} mt-3`}
            >
              Find a pickup near you
            </Link>
          </div>
        )}
        <ul className="space-y-3">
          {active.map((b) => (
            <li
              key={b.deliveryId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-foreground p-4"
            >
              <div className="space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {b.title} <DeliveryStatus status={b.status} />
                </p>
                <p className="text-sm text-muted-foreground">
                  {b.address ?? "Address not set"} · {b.servings} servings ·{" "}
                  {formatTimeLeft(b.expiresAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  To: {b.ngoName ?? "NGO not chosen yet"}
                </p>
              </div>
              <Link
                href={`/volunteer/deliveries/${b.deliveryId}`}
                className={buttonVariants()}
              >
                Open delivery
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Finished</h2>
          <ul className="space-y-2">
            {past.map((b) => (
              <li
                key={b.deliveryId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  {b.title} <DeliveryStatus status={b.status} />
                </span>
                <Link
                  href={`/volunteer/deliveries/${b.deliveryId}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
