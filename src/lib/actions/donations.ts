"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import { donationFormSchema } from "@/lib/validations/donation";
import type { ActionResult } from "@/types/action-result";

// SUBMITTED is allowed until the Stage 6 admin verification flow exists.
// Tighten to ["VERIFIED"] once admins can approve licences.
const ALLOWED_ONBOARDING = ["SUBMITTED", "VERIFIED"];

const MIN_SHELF_LIFE_MS = 30 * 60 * 1000; // must be claimable for ≥30 min
const MAX_FUTURE_PREP_MS = 5 * 60 * 1000; // tolerate small clock skew

const otp = () => randomInt(100_000, 1_000_000).toString();

export async function createDonation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(["DONOR", "ADMIN"]);

    if (!ALLOWED_ONBOARDING.includes(user.onboardingStatus)) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "Finish onboarding before listing food.",
      };
    }

    const parsed = donationFormSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const d = parsed.data;

    const now = Date.now();
    const preparedAt = new Date(d.preparedAt);
    if (preparedAt.getTime() > now + MAX_FUTURE_PREP_MS) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Preparation time can't be in the future",
        fieldErrors: {
          preparedAt: ["Preparation time can't be in the future"],
        },
      };
    }

    const expiresAt = new Date(
      preparedAt.getTime() + d.expiryHours * 3_600_000,
    );
    if (expiresAt.getTime() < now + MIN_SHELF_LIFE_MS) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "This batch expires too soon to be collected",
        fieldErrors: {
          expiryHours: [
            "Food needs at least 30 minutes of shelf life left to be claimed",
          ],
        },
      };
    }

    // Raw SQL because the geography value is built with ST_MakePoint(lng, lat).
    const rows = await db.execute(sql`
      INSERT INTO donations (
        donor_id, title, food_classification, estimated_servings, quantity_kg,
        items, prepared_at, shelf_life_expires_at,
        pickup_location, pickup_address, pickup_instructions,
        pickup_otp, dropoff_otp, status
      ) VALUES (
        ${user.id}, ${d.title}, ${d.classification}, ${d.estimatedServings}, ${d.quantityKg},
        ${JSON.stringify(d.items)}::jsonb, ${preparedAt.toISOString()}::timestamptz,
        ${expiresAt.toISOString()}::timestamptz,
        ST_SetSRID(ST_MakePoint(${d.pickupLng}, ${d.pickupLat}), 4326)::geography,
        ${d.pickupAddress}, ${d.pickupInstructions || null},
        ${otp()}, ${otp()}, 'LISTED'
      )
      RETURNING id
    `);

    const id = (rows as unknown as { id: string }[])[0]?.id;
    if (!id) throw new Error("Insert returned no id");

    revalidatePath("/volunteer/discover");
    return { ok: true, data: { id } };
  } catch (err) {
    return toFailure(err);
  }
}
