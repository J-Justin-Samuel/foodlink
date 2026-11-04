"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { toFailure, validationFailure } from "@/lib/action-utils";
import { generateReport } from "@/lib/esg-reports";
import { runQuarterlyReports } from "@/lib/jobs/stage6";
import { quarterSchema } from "@/lib/validations/stage6";
import type { Quarter } from "@/lib/esg";
import type { ActionResult } from "@/types/action-result";

/** A donor creates the report for one of their completed quarters (the quarterly job does this automatically too). */
export async function generateMyReport(
  input: unknown,
): Promise<ActionResult<{ reportId: string }>> {
  try {
    const user = await requireRole(["DONOR"]);
    const parsed = quarterSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const r = await generateReport(user.id, parsed.data as Quarter);
    if (!r.ok) return { ok: false, code: "CONFLICT", error: r.error };
    revalidatePath("/donor/impact");
    return { ok: true, data: { reportId: r.report.id } };
  } catch (err) {
    return toFailure(err);
  }
}

/** Admin: run the quarterly job now for last quarter. */
export async function generateLastQuarterReports(): Promise<
  ActionResult<{
    created: number;
    existing: number;
    failed: number;
    label: string;
  }>
> {
  try {
    await requireRole(["ADMIN"]);
    const r = await runQuarterlyReports();
    revalidatePath("/admin/impact");
    return {
      ok: true,
      data: {
        created: r.created,
        existing: r.existing,
        failed: r.failed,
        label: `Q${r.quarter.quarter} ${r.quarter.year}`,
      },
    };
  } catch (err) {
    return toFailure(err);
  }
}
