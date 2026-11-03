"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payoutAccounts } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { toFailure } from "@/lib/action-utils";
import { getPayments, paymentsMode } from "@/lib/payments";
import { refreshPayoutAccount, type PayoutState } from "@/lib/payouts";
import type { ActionResult } from "@/types/action-result";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Creates the donor's Stripe Connect account (once) and returns the page where Stripe collects their bank details. */
export async function startPayoutSetup(): Promise<
  ActionResult<{ url: string }>
> {
  try {
    const user = await requireRole(["DONOR"]);
    if (paymentsMode() === "off")
      return {
        ok: false,
        code: "CONFLICT",
        error: "Payments aren't set up on this server yet.",
      };
    const { connect } = getPayments();

    let [row] = await db
      .select()
      .from(payoutAccounts)
      .where(eq(payoutAccounts.userId, user.id));
    if (!row) {
      const { accountId } = await connect.createAccount({
        userId: user.id,
        email: user.email,
      });
      [row] = await db
        .insert(payoutAccounts)
        .values({
          userId: user.id,
          provider: paymentsMode() === "mock" ? "mock" : "stripe",
          providerAccountId: accountId,
        })
        .onConflictDoNothing()
        .returning();
      if (!row)
        [row] = await db
          .select()
          .from(payoutAccounts)
          .where(eq(payoutAccounts.userId, user.id));
    }
    const link = await connect.createOnboardingLink({
      accountId: row.providerAccountId,
      returnUrl: `${appUrl()}/donor/payouts?return=1`,
      refreshUrl: `${appUrl()}/donor/payouts?refresh=1`,
    });
    return { ok: true, data: { url: link.url } };
  } catch (err) {
    return toFailure(err);
  }
}

export async function refreshPayoutStatus(): Promise<
  ActionResult<{ state: PayoutState }>
> {
  try {
    const user = await requireRole(["DONOR"]);
    if (paymentsMode() === "off") return { ok: true, data: { state: "OFF" } };
    return { ok: true, data: { state: await refreshPayoutAccount(user.id) } };
  } catch (err) {
    return toFailure(err);
  }
}
