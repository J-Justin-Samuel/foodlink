import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { FoodPhoto } from "@/components/shared/food-photo";
import { LiveTracker } from "@/components/shared/live-tracker";
import { DeliveryStatus } from "@/components/shared/status-badge";
import { requireDashboardUser } from "@/lib/guards";
import { isRealtimeConfigured } from "@/lib/realtime";
import { ROLE_HOME } from "@/lib/routes";
import { getTrackingSnapshot } from "@/lib/tracking-queries";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { cleanPhotoList } from "@/lib/food-photo-rules";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BACK_LABEL = {
  DONOR: "← Donor home",
  VOLUNTEER: "← Volunteer home",
  NGO: "← NGO home",
  ADMIN: "← Admin",
  BUYER: "← Buyer home",
} as const;

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireDashboardUser([
    "DONOR",
    "VOLUNTEER",
    "NGO",
    "BUYER",
    "ADMIN",
  ]);
  if (!UUID.test(id)) notFound();

  const snap = await getTrackingSnapshot(id, user);
  if (!snap) notFound();
  const realtime = isRealtimeConfigured();
  const [ph] = (await db.execute(
    sql`SELECT d.image_urls FROM deliveries x JOIN donations d ON d.id = x.donation_id WHERE x.id = ${id}`,
  )) as unknown as { image_urls: string[] | null }[];
  const photo = cleanPhotoList(ph?.image_urls)[0];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8">
      {/* Keeps the status (and the map target) current; positions themselves arrive live. */}
      {snap.active && <AutoRefresh everyMs={realtime ? 15_000 : 10_000} />}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={ROLE_HOME[user.role]}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {BACK_LABEL[user.role]}
        </Link>
        {snap.viewer === "VOLUNTEER" && (
          <Link
            href={`/volunteer/deliveries/${snap.deliveryId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Codes and photo
          </Link>
        )}
      </div>

      <header className="flex items-center gap-4">
        <FoodPhoto
          src={photo}
          alt={`Photo of ${snap.title}`}
          className="h-16 w-20 shrink-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{snap.title}</h1>
          <DeliveryStatus status={snap.status} />
        </div>
      </header>

      <LiveTracker
        deliveryId={snap.deliveryId}
        status={snap.status}
        active={snap.active}
        viewer={snap.viewer}
        volunteerName={snap.volunteerName}
        pickup={snap.pickup}
        dropoff={snap.dropoff}
        position={snap.position}
        realtime={realtime}
      />
    </main>
  );
}
