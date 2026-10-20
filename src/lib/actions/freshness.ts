"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, donations, foodQualityScans } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import { simulatorAllowed } from "@/lib/flags";
import {
  chooseDisposition,
  computeFreshness,
  type Disposition,
  type FreshnessStatus,
} from "@/lib/freshness";
import { scanInputSchema } from "@/lib/validations/stage3";
import type { ActionFailure, ActionResult } from "@/types/action-result";

export interface ScanOutcome {
  scanId: string;
  score: number;
  status: FreshnessStatus;
  reasons: string[];
  /** True when this scan pulled the batch from human consumption. */
  diverted: boolean;
  disposition: Disposition;
}

const ACTIVE_DELIVERY = ["ASSIGNED", "PICKED_UP", "EN_ROUTE"] as const;
const FINISHED_DONATION = ["DELIVERED", "EXPIRED", "CANCELLED"];
const round2 = (n: number) => Math.round(n * 100) / 100;
const fail = (code: ActionFailure["code"], error: string): ActionFailure => ({
  ok: false,
  code,
  error,
});

/**
 * Saves a sensor reading and decides the verdict ON THE SERVER — any score the
 * browser computed is ignored. A SPOILED result, in one transaction:
 *   1. marks the donation DIVERTED, which removes it from volunteer search and
 *      makes `claimDonation` refuse it,
 *   2. reclassifies it for composting or an animal shelter,
 *   3. fails any in-progress delivery of that batch.
 * Diversion is one-way: an admin (Stage 6) is the only way back.
 */
export async function submitFreshnessScan(
  input: unknown,
): Promise<ActionResult<ScanOutcome>> {
  try {
    const user = await requireRole(["DONOR", "VOLUNTEER", "NGO", "ADMIN"]);

    const parsed = scanInputSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const d = parsed.data;

    if (d.source === "SIMULATOR" && !simulatorAllowed()) {
      return fail(
        "FORBIDDEN",
        "Simulated readings are disabled on this server.",
      );
    }

    const reading = {
      tvocPpm: round2(d.tvocPpm),
      surfaceTempC: round2(d.surfaceTempC),
      humidityPct: round2(d.humidityPct),
    };
    const result = computeFreshness(reading);

    const outcome = await db.transaction(
      async (tx): Promise<ActionFailure | { ok: true; data: ScanOutcome }> => {
        // Lock order everywhere in Stage 3: donation first, then deliveries.
        const [donation] = await tx
          .select()
          .from(donations)
          .where(eq(donations.id, d.donationId))
          .for("update");
        if (!donation) return fail("NOT_FOUND", "Donation not found.");

        let related = user.role === "ADMIN" || donation.donorId === user.id;
        if (!related) {
          const mine = await tx
            .select({ id: deliveries.id })
            .from(deliveries)
            .where(
              and(
                eq(deliveries.donationId, donation.id),
                inArray(deliveries.status, [...ACTIVE_DELIVERY]),
                or(
                  eq(deliveries.volunteerId, user.id),
                  eq(deliveries.ngoId, user.id),
                ),
              ),
            )
            .limit(1);
          related = mine.length > 0;
        }
        if (!related)
          return fail(
            "FORBIDDEN",
            "You aren't part of this donation's delivery.",
          );

        if (FINISHED_DONATION.includes(donation.status)) {
          return fail(
            "CONFLICT",
            "This batch is already finished, so it can't be scanned.",
          );
        }
        if (donation.status === "DIVERTED") {
          return fail(
            "CONFLICT",
            "This batch was already pulled from human consumption after a failed scan.",
          );
        }

        const [scan] = await tx
          .insert(foodQualityScans)
          .values({
            donationId: donation.id,
            scannedByUserId: user.id,
            vocPpm: String(reading.tvocPpm),
            surfaceTempC: String(reading.surfaceTempC),
            humidityPct: String(reading.humidityPct),
            verdict: result.status,
            freshnessScore: result.score,
            source: d.source,
            rawPayload: {
              reading,
              penalties: result.penalties,
              reasons: result.reasons,
              deviceName: d.deviceName ?? null,
            },
          })
          .returning({ id: foodQualityScans.id });

        let diverted = false;
        let disposition: Disposition = donation.disposition;

        if (result.status === "SPOILED") {
          disposition = chooseDisposition(
            result.score,
            donation.foodClassification,
          );
          const now = new Date();
          await tx
            .update(donations)
            .set({
              status: "DIVERTED",
              disposition,
              divertedAt: now,
              diversionReason: `Failed freshness scan (score ${result.score}/100).`,
              updatedAt: now,
            })
            .where(eq(donations.id, donation.id));
          await tx
            .update(deliveries)
            .set({
              status: "FAILED",
              failureReason:
                "The batch failed a freshness scan and was reclassified.",
              updatedAt: now,
            })
            .where(
              and(
                eq(deliveries.donationId, donation.id),
                inArray(deliveries.status, [...ACTIVE_DELIVERY]),
              ),
            );
          diverted = true;
        }

        return {
          ok: true,
          data: {
            scanId: scan.id,
            score: result.score,
            status: result.status,
            reasons: result.reasons,
            diverted,
            disposition,
          },
        };
      },
    );

    return outcome;
  } catch (err) {
    return toFailure(err);
  }
}
