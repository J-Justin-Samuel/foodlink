"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { licenseAudits, profiles, users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import {
  auditLicenseSchema,
  reviewUserSchema,
  setActiveSchema,
} from "@/lib/validations/stage6";
import type { ActionFailure, ActionResult } from "@/types/action-result";

const fail = (code: ActionFailure["code"], error: string): ActionFailure => ({
  ok: false,
  code,
  error,
});

/** Keeps the session claim in step with the database. Best effort: dashboards check the database anyway. */
async function mirrorStatus(
  externalAuthId: string,
  role: string,
  status: string,
) {
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(externalAuthId, {
      publicMetadata: { role, onboardingStatus: status },
    });
  } catch (err) {
    console.error("could not mirror status to Clerk:", err);
  }
}

const refresh = (id: string) => {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
};

// ---------------------------------------------------------------------------
// Approve or reject a registration (NGOs, donors, buyers, volunteers)
// ---------------------------------------------------------------------------
export async function reviewUser(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  try {
    const admin = await requireRole(["ADMIN"]);
    const parsed = reviewUserSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { userId, decision, note } = parsed.data;
    if (decision === "REJECT" && (note?.length ?? 0) < 5)
      return fail(
        "VALIDATION",
        "Please tell them why (at least 5 characters), so they can fix it.",
      );
    if (userId === admin.id)
      return fail("FORBIDDEN", "You can't review your own account.");

    const result = await db.transaction(
      async (
        tx,
      ): Promise<
        ActionFailure | { ok: true; status: string; ext: string; role: string }
      > => {
        const [u] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for("update");
        if (!u) return fail("NOT_FOUND", "User not found.");
        if (u.role === "ADMIN")
          return fail("FORBIDDEN", "Admin accounts can't be reviewed here.");
        if (decision === "APPROVE" && u.onboardingStatus !== "SUBMITTED") {
          return fail(
            "CONFLICT",
            u.onboardingStatus === "VERIFIED"
              ? "Already approved."
              : "This account hasn't submitted its details.",
          );
        }
        if (
          decision === "REJECT" &&
          !["SUBMITTED", "VERIFIED"].includes(u.onboardingStatus)
        ) {
          return fail("CONFLICT", "This account isn't waiting for review.");
        }
        const status = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
        const now = new Date();
        await tx
          .update(users)
          .set({
            onboardingStatus: status,
            reviewNote: note || null,
            reviewedBy: admin.id,
            reviewedAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, userId));
        await tx
          .update(profiles)
          .set({ verified: decision === "APPROVE", updatedAt: now })
          .where(eq(profiles.userId, userId));
        return { ok: true, status, ext: u.externalAuthId, role: u.role };
      },
    );
    if (!result.ok) return result;
    await mirrorStatus(result.ext, result.role, result.status);
    refresh(userId);
    return { ok: true, data: { status: result.status } };
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Suspend / reactivate
// ---------------------------------------------------------------------------
export async function setUserActive(
  input: unknown,
): Promise<ActionResult<{ active: boolean }>> {
  try {
    const admin = await requireRole(["ADMIN"]);
    const parsed = setActiveSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { userId, active } = parsed.data;
    if (userId === admin.id)
      return fail("FORBIDDEN", "You can't suspend yourself.");
    const [u] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId));
    if (!u) return fail("NOT_FOUND", "User not found.");
    if (u.role === "ADMIN")
      return fail("FORBIDDEN", "Admin accounts can't be suspended here.");
    await db
      .update(users)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(users.id, userId));
    refresh(userId);
    return { ok: true, data: { active } };
  } catch (err) {
    return toFailure(err);
  }
}

// ---------------------------------------------------------------------------
// License audit (append-only trail). A FAILED audit pulls the approval back.
// ---------------------------------------------------------------------------
export async function auditLicense(
  input: unknown,
): Promise<ActionResult<{ result: string }>> {
  try {
    const admin = await requireRole(["ADMIN"]);
    const parsed = auditLicenseSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { userId, result, note } = parsed.data;
    if (result === "FAILED" && (note?.length ?? 0) < 5)
      return fail(
        "VALIDATION",
        "Please say what is wrong with the licence (at least 5 characters).",
      );

    const out = await db.transaction(
      async (
        tx,
      ): Promise<
        | ActionFailure
        | { ok: true; ext?: string; role?: string; status?: string }
      > => {
        const [u] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for("update");
        if (!u) return fail("NOT_FOUND", "User not found.");
        if (u.role === "ADMIN")
          return fail("FORBIDDEN", "Admin accounts have no licence to audit.");
        const [p] = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.userId, userId));
        if (!p?.licenseNumber)
          return fail(
            "CONFLICT",
            "This account has no licence number on file.",
          );
        const now = new Date();
        await tx
          .insert(licenseAudits)
          .values({
            userId,
            auditorId: admin.id,
            result,
            licenseType: p.licenseType,
            licenseNumber: p.licenseNumber,
            note: note || null,
          });
        if (
          result === "FAILED" &&
          ["SUBMITTED", "VERIFIED"].includes(u.onboardingStatus)
        ) {
          await tx
            .update(users)
            .set({
              onboardingStatus: "REJECTED",
              reviewNote: `Licence audit failed: ${note}`,
              reviewedBy: admin.id,
              reviewedAt: now,
              updatedAt: now,
            })
            .where(eq(users.id, userId));
          await tx
            .update(profiles)
            .set({ verified: false, updatedAt: now })
            .where(eq(profiles.userId, userId));
          return {
            ok: true,
            ext: u.externalAuthId,
            role: u.role,
            status: "REJECTED",
          };
        }
        return { ok: true };
      },
    );
    if (!out.ok) return out;
    if (out.status && out.ext && out.role)
      await mirrorStatus(out.ext, out.role, out.status);
    refresh(userId);
    return { ok: true, data: { result } };
  } catch (err) {
    return toFailure(err);
  }
}
