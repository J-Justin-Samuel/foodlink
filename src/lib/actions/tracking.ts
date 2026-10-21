"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import { publishPosition } from "@/lib/realtime";
import { ACTIVE_DELIVERY_STATUSES } from "@/lib/tracking-queries";
import {
  locationReportSchema,
  MIN_REPORT_INTERVAL_SECONDS,
  type LivePosition,
} from "@/lib/validations/stage4";
import type { ActionResult } from "@/types/action-result";

/**
 * The volunteer's browser calls this about every 10 seconds while sharing.
 *
 * One conditional UPDATE does all the checks atomically (no locks needed):
 * it is the volunteer's own delivery, it is still active, and the previous fix
 * is at least MIN_REPORT_INTERVAL_SECONDS old (so a script can't flood the
 * channel). The fix is saved first, then published; if the realtime service is
 * down the position is still saved and `live` is false.
 */
export async function reportLocation(
  input: unknown,
): Promise<ActionResult<{ live: boolean }>> {
  try {
    const user = await requireRole(["VOLUNTEER"]);
    const parsed = locationReportSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { deliveryId, lat, lng, heading, speedMps } = parsed.data;

    const updated = await db
      .update(deliveries)
      .set({
        lastLat: lat,
        lastLng: lng,
        lastHeading: heading ?? null,
        lastSpeedMps: speedMps ?? null,
        lastLocationAt: sql`now()`,
      })
      .where(
        and(
          eq(deliveries.id, deliveryId),
          eq(deliveries.volunteerId, user.id),
          inArray(deliveries.status, [...ACTIVE_DELIVERY_STATUSES]),
          sql`(${deliveries.lastLocationAt} IS NULL OR ${deliveries.lastLocationAt} < now() - make_interval(secs => ${MIN_REPORT_INTERVAL_SECONDS}))`,
        ),
      )
      .returning({ at: deliveries.lastLocationAt });

    if (updated.length === 0) {
      // Say why, so the browser can react sensibly.
      const [row] = await db
        .select({ status: deliveries.status })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.id, deliveryId),
            eq(deliveries.volunteerId, user.id),
          ),
        );
      if (!row)
        return { ok: false, code: "NOT_FOUND", error: "Delivery not found." };
      if (
        !(ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(row.status)
      ) {
        return {
          ok: false,
          code: "CONFLICT",
          error: "This delivery is finished, so location sharing stopped.",
        };
      }
      return { ok: false, code: "LIMIT", error: "Too many updates." };
    }

    const position: LivePosition = {
      lat,
      lng,
      heading: heading ?? null,
      speedMps: speedMps ?? null,
      at: (updated[0].at ?? new Date()).toISOString(),
    };
    const live = await publishPosition(deliveryId, position);
    return { ok: true, data: { live } };
  } catch (err) {
    return toFailure(err);
  }
}
