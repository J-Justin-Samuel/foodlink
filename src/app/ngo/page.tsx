import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { FoodPhoto } from "@/components/shared/food-photo";
import {
  EmptyState,
  NextStep,
  QuickLinks,
  StatTiles,
} from "@/components/shared/hub";
import { OtpForm } from "@/components/shared/otp-form";
import {
  DeliveryStatus,
  FreshnessBadge,
} from "@/components/shared/status-badge";
import { confirmDropoff } from "@/lib/actions/deliveries";
import { requireDashboardUser } from "@/lib/guards";
import { getNgoBoard, type NgoBoardItem } from "@/lib/queries";
import { presignView } from "@/lib/storage";
import { canTrackStatus } from "@/lib/tracking-queries";
import { CLASSIFICATION_LABELS } from "@/types/donation";

export const dynamic = "force-dynamic";

const OPEN = ["ASSIGNED", "PICKED_UP", "EN_ROUTE"];

export default async function NgoHomePage() {
  const user = await requireDashboardUser(["NGO", "ADMIN"]);
  const board = await getNgoBoard(user.id);
  const photos = await Promise.all(
    board.map((b) => presignView(b.photoKey).catch(() => null)),
  );
  const photoOf = new Map(board.map((b, i) => [b.id, photos[i]]));
  const open = board.filter((b) => OPEN.includes(b.status));
  const done = board.filter((b) => b.status === "DELIVERED");
  const arrived = open.filter(
    (b) => b.status === "PICKED_UP" || b.status === "EN_ROUTE",
  );
  const servings = done.reduce((n, b) => n + b.servings, 0);
  const kg = done.reduce((n, b) => n + b.quantityKg, 0);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
      {open.length > 0 && <AutoRefresh everyMs={8000} />}

      <header>
        <h1 className="text-2xl font-bold">NGO home</h1>
        <p className="text-sm text-muted-foreground">
          Food coming to you. Check the photos, check the food, then confirm
          with the volunteer&apos;s code.
        </p>
      </header>

      {user.onboardingStatus === "SUBMITTED" && user.role === "NGO" && (
        <p className="rounded-lg border-2 border-amber-500 p-3 text-sm">
          Your registration is being reviewed. You can already receive food
          unless your administrator requires approval first.
        </p>
      )}

      {arrived.length > 0 ? (
        <NextStep
          tone="urgent"
          title={`${arrived[0].title} is on its way${arrived.length > 1 ? ` (and ${arrived.length - 1} more)` : ""}`}
          body="When the volunteer arrives, enter their drop-off code to confirm."
          href={`#delivery-${arrived[0].id}`}
          cta="Confirm delivery"
        />
      ) : open.length > 0 ? (
        <NextStep
          title={`${open.length} volunteer${open.length > 1 ? "s are" : " is"} collecting food for you`}
          body="You'll be asked for a code when it arrives."
          href={`#delivery-${open[0].id}`}
          cta="See details"
        />
      ) : (
        <NextStep
          title="Nothing is heading your way yet"
          body="Volunteers choose which NGO to deliver to. This page updates by itself."
          href="/support"
          cta="Need help?"
        />
      )}

      <StatTiles
        items={[
          { value: open.length, label: "Incoming" },
          { value: done.length, label: "Received" },
          {
            value: servings.toLocaleString("en-IN"),
            label: "servings received",
          },
          {
            value: kg.toLocaleString("en-IN", { maximumFractionDigits: 1 }),
            label: "kg received",
          },
        ]}
      />

      <section className="space-y-4" aria-labelledby="in-h">
        <h2 id="in-h" className="text-lg font-bold">
          Incoming deliveries
        </h2>
        {open.length === 0 && (
          <EmptyState
            title="No deliveries are heading your way."
            body="This page updates by itself."
          />
        )}
        <ul className="space-y-4">
          {open.map((b) => (
            <Delivery
              key={b.id}
              b={b}
              handoff={photoOf.get(b.id) ?? null}
              open
            />
          ))}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="space-y-4" aria-labelledby="done-h">
          <h2 id="done-h" className="text-lg font-bold">
            Received
          </h2>
          <ul className="space-y-4">
            {done.map((b) => (
              <Delivery
                key={b.id}
                b={b}
                handoff={photoOf.get(b.id) ?? null}
                open={false}
              />
            ))}
          </ul>
        </section>
      )}

      <QuickLinks
        items={[
          {
            href: "/support",
            label: "Help",
            hint: "Report a problem with a delivery",
          },
        ]}
      />
    </main>
  );
}

function Delivery({
  b,
  handoff,
  open,
}: {
  b: NgoBoardItem;
  handoff: string | null;
  open: boolean;
}) {
  return (
    <li
      id={`delivery-${b.id}`}
      className="scroll-mt-20 space-y-3 rounded-lg border p-4"
    >
      <div className="flex gap-4">
        <FoodPhoto
          src={b.photos[0]}
          alt={`Photo of ${b.title} from the donor`}
          className="h-28 w-32 shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{b.title}</h3>
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
            {CLASSIFICATION_LABELS[b.classification]} · {b.servings} servings ·{" "}
            {b.quantityKg} kg
          </p>
          {b.photos.length > 1 && (
            <p className="flex gap-2">
              {b.photos.slice(1).map((p, i) => (
                <a
                  key={p}
                  href={p}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open food photo ${i + 2} full size`}
                >
                  <FoodPhoto src={p} alt="" className="h-10 w-12" />
                </a>
              ))}
            </p>
          )}
        </div>
      </div>
      {canTrackStatus(b.status) && (
        <Link
          href={`/track/${b.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Track live on map
        </Link>
      )}
      {b.items.length > 0 && (
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {b.items.map((it, k) => (
            <li key={k}>
              {it.name} — {it.quantity}
            </li>
          ))}
        </ul>
      )}
      {handoff && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Handoff photo from the volunteer
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={handoff}
            alt="Handoff photo from the volunteer"
            className="max-h-56 rounded-md border"
          />
        </div>
      )}
      {open && (
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
}
