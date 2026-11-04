"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { toFailure } from "@/lib/action-utils";
import { issueCertificate } from "@/lib/certificates";
import type { ActionResult } from "@/types/action-result";

/** The volunteer asks for a certificate covering their deliveries so far. */
export async function issueMyCertificate(): Promise<
  ActionResult<{ certificateId: string; isNew: boolean }>
> {
  try {
    const user = await requireRole(["VOLUNTEER"]);
    const r = await issueCertificate(user.id);
    if (!r.ok) return { ok: false, code: "CONFLICT", error: r.error };
    revalidatePath("/volunteer/rewards");
    return {
      ok: true,
      data: { certificateId: r.certificate.id, isNew: r.isNew },
    };
  } catch (err) {
    return toFailure(err);
  }
}
