import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PayoutSetupButtons } from "@/components/shared/payout-setup";
import { requireDashboardUser } from "@/lib/guards";
import { paymentsMode } from "@/lib/payments";
import { getPayoutState, refreshPayoutAccount } from "@/lib/payouts";
import { SPLIT_PERCENT } from "@/lib/escrow-split";

export const dynamic = "force-dynamic";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; refresh?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireDashboardUser(["DONOR"]);
  let { state } = await getPayoutState(user.id);
  // Coming back from the provider's setup page: read the real status straight away.
  if (sp.return && (state === "INCOMPLETE" || state === "NONE")) {
    state = await refreshPayoutAccount(user.id).catch(() => state);
  }
  const mode = paymentsMode();

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-bold">Payouts</h1>
      <p className="text-sm text-muted-foreground">
        When a buyer pays for your food, {SPLIT_PERCENT.donor}% goes to your
        bank account. {SPLIT_PERCENT.volunteer}% reimburses the volunteer&apos;s
        fuel and {SPLIT_PERCENT.platform}% keeps FoodLink running. Money moves
        only after the buyer confirms delivery.
      </p>

      {state === "OFF" && (
        <p className="rounded-md border-2 p-3 text-sm">
          Payments aren&apos;t set up on this server yet.
        </p>
      )}
      {state === "READY" && (
        <p
          role="status"
          className="rounded-md border-2 border-green-600 p-3 text-sm font-medium"
        >
          Payouts are on. You can sell batches over 50 kg.
        </p>
      )}
      {state === "INCOMPLETE" && (
        <p className="rounded-md border-2 border-amber-500 p-3 text-sm">
          Setup isn&apos;t finished yet. Continue where you stopped.
        </p>
      )}
      {state === "NONE" && (
        <p className="rounded-md border-2 p-3 text-sm">
          Add your bank details so sale money has somewhere to go.
        </p>
      )}
      {mode === "mock" && (
        <p className="text-xs text-muted-foreground">
          Test mode: no real bank details are collected.
        </p>
      )}

      {state !== "OFF" && <PayoutSetupButtons state={state} />}
      <Link href="/donor" className={buttonVariants({ variant: "outline" })}>
        Back to my donations
      </Link>
    </main>
  );
}
