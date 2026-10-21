import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { LiveTracker } from "@/components/shared/live-tracker";
import { FreshnessScanner } from "@/components/shared/freshness-scanner";
import {
  DeliveryStatus,
  FreshnessBadge,
} from "@/components/shared/status-badge";
import { DISPOSITION_LABELS, type Disposition } from "@/lib/freshness";
import { simulatorAllowed } from "@/lib/flags";
import { requireDashboardUser } from "@/lib/guards";
import { getDeliveryRun } from "@/lib/queries";
import { isRealtimeConfigured } from "@/lib/realtime";
import { presignView } from "@/lib/storage";
import { getTrackingSnapshot } from "@/lib/tracking-queries";
import { formatTimeLeft } from "@/lib/urgency";
import { CLASSIFICATION_LABELS } from "@/types/donation";
import { NgoPicker } from "./ngo-picker";
import { PhotoUpload } from "./photo-upload";
import { ReleaseButton } from "./release-button";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StepState = "done" | "current" | "upcoming";

function Step({
  n,
  title,
  note,
  state,
  children,
}: {
  n: number;
  title: string;
  note?: string;
  state: StepState;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={`rounded-lg border p-4 ${
        state === "current"
          ? "border-2 border-foreground"
          : state === "done"
            ? "bg-muted/50"
            : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-sm font-bold ${
            state === "done" ? "bg-foreground text-background" : ""
          }`}
        >
          {state === "done" ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {note && <p className="text-sm text-muted-foreground">{note}</p>}
          </div>
          {state !== "upcoming" && children}
        </div>
      </div>
    </li>
  );
}

function Code({ value }: { value: string | null }) {
  return (
    <p
      className="inline-block rounded-md border-2 border-foreground px-4 py-2 font-mono text-3xl font-black tracking-[0.35em]"
      aria-label={value ? `Code ${value.split("").join(" ")}` : "No code"}
    >
      {value ?? "——————"}
    </p>
  );
}

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireDashboardUser(["VOLUNTEER", "ADMIN"]);
  if (!UUID.test(id)) notFound();

  const run = await getDeliveryRun(id, user.id);
  if (!run) notFound();

  const photoUrl = await presignView(run.photoKey);
  const tracking = await getTrackingSnapshot(id, user);
  const { donation: d } = run;

  const assigned = run.status === "ASSIGNED";
  const onTheWay = run.status === "PICKED_UP" || run.status === "EN_ROUTE";
  const delivered = run.status === "DELIVERED";
  const failed = run.status === "FAILED";
  const active = assigned || onTheWay;
  const locked =
    !!run.lockedUntil && new Date(run.lockedUntil).getTime() > Date.now();

  const banner = failed
    ? d.status === "DIVERTED"
      ? "This batch failed a freshness check, so the delivery was cancelled."
      : (run.failureReason ?? "This delivery was cancelled.")
    : delivered
      ? "Delivered. Thank you."
      : assigned
        ? "Next: go to the pickup address and show the donor your pickup code."
        : run.hasPhoto
          ? "Next: give the NGO your drop-off code so they can confirm."
          : "Next: at the NGO, take a handoff photo.";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {active && <AutoRefresh everyMs={5000} />}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/volunteer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ← My deliveries
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{d.title}</h1>
          <DeliveryStatus status={run.status} />
          {run.latestScan && (
            <FreshnessBadge
              status={run.latestScan.status}
              score={run.latestScan.score}
            />
          )}
        </div>
        <p role="status" className="text-sm font-medium">
          {banner}
        </p>
      </header>

      {failed && d.status === "DIVERTED" && (
        <div className="rounded-lg border-2 border-destructive p-4 text-sm">
          <p className="font-semibold">
            Do not hand this food to anyone to eat.
          </p>
          <p className="mt-1">
            It was reclassified for{" "}
            {DISPOSITION_LABELS[d.disposition as Disposition]?.toLowerCase() ??
              "other use"}
            .{d.divertedReason ? ` ${d.divertedReason}` : ""}
          </p>
        </div>
      )}

      <section className="rounded-lg border p-4 text-sm">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">From</dt>
            <dd className="font-medium">{d.donorName ?? "Donor"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pickup address</dt>
            <dd className="font-medium">{d.address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Food</dt>
            <dd className="font-medium">
              {CLASSIFICATION_LABELS[d.classification]} · {d.servings} servings
              · {d.quantityKg} kg
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deliver to</dt>
            <dd className="font-medium">{run.ngoName ?? "Not chosen yet"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Safe to eat for</dt>
            <dd className="font-medium">{formatTimeLeft(d.expiresAt)}</dd>
          </div>
          {d.instructions && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Pickup instructions</dt>
              <dd className="font-medium">{d.instructions}</dd>
            </div>
          )}
        </dl>
        {d.items.length > 0 && (
          <ul className="mt-3 list-inside list-disc text-muted-foreground">
            {d.items.map((it, i) => (
              <li key={i}>
                {it.name} — {it.quantity}
                {it.notes ? ` (${it.notes})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {active && tracking && (
        <LiveTracker
          deliveryId={tracking.deliveryId}
          status={tracking.status}
          active={tracking.active}
          viewer="VOLUNTEER"
          volunteerName={tracking.volunteerName}
          pickup={tracking.pickup}
          dropoff={tracking.dropoff}
          position={tracking.position}
          realtime={isRealtimeConfigured()}
        />
      )}

      {active && (
        <ol className="space-y-3">
          <Step
            n={1}
            title="Check freshness"
            note="Recommended. A spoiled result cancels this delivery and reclassifies the food."
            state="current"
          >
            <FreshnessScanner
              donationId={d.id}
              simulatorEnabled={simulatorAllowed()}
            />
          </Step>

          <Step
            n={2}
            title="Pickup: show the donor your code"
            note="The donor types this code into their FoodLink dashboard when you arrive."
            state={assigned ? "current" : "done"}
          >
            {assigned && (
              <>
                <NgoPicker
                  deliveryId={run.id}
                  options={run.ngoOptions}
                  currentId={run.ngoId}
                />
                <Code value={run.pickupOtp} />
                {!run.pickupOtp && (
                  <p className="text-sm text-destructive">
                    This delivery has no code (it was created before the
                    upgrade). Release it and claim it again.
                  </p>
                )}
                {locked && (
                  <p className="text-sm text-destructive">
                    Code entry is locked for a few minutes after too many wrong
                    tries.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Waiting for the donor to confirm… this page updates by itself.
                </p>
                <ReleaseButton deliveryId={run.id} />
              </>
            )}
          </Step>

          <Step
            n={3}
            title="At the NGO: take a handoff photo"
            note="Photograph the food being handed over. The NGO sees it before confirming."
            state={assigned ? "upcoming" : run.hasPhoto ? "done" : "current"}
          >
            {onTheWay && (
              <PhotoUpload
                deliveryId={run.id}
                existingPhotoUrl={photoUrl}
                hasPhoto={run.hasPhoto}
              />
            )}
          </Step>

          <Step
            n={4}
            title="Drop-off: show the NGO your code"
            note={
              run.ngoName
                ? `${run.ngoName} types this code into their dashboard.`
                : undefined
            }
            state={assigned ? "upcoming" : "current"}
          >
            {onTheWay && (
              <>
                <Code value={run.dropoffOtp} />
                {!run.hasPhoto && (
                  <p className="text-sm text-muted-foreground">
                    The NGO can only confirm after your photo is uploaded.
                  </p>
                )}
                {locked && (
                  <p className="text-sm text-destructive">
                    Code entry is locked for a few minutes after too many wrong
                    tries.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Waiting for the NGO to confirm… this page updates by itself.
                </p>
              </>
            )}
          </Step>
        </ol>
      )}

      {!active && (
        <div className="flex flex-wrap gap-2">
          <Link href="/volunteer/discover" className={buttonVariants()}>
            Find more pickups
          </Link>
          <Link
            href="/volunteer"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to my deliveries
          </Link>
        </div>
      )}
    </main>
  );
}
