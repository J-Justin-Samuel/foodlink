"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, donations, users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import { otpMatches } from "@/lib/otp";
import {
  deleteObject,
  devBypassKey,
  handoffKeyPrefix,
  headObject,
  isStorageConfigured,
  isStorageDevBypass,
} from "@/lib/storage";
import {
  deliveryIdSchema,
  MAX_PHOTO_BYTES,
  ngoPickSchema,
  otpEntrySchema,
  OTP_LOCK_MINUTES,
  OTP_MAX_ATTEMPTS,
  photoRecordSchema,
} from "@/lib/validations/stage3";
import type { ActionFailure, ActionResult } from "@/types/action-result";

/*
 * Delivery state machine (delivery.status / donation.status):
 *
 *   claim              ASSIGNED  / CLAIMED
 *   donor enters pickup code     -> PICKED_UP / IN_TRANSIT      (confirmPickup)
 *   volunteer uploads photo      -> (stays PICKED_UP, photo saved) (recordHandoffPhoto)
 *   NGO enters drop-off code     -> DELIVERED / DELIVERED       (confirmDropoff)
 *
 * Both codes are checked in constant time, wrong guesses are counted, and
 * every transition runs under row locks taken in the same order everywhere
 * (donation, then delivery) so concurrent requests cannot interleave.
 */

const fail = (code: ActionFailure["code"], error: string): ActionFailure => ({
  ok: false,
  code,
  error,
});
type Outcome = ActionFailure | { ok: true };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DeliveryRow = typeof deliveries.$inferSelect;

function lockedMessage(until: Date | null): string | null {
  if (!until || until.getTime() <= Date.now()) return null;
  const mins = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return `Too many wrong codes. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`;
}

/** Counts a wrong guess; after OTP_MAX_ATTEMPTS the delivery is locked for a while. */
async function registerWrongCode(
  tx: Tx,
  delivery: DeliveryRow,
  step: "pickup" | "dropoff",
): Promise<ActionFailure> {
  const attempts =
    (step === "pickup" ? delivery.pickupAttempts : delivery.dropoffAttempts) +
    1;
  const locked = attempts >= OTP_MAX_ATTEMPTS;
  const now = new Date();
  const counters =
    step === "pickup"
      ? { pickupAttempts: locked ? 0 : attempts }
      : { dropoffAttempts: locked ? 0 : attempts };

  await tx
    .update(deliveries)
    .set({
      ...counters,
      otpLockedUntil: locked
        ? new Date(now.getTime() + OTP_LOCK_MINUTES * 60_000)
        : delivery.otpLockedUntil,
      updatedAt: now,
    })
    .where(eq(deliveries.id, delivery.id));

  return locked
    ? fail(
        "LIMIT",
        `Too many wrong codes. Try again in ${OTP_LOCK_MINUTES} minutes.`,
      )
    : fail(
        "VALIDATION",
        `That code is wrong. ${OTP_MAX_ATTEMPTS - attempts} attempt${OTP_MAX_ATTEMPTS - attempts === 1 ? "" : "s"} left.`,
      );
}

/** Locks donation then delivery (the project-wide lock order) and returns both. */
async function lockPair(tx: Tx, deliveryId: string) {
  const [peek] = await tx
    .select({ donationId: deliveries.donationId })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId));
  if (!peek) return null;
  const [donation] = await tx
    .select()
    .from(donations)
    .where(eq(donations.id, peek.donationId))
    .for("update");
  const [delivery] = await tx
    .select()
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
    .for("update");
  return donation && delivery ? { donation, delivery } : null;
}

// ---------------------------------------------------------------------------
// Step 1 — the DONOR enters the pickup code the volunteer reads out
// ---------------------------------------------------------------------------
export async function confirmPickup(
  input: unknown,
): Promise<ActionResult<{ deliveryId: string }>> {
  try {
    const user = await requireRole(["DONOR"]);
    const parsed = otpEntrySchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { deliveryId, code } = parsed.data;

    const outcome = await db.transaction(async (tx): Promise<Outcome> => {
      const pair = await lockPair(tx, deliveryId);
      if (!pair) return fail("NOT_FOUND", "Delivery not found.");
      const { donation, delivery } = pair;

      if (donation.donorId !== user.id)
        return fail("FORBIDDEN", "This isn't your donation.");
      if (delivery.status !== "ASSIGNED") {
        return fail(
          "CONFLICT",
          delivery.status === "FAILED"
            ? "This delivery was cancelled."
            : "Pickup was already confirmed.",
        );
      }
      if (donation.status !== "CLAIMED")
        return fail("CONFLICT", "This batch is no longer waiting for pickup.");
      if (donation.shelfLifeExpiresAt.getTime() <= Date.now())
        return fail("EXPIRED", "This batch has expired.");
      if (!delivery.ngoId)
        return fail(
          "CONFLICT",
          "The volunteer hasn't chosen a drop-off NGO yet.",
        );
      if (!delivery.pickupOtp) {
        return fail(
          "CONFLICT",
          "This delivery has no code (it was created before the upgrade). Ask the volunteer to release it and claim it again.",
        );
      }
      const locked = lockedMessage(delivery.otpLockedUntil);
      if (locked) return fail("LIMIT", locked);

      if (!otpMatches(delivery.pickupOtp, code))
        return registerWrongCode(tx, delivery, "pickup");

      const now = new Date();
      await tx
        .update(deliveries)
        .set({
          status: "PICKED_UP",
          pickupConfirmedAt: now,
          pickupAttempts: 0,
          updatedAt: now,
        })
        .where(eq(deliveries.id, delivery.id));
      await tx
        .update(donations)
        .set({ status: "IN_TRANSIT", updatedAt: now })
        .where(eq(donations.id, donation.id));
      return { ok: true };
    });

    return outcome.ok ? { ok: true, data: { deliveryId } } : outcome;
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Step 3 — the NGO enters the drop-off code the volunteer reads out
// ---------------------------------------------------------------------------
export async function confirmDropoff(
  input: unknown,
): Promise<ActionResult<{ deliveryId: string }>> {
  try {
    const user = await requireRole(["NGO"]);
    const parsed = otpEntrySchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { deliveryId, code } = parsed.data;

    const outcome = await db.transaction(async (tx): Promise<Outcome> => {
      const pair = await lockPair(tx, deliveryId);
      if (!pair) return fail("NOT_FOUND", "Delivery not found.");
      const { donation, delivery } = pair;

      if (delivery.ngoId !== user.id)
        return fail(
          "FORBIDDEN",
          "This delivery isn't addressed to your organisation.",
        );
      if (delivery.status !== "PICKED_UP") {
        return fail(
          "CONFLICT",
          delivery.status === "DELIVERED"
            ? "This delivery was already confirmed."
            : delivery.status === "FAILED"
              ? "This delivery was cancelled."
              : "The donor hasn't handed the food over yet.",
        );
      }
      if (donation.status !== "IN_TRANSIT")
        return fail("CONFLICT", "This batch is not in transit.");
      if (!delivery.handoffPhotoKey)
        return fail(
          "CONFLICT",
          "The volunteer hasn't uploaded the handoff photo yet.",
        );
      if (!delivery.dropoffOtp)
        return fail("CONFLICT", "This delivery has no drop-off code.");
      const locked = lockedMessage(delivery.otpLockedUntil);
      if (locked) return fail("LIMIT", locked);

      if (!otpMatches(delivery.dropoffOtp, code))
        return registerWrongCode(tx, delivery, "dropoff");

      const now = new Date();
      await tx
        .update(deliveries)
        .set({
          status: "DELIVERED",
          dropoffConfirmedAt: now,
          dropoffAttempts: 0,
          updatedAt: now,
        })
        .where(eq(deliveries.id, delivery.id));
      await tx
        .update(donations)
        .set({ status: "DELIVERED", updatedAt: now })
        .where(eq(donations.id, donation.id));
      return { ok: true };
    });

    return outcome.ok ? { ok: true, data: { deliveryId } } : outcome;
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Step 2 — the VOLUNTEER records the live handoff photo they just uploaded
// ---------------------------------------------------------------------------
export async function recordHandoffPhoto(
  input: unknown,
): Promise<ActionResult<{ deliveryId: string }>> {
  try {
    const user = await requireRole(["VOLUNTEER"]);
    const parsed = photoRecordSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { deliveryId, key } = parsed.data;

    const [delivery] = await db
      .select()
      .from(deliveries)
      .where(
        and(eq(deliveries.id, deliveryId), eq(deliveries.volunteerId, user.id)),
      );
    if (!delivery) return fail("NOT_FOUND", "Delivery not found.");
    if (delivery.status !== "PICKED_UP") {
      return fail(
        "CONFLICT",
        "You can add the handoff photo after the donor has confirmed pickup.",
      );
    }

    const bypass = isStorageDevBypass() && key === devBypassKey(deliveryId);
    if (!bypass) {
      // The key must be inside THIS delivery's folder — no pointing at someone else's file.
      if (!key.startsWith(handoffKeyPrefix(deliveryId)))
        return fail("VALIDATION", "Invalid photo reference.");
      if (!isStorageConfigured())
        return fail(
          "UNKNOWN",
          "Photo storage isn't configured on this server.",
        );

      // Don't trust the client: confirm the object really exists and looks like a photo.
      const head = await headObject(key);
      if (!head)
        return fail(
          "VALIDATION",
          "We couldn't find the uploaded photo. Please try again.",
        );
      if (
        head.contentLength <= 0 ||
        head.contentLength > MAX_PHOTO_BYTES ||
        !head.contentType.startsWith("image/")
      ) {
        await deleteObject(key).catch(() => {});
        return fail("VALIDATION", "That file isn't a valid photo.");
      }
    }

    const now = new Date();
    const updated = await db
      .update(deliveries)
      .set({
        handoffPhotoKey: key,
        handoffPhotoUploadedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(deliveries.id, deliveryId),
          eq(deliveries.volunteerId, user.id),
          eq(deliveries.status, "PICKED_UP"),
        ),
      )
      .returning({ id: deliveries.id });
    if (updated.length === 0)
      return fail(
        "CONFLICT",
        "This delivery changed while the photo uploaded. Refresh and try again.",
      );

    // Retaking the photo replaces the old one; clean it up (best effort).
    const old = delivery.handoffPhotoKey;
    if (
      old &&
      old !== key &&
      !old.startsWith("dev-bypass/") &&
      isStorageConfigured()
    ) {
      deleteObject(old).catch(() => {});
    }
    return { ok: true, data: { deliveryId } };
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// The VOLUNTEER picks which NGO receives the food (before pickup is confirmed)
// ---------------------------------------------------------------------------
export async function setDeliveryNgo(
  input: unknown,
): Promise<ActionResult<{ deliveryId: string }>> {
  try {
    const user = await requireRole(["VOLUNTEER"]);
    const parsed = ngoPickSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { deliveryId, ngoId } = parsed.data;

    const [ngo] = await db
      .select({
        id: users.id,
        role: users.role,
        isActive: users.isActive,
        status: users.onboardingStatus,
      })
      .from(users)
      .where(eq(users.id, ngoId));
    if (
      !ngo ||
      ngo.role !== "NGO" ||
      !ngo.isActive ||
      !["SUBMITTED", "VERIFIED"].includes(ngo.status)
    ) {
      return fail("VALIDATION", "That NGO isn't available.");
    }

    const updated = await db
      .update(deliveries)
      .set({ ngoId, updatedAt: new Date() })
      .where(
        and(
          eq(deliveries.id, deliveryId),
          eq(deliveries.volunteerId, user.id),
          eq(deliveries.status, "ASSIGNED"),
        ),
      )
      .returning({ id: deliveries.id });
    if (updated.length === 0) {
      return fail(
        "CONFLICT",
        "The NGO can only be changed before the donor confirms pickup.",
      );
    }
    return { ok: true, data: { deliveryId } };
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// The VOLUNTEER gives the pickup back (before pickup) so someone else can take it
// ---------------------------------------------------------------------------
export async function releaseDelivery(
  input: unknown,
): Promise<ActionResult<{ deliveryId: string }>> {
  try {
    const user = await requireRole(["VOLUNTEER"]);
    const parsed = deliveryIdSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { deliveryId } = parsed.data;

    const outcome = await db.transaction(async (tx): Promise<Outcome> => {
      const pair = await lockPair(tx, deliveryId);
      if (!pair) return fail("NOT_FOUND", "Delivery not found.");
      const { donation, delivery } = pair;

      if (delivery.volunteerId !== user.id)
        return fail("FORBIDDEN", "This isn't your delivery.");
      if (delivery.status !== "ASSIGNED") {
        return fail(
          "CONFLICT",
          "You can only release a pickup before the donor has confirmed it.",
        );
      }

      const now = new Date();
      await tx
        .update(deliveries)
        .set({
          status: "FAILED",
          failureReason: "Released by the volunteer.",
          updatedAt: now,
        })
        .where(eq(deliveries.id, delivery.id));

      if (donation.status === "CLAIMED") {
        const expired = donation.shelfLifeExpiresAt.getTime() <= now.getTime();
        await tx
          .update(donations)
          .set({ status: expired ? "EXPIRED" : "LISTED", updatedAt: now })
          .where(
            and(
              eq(donations.id, donation.id),
              inArray(donations.status, ["CLAIMED"]),
            ),
          );
      }
      return { ok: true };
    });

    return outcome.ok ? { ok: true, data: { deliveryId } } : outcome;
  } catch (err) {
    return toFailure(err);
  }
}
