"use server";

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  deliveries,
  disputes,
  donations,
  profiles,
  rewardLedger,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import {
  isUniqueViolation,
  toFailure,
  validationFailure,
} from "@/lib/action-utils";
import { recordPoints, type RewardEntry } from "@/lib/leaderboard";
import {
  raiseDisputeSchema,
  resolveDisputeSchema,
} from "@/lib/validations/stage6";
import type { ActionFailure, ActionResult } from "@/types/action-result";

const fail = (code: ActionFailure["code"], error: string): ActionFailure => ({
  ok: false,
  code,
  error,
});
const MAX_OPEN = 5;

/** Anyone signed in can report a problem, optionally about a delivery they took part in. */
export async function raiseDispute(
  input: unknown,
): Promise<ActionResult<{ disputeId: string }>> {
  try {
    const user = await requireRole(["DONOR", "VOLUNTEER", "NGO", "BUYER"]);
    const parsed = raiseDisputeSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { deliveryId, category, description } = parsed.data;
    let againstUserId = parsed.data.againstUserId ?? null;

    const [{ n }] = await db
      .select({ n: count() })
      .from(disputes)
      .where(
        and(
          eq(disputes.raisedBy, user.id),
          inArray(disputes.status, ["OPEN", "IN_REVIEW"]),
        ),
      );
    if (n >= MAX_OPEN)
      return fail(
        "LIMIT",
        `You already have ${MAX_OPEN} open reports. Wait for those to be reviewed first.`,
      );

    if (deliveryId) {
      const [d] = await db
        .select({
          volunteerId: deliveries.volunteerId,
          ngoId: deliveries.ngoId,
          donorId: donations.donorId,
        })
        .from(deliveries)
        .innerJoin(donations, eq(donations.id, deliveries.donationId))
        .where(eq(deliveries.id, deliveryId));
      const parties = d
        ? [d.volunteerId, d.ngoId, d.donorId].filter((x): x is string => !!x)
        : [];
      if (!d || !parties.includes(user.id))
        return fail("NOT_FOUND", "We couldn't find that delivery among yours.");
      if (
        againstUserId &&
        (againstUserId === user.id || !parties.includes(againstUserId))
      ) {
        return fail(
          "VALIDATION",
          "The person you're reporting must be part of that delivery.",
        );
      }
    } else {
      againstUserId = null;
    }

    const [row] = await db
      .insert(disputes)
      .values({
        raisedBy: user.id,
        deliveryId: deliveryId ?? null,
        againstUserId,
        category,
        description,
      })
      .returning({ id: disputes.id });
    revalidatePath("/support");
    revalidatePath("/admin/disputes");
    return { ok: true, data: { disputeId: row.id } };
  } catch (err) {
    if (isUniqueViolation(err))
      return fail(
        "CONFLICT",
        "You already have an open report about this delivery.",
      );
    return toFailure(err);
  }
}

/** Admin: take a report into review, resolve it (optionally with penalty points for a volunteer), or dismiss it. */
export async function resolveDispute(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  try {
    const admin = await requireRole(["ADMIN"]);
    const parsed = resolveDisputeSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { disputeId, outcome, note } = parsed.data;
    const penalty =
      outcome === "RESOLVED" ? (parsed.data.penaltyPoints ?? 0) : 0;
    if (outcome !== "IN_REVIEW" && (note?.length ?? 0) < 5)
      return fail(
        "VALIDATION",
        "Please write the decision for both people (at least 5 characters).",
      );

    let entry: RewardEntry | null = null;
    const res = await db.transaction(
      async (tx): Promise<ActionFailure | { ok: true }> => {
        const [d] = await tx
          .select()
          .from(disputes)
          .where(eq(disputes.id, disputeId))
          .for("update");
        if (!d) return fail("NOT_FOUND", "Report not found.");
        if (["RESOLVED", "DISMISSED"].includes(d.status))
          return fail("CONFLICT", "This report is already closed.");
        if (outcome === "IN_REVIEW" && d.status === "IN_REVIEW")
          return fail("CONFLICT", "Already in review.");
        const now = new Date();

        if (penalty > 0) {
          if (!d.againstUserId)
            return fail(
              "VALIDATION",
              "Penalty points need a named person on the report.",
            );
          const [target] = await tx
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, d.againstUserId));
          if (target?.role !== "VOLUNTEER")
            return fail(
              "VALIDATION",
              "Penalty points apply to volunteers only.",
            );
          const [l] = await tx
            .insert(rewardLedger)
            .values({
              userId: d.againstUserId,
              deliveryId: d.deliveryId,
              points: -penalty,
              reason: "PENALTY",
              metadata: { disputeId, by: admin.id },
            })
            .returning({
              id: rewardLedger.id,
              createdAt: rewardLedger.createdAt,
            });
          await tx
            .update(profiles)
            .set({
              rewardPoints: sql`${profiles.rewardPoints} - ${penalty}`,
              updatedAt: now,
            })
            .where(eq(profiles.userId, d.againstUserId));
          entry = {
            id: l.id,
            userId: d.againstUserId,
            points: -penalty,
            at: l.createdAt,
          };
        }

        await tx
          .update(disputes)
          .set({
            status: outcome,
            resolutionNote:
              outcome === "IN_REVIEW" ? d.resolutionNote : note || null,
            penaltyPoints: penalty,
            resolvedBy: outcome === "IN_REVIEW" ? null : admin.id,
            resolvedAt: outcome === "IN_REVIEW" ? null : now,
            updatedAt: now,
          })
          .where(eq(disputes.id, disputeId));
        return { ok: true };
      },
    );
    if (!res.ok) return res;
    if (entry) await recordPoints([entry]);
    revalidatePath("/admin/disputes");
    revalidatePath(`/admin/disputes/${disputeId}`);
    revalidatePath("/support");
    return { ok: true, data: { status: outcome } };
  } catch (err) {
    return toFailure(err);
  }
}
