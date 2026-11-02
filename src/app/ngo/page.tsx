import Link from "next/link";
import { PackageCheck, MapPin, Utensils } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { GlassBottomNav } from "@/components/shared/glass-bottom-nav";
import { OtpForm } from "@/components/shared/otp-form";
import {
  DeliveryStatus,
  FreshnessBadge,
} from "@/components/shared/status-badge";
import { confirmDropoff } from "@/lib/actions/deliveries";
import { requireDashboardUser } from "@/lib/guards";
import { getNgoBoard } from "@/lib/queries";
import { presignView } from "@/lib/storage";
import { canTrackStatus } from "@/lib/tracking-queries";
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
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-32 pt-8">
      {open.length > 0 && <AutoRefresh everyMs={8000} />}

      <div className="glass-orange rounded-[2rem] p-6 text-white">
        <h1 className="text-3xl font-bold">Incoming deliveries</h1>
        <p className="mt-1 max-w-md text-sm text-white/90">
          When the volunteer arrives, check the photo and the food, then enter
          the code they show you.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
          <PackageCheck className="h-4 w-4" />
          {open.length} on the way
        </p>
      </div>

      {board.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-soft">
            <Utensils className="h-6 w-6 text-orange-vibrant" />
          </span>
          <p className="font-display text-lg font-bold text-forest">
            No deliveries are heading your way yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            This page updates by itself.
          </p>
        </div>
      )}

      <ul className="space-y-5">
        {board.map((b, i) => {
          const photo = photos[i];
          const isOpen = open.includes(b);
          return (
            <li
              key={b.id}
              className="glass group space-y-3 overflow-hidden rounded-3xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-900/10"
            >
              {photo && (
                <div className="-mx-4 -mt-4 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt="Handoff photo from the volunteer"
                    className="h-48 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-forest">
                  {b.title}
                </h2>
                <DeliveryStatus status={b.status} />
                {b.freshnessStatus && b.freshnessScore !== null && (
                  <FreshnessBadge
                    status={b.freshnessStatus}
                    score={b.freshnessScore}
                  />
                )}
              </div>

              <p className="text-sm text-charcoal/70">
                From {b.donorName ?? "donor"} · carried by{" "}
                {b.volunteerName ?? "volunteer"} ·{" "}
                {CLASSIFICATION_LABELS[b.classification]} · {b.servings}{" "}
                servings
              </p>

              {b.items.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {b.items.map((it, k) => (
                    <li
                      key={k}
                      className="rounded-full bg-orange-soft px-3 py-1 text-xs font-medium text-orange-900"
                    >
                      {it.name} · {it.quantity}
                    </li>
                  ))}
                </ul>
              )}

              {canTrackStatus(b.status) && (
                <Link
                  href={`/track/${b.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <MapPin className="h-3.5 w-3.5 text-orange-vibrant" />
                  Track live on map
                </Link>
              )}

              {isOpen && (
                <div className="rounded-2xl bg-white/60 p-3 backdrop-blur-xl">
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
                </div>
              )}

              {b.status === "DELIVERED" && (
                <p className="rounded-full bg-fresh/15 px-3 py-1.5 text-center text-sm font-semibold text-forest">
                  Delivered and confirmed
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <GlassBottomNav
        items={[
          { href: "/", label: "Home", icon: "home" },
          { href: "/ngo", label: "Deliveries", icon: "deliveries" },
          { href: "/track", label: "Track", icon: "map" },
        ]}
      />
    </main>
  );
}
