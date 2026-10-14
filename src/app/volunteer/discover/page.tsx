import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireRole } from "@/lib/rbac";
import { DiscoveryView } from "./discovery-view";

export const dynamic = "force-dynamic";

export default async function VolunteerDiscoverPage() {
  let userId: string;
  try {
    const user = await requireRole(["VOLUNTEER", "ADMIN"]);
    userId = user.id;
  } catch {
    redirect("/unauthorized");
  }

  // The volunteer's base location from onboarding is the default search centre.
  const rows = (await db.execute(sql`
    SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM profiles
    WHERE user_id = ${userId} AND location IS NOT NULL
  `)) as unknown as { lat: number; lng: number }[];

  const base = rows[0] ? { lat: rows[0].lat, lng: rows[0].lng } : null;

  return <DiscoveryView initialCenter={base} />;
}
