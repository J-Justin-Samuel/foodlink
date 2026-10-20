"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, donations, users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import {
  isUniqueViolation,
  toFailure,
  validationFailure,
} from "@/lib/action-utils";
import { claimSchema } from "@/lib/validations/donation";
import { generateOtpPair } from "@/lib/otp";
import type { ActionErrorCode, ActionResult } from "@/types/action-result";

const MAX_ACTIVE_CLAIMS = 3;
const ACTIVE_DELIVERY_STATES = ["ASSIGNED", "PICKED_UP", "EN_ROUTE"] as const;

class ClaimError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Atomically assigns a donation to the calling volunteer.
 *
 * Inside one transaction we lock, in a fixed order:
 *   1. the volunteer's own user row  → serialises that volunteer's claims, so
 *      the MAX_ACTIVE_CLAIMS limit can't be beaten by double-clicking
 *   2. the donation row (SELECT … FOR UPDATE) → two volunteers racing for the
 *      same batch queue up; the loser re-reads status = 'CLAIMED' and fails.
 * The partial unique index on deliveries(donation_id) is a final backstop.
 */
export async function claimDonation(
  input: unknown,
): Promise<ActionResult<{ deliveryId: string }>> {
  try {
    const user = await requireRole(["VOLUNTEER", "ADMIN"]);

    const parsed = claimSchema.safeParse({ donationId: input });
    if (!parsed.success) return validationFailure(parsed.error);
    const { donationId } = parsed.data;

    const deliveryId = await db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user.id))
        .for("update");

      const [donation] = await tx
        .select({
          id: donations.id,
          status: donations.status,
          expiresAt: donations.shelfLifeExpiresAt,
        })
        .from(donations)
        .where(eq(donations.id, donationId))
        .for("update");

      if (!donation)
        throw new ClaimError("NOT_FOUND", "This donation no longer exists.");
      if (donation.status === "DIVERTED") {
        throw new ClaimError(
          "CONFLICT",
          "This batch failed a freshness check and can no longer be claimed.",
        );
      }
      if (donation.status !== "LISTED") {
        throw new ClaimError(
          "CONFLICT",
          "Someone else already claimed this batch.",
        );
      }
      if (donation.expiresAt.getTime() <= Date.now()) {
        throw new ClaimError("EXPIRED", "This batch has expired.");
      }

      const [{ active }] = await tx
        .select({ active: sql<number>`count(*)::int` })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.volunteerId, user.id),
            inArray(deliveries.status, [...ACTIVE_DELIVERY_STATES]),
          ),
        );
      if (active >= MAX_ACTIVE_CLAIMS) {
        throw new ClaimError(
          "LIMIT",
          `You can hold at most ${MAX_ACTIVE_CLAIMS} active pickups. Finish one first.`,
        );
      }

      // Stage 3: nearest eligible NGO is pre-selected (the volunteer can change
      // it before pickup) and two distinct random codes are generated.
      const nearest = (await tx.execute(sql`
        SELECT u.id
        FROM users u
        JOIN profiles p ON p.user_id = u.id
        CROSS JOIN donations d
        WHERE d.id = ${donationId}
          AND u.role = 'NGO' AND u.is_active
          AND u.onboarding_status IN ('SUBMITTED', 'VERIFIED')
          AND p.location IS NOT NULL
        ORDER BY ST_Distance(p.location, d.pickup_location)
        LIMIT 1
      `)) as unknown as { id: string }[];
      const otps = generateOtpPair();

      const [delivery] = await tx
        .insert(deliveries)
        .values({
          donationId,
          volunteerId: user.id,
          ngoId: nearest[0]?.id ?? null,
          status: "ASSIGNED",
          pickupOtp: otps.pickup,
          dropoffOtp: otps.dropoff,
        })
        .returning({ id: deliveries.id });

      await tx
        .update(donations)
        .set({ status: "CLAIMED", updatedAt: new Date() })
        .where(eq(donations.id, donationId));

      return delivery.id;
    });

    revalidatePath("/volunteer/discover");
    revalidatePath("/volunteer");
    return { ok: true, data: { deliveryId } };
  } catch (err) {
    if (err instanceof ClaimError) {
      return { ok: false, code: err.code, error: err.message };
    }
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "Someone else already claimed this batch.",
      };
    }
    return toFailure(err);
  }
}
