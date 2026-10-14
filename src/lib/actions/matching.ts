"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import { nearbySearchSchema } from "@/lib/validations/donation";
import type { ActionResult } from "@/types/action-result";
import type {
  DonationItem,
  FoodClassification,
  NearbyDonation,
} from "@/types/donation";

interface Row {
  id: string;
  title: string;
  donor_name: string | null;
  food_classification: FoodClassification;
  estimated_servings: number;
  quantity_kg: number;
  items: DonationItem[] | null;
  pickup_address: string | null;
  pickup_instructions: string | null;
  lat: number;
  lng: number;
  distance_km: number;
  hours_until_expiry: number;
  shelf_life_expires_at: Date | string;
  urgency_score: number;
}

/**
 * Active donations within `radiusKm` of a point, ranked by urgency:
 *   priority = 10 / max(hoursUntilExpiry, 0.5) + 10 / max(distanceKm, 1.0)
 *
 * ST_DWithin on a geography column uses the GIST index on pickup_location.
 * Note: ST_Distance is straight-line (geodesic) distance, not driving
 * distance — see README for adding Mapbox Directions Matrix later.
 */
export async function findNearbyDonations(
  input: unknown,
): Promise<ActionResult<NearbyDonation[]>> {
  try {
    await requireRole(["VOLUNTEER", "NGO", "ADMIN"]);

    const parsed = nearbySearchSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { lat, lng, radiusKm, classification, maxHoursUntilExpiry, limit } =
      parsed.data;

    const classificationFilter = classification
      ? sql`AND d.food_classification = ${classification}`
      : sql``;
    const expiryFilter = maxHoursUntilExpiry
      ? sql`AND d.shelf_life_expires_at <= now() + (${maxHoursUntilExpiry}::float8 * interval '1 hour')`
      : sql``;

    const rows = (await db.execute(sql`
      WITH ref AS (
        SELECT ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography AS pt
      ),
      candidates AS (
        SELECT
          d.id, d.title, d.food_classification, d.estimated_servings,
          d.quantity_kg::float8 AS quantity_kg, d.items,
          d.pickup_address, d.pickup_instructions, d.shelf_life_expires_at,
          ST_Y(d.pickup_location::geometry) AS lat,
          ST_X(d.pickup_location::geometry) AS lng,
          (ST_Distance(d.pickup_location, ref.pt) / 1000.0)::float8 AS distance_km,
          (EXTRACT(EPOCH FROM (d.shelf_life_expires_at - now())) / 3600.0)::float8
            AS hours_until_expiry,
          COALESCE(p.organization_name, p.display_name) AS donor_name
        FROM donations d
        CROSS JOIN ref
        LEFT JOIN profiles p ON p.user_id = d.donor_id
        WHERE d.status = 'LISTED'
          AND d.shelf_life_expires_at > now()
          AND ST_DWithin(d.pickup_location, ref.pt, ${radiusKm * 1000}::float8)
          ${classificationFilter}
          ${expiryFilter}
      )
      SELECT
        c.*,
        (10.0 / GREATEST(c.hours_until_expiry, 0.5)
          + 10.0 / GREATEST(c.distance_km, 1.0))::float8 AS urgency_score
      FROM candidates c
      ORDER BY urgency_score DESC, c.shelf_life_expires_at ASC
      LIMIT ${limit ?? 50}
    `)) as unknown as Row[];

    const data: NearbyDonation[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      donorName: r.donor_name,
      classification: r.food_classification,
      estimatedServings: r.estimated_servings,
      quantityKg: r.quantity_kg,
      items: r.items ?? [],
      pickupAddress: r.pickup_address,
      pickupInstructions: r.pickup_instructions,
      lat: r.lat,
      lng: r.lng,
      distanceKm: r.distance_km,
      hoursUntilExpiry: r.hours_until_expiry,
      expiresAt: new Date(r.shelf_life_expires_at).toISOString(),
      urgencyScore: r.urgency_score,
    }));

    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}
