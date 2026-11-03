import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payoutAccounts } from "@/db/schema";
import { getPayments, paymentsMode } from "@/lib/payments";

export type PayoutState = "OFF" | "NONE" | "INCOMPLETE" | "READY";

export async function getPayoutState(
  userId: string,
): Promise<{ state: PayoutState; accountId: string | null }> {
  if (paymentsMode() === "off") return { state: "OFF", accountId: null };
  const [row] = await db
    .select()
    .from(payoutAccounts)
    .where(eq(payoutAccounts.userId, userId));
  if (!row) return { state: "NONE", accountId: null };
  return {
    state: row.payoutsEnabled ? "READY" : "INCOMPLETE",
    accountId: row.providerAccountId,
  };
}

/** Re-reads the account from the payment provider and stores whether payouts are switched on. */
export async function refreshPayoutAccount(
  userId: string,
): Promise<PayoutState> {
  const [row] = await db
    .select()
    .from(payoutAccounts)
    .where(eq(payoutAccounts.userId, userId));
  if (!row) return "NONE";
  const status = await getPayments().connect.getAccountStatus(
    row.providerAccountId,
  );
  await db
    .update(payoutAccounts)
    .set({
      detailsSubmitted: status.detailsSubmitted,
      payoutsEnabled: status.payoutsEnabled,
      updatedAt: new Date(),
    })
    .where(eq(payoutAccounts.userId, userId));
  return status.payoutsEnabled ? "READY" : "INCOMPLETE";
}
