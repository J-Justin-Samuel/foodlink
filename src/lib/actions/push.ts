"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import {
  endpointSchema,
  pushSubscriptionSchema,
} from "@/lib/validations/stage4";
import type { ActionResult } from "@/types/action-result";

const MAX_DEVICES = 5;

/** Saves this browser as a place to send "food expiring near you" alerts. */
export async function savePushSubscription(
  input: unknown,
  userAgent?: string,
): Promise<ActionResult> {
  try {
    const user = await requireRole(["VOLUNTEER", "ADMIN"]);
    const parsed = pushSubscriptionSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { endpoint, keys } = parsed.data;

    await db.transaction(async (tx) => {
      // The same browser can switch accounts: the endpoint moves to whoever is signed in now.
      await tx
        .insert(pushSubscriptions)
        .values({
          userId: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: userAgent?.slice(0, 255),
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
        });
      // Keep only the newest few devices per person.
      const mine = await tx
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, user.id))
        .orderBy(pushSubscriptions.createdAt);
      for (const old of mine.slice(0, Math.max(0, mine.length - MAX_DEVICES))) {
        await tx
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, old.id));
      }
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return toFailure(err);
  }
}

export async function removePushSubscription(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole(["VOLUNTEER", "ADMIN"]);
    const parsed = endpointSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, user.id),
          eq(pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
      );
    return { ok: true, data: undefined };
  } catch (err) {
    return toFailure(err);
  }
}
