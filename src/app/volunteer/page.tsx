import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AlertsToggle } from "@/components/shared/alerts-toggle";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { FoodPhoto } from "@/components/shared/food-photo";
import {
  EmptyState,
  NextStep,
  QuickLinks,
  StatTiles,
} from "@/components/shared/hub";
import { DeliveryStatus } from "@/components/shared/status-badge";
import { requireDashboardUser } from "@/lib/guards";
import { getLeaderboard } from "@/lib/leaderboard";
import { getVolunteerBoard } from "@/lib/queries";
import { getMyRewards } from "@/lib/rewards";
import { formatTimeLeft } from "@/lib/urgency";

export const dynamic = "force-dynamic";

const NEXT: Record<string, string> = {
  ASSIGNED: "Go to the pickup address and show the donor your code.",
  PICKED_UP:
    "Take the food to the NGO, take a handoff photo, then give them your drop-off code.",
  EN_ROUTE:
    "Take the food to the NGO, take a handoff photo, then give them your drop-off code.",
};

export default async function VolunteerHomePage() {
  const user = await requireDashboardUser(["VOLUNTEER", "ADMIN"]);
  const [board, mine, month] = await Promise.all([
    getVolunteerBoard(user.id),
    getMyRewards(user.id),
    getLeaderboard("month", 1, user.id).catch(() => null),
  ]);
  const active = board.filter(
    (b) =>
      b.status === "ASSIGNED" ||
      b.status === "PICKED_UP" ||
      b.status === "EN_ROUTE",
  );
  const past = board.filter((b) => !active.includes(b));
  const first = active[0];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
      {active.length > 0 && <AutoRefresh everyMs={10000} />}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Volunteer home</h1>
          <p className="text-sm text-muted-foreground">
            Pick up surplus food, deliver it, and earn points.
          </p>
        </div>
        <Link
          href="/volunteer/discover"
          className={buttonVariants({ size: "lg" })}
        >
          Find pickups near you
        </Link>
      </header>

      {first ? (
        <NextStep
          tone="urgent"
          title={`In progress: ${first.title}`}
          body={NEXT[first.status]}
          href={`/volunteer/deliveries/${first.deliveryId}`}
          cta="Continue delivery"
        />
      ) : (
        <NextStep
          title="No delivery in progress"
          body="Open the map to see food waiting for a volunteer near you."
          href="/volunteer/discover"
          cta="Find a pickup"
        />
      )}

      <StatTiles
        items={[
          {
            value: mine.points.toLocaleString("en-IN"),
            label: "points",
            href: "/volunteer/rewards",
          },
          {
            value: month?.me ? `#${month.me.rank}` : "-",
            label: "rank this month",
            href: "/volunteer/rewards",
          },
          { value: mine.deliveries, label: "deliveries" },
          {
            value: (mine.foodKgHundredths / 100).toLocaleString("en-IN", {
              maximumFractionDigits: 1,
            }),
            label: "kg moved",
          },
        ]}
      />

      <AlertsToggle
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      />

      <section className="space-y-3" aria-labelledby="act-h">
        <h2 id="act-h" className="text-lg font-bold">
          In progress
        </h2>
        {active.length === 0 && (
          <EmptyState
            title="Nothing in progress."
            href="/volunteer/discover"
            cta="Find a pickup near you"
          />
        )}
        <ul className="space-y-3">
          {active.map((b) => (
            <li
              key={b.deliveryId}
              className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-foreground p-4"
            >
              <FoodPhoto
                src={b.photos[0]}
                alt={`Photo of ${b.title}`}
                className="h-20 w-24 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
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
        <section className="space-y-3" aria-labelledby="past-h">
          <h2 id="past-h" className="text-lg font-bold">
            Finished
          </h2>
          <ul className="space-y-2">
            {past.map((b) => (
              <li
                key={b.deliveryId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span className="flex flex-wrap items-center gap-3">
                  <FoodPhoto src={b.photos[0]} alt="" className="h-10 w-12" />
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

      <QuickLinks
        items={[
          {
            href: "/volunteer/discover",
            label: "Find pickups",
            hint: "Map of food near you",
          },
          {
            href: "/volunteer/rewards",
            label: "Rewards",
            hint: "Points, leaderboard, certificates",
          },
          { href: "/support", label: "Help", hint: "Report a problem" },
        ]}
      />
    </main>
  );
}
