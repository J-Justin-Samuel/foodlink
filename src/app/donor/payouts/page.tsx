import Link from "next/link";
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
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 pb-8 pt-4">
      <h1 className="text-3xl font-extrabold">Payouts</h1>
      <div
        className="glass-strong grid grid-cols-3 gap-2 rounded-3xl p-4 text-center"
        aria-label="How a sale is split"
      >
        <p>
          <span className="block font-display text-3xl font-extrabold text-flame">
            {SPLIT_PERCENT.donor}%
          </span>
          <span className="text-xs text-ink/70">You</span>
        </p>
        <p>
          <span className="block font-display text-3xl font-extrabold text-forest">
            {SPLIT_PERCENT.volunteer}%
          </span>
          <span className="text-xs text-ink/70">Volunteer&apos;s fuel</span>
        </p>
        <p>
          <span className="block font-display text-3xl font-extrabold text-ink/70">
            {SPLIT_PERCENT.platform}%
          </span>
          <span className="text-xs text-ink/70">FoodLink</span>
        </p>
      </div>
      <p className="text-sm text-ink/70">
        When a buyer pays for your food, {SPLIT_PERCENT.donor}% goes to your
        bank account. {SPLIT_PERCENT.volunteer}% reimburses the volunteer&apos;s
        fuel and {SPLIT_PERCENT.platform}% keeps FoodLink running. Money moves
        only after the buyer confirms delivery.
      </p>

      {state === "OFF" && (
        <p className="glass rounded-2xl p-3 text-sm">
          Payments aren&apos;t set up on this server yet.
        </p>
      )}
      {state === "READY" && (
        <p
          role="status"
          className="rounded-2xl bg-fresh/15 p-3 text-sm font-semibold text-forest ring-1 ring-fresh/50"
        >
          Payouts are on. You can sell batches over 50 kg.
        </p>
      )}
      {state === "INCOMPLETE" && (
        <p className="rounded-2xl bg-peach p-3 text-sm text-[#7c2d12] ring-1 ring-flame/40">
          Setup isn&apos;t finished yet. Continue where you stopped.
        </p>
      )}
      {state === "NONE" && (
        <p className="glass rounded-2xl p-3 text-sm">
          Add your bank details so sale money has somewhere to go.
        </p>
      )}
      {mode === "mock" && (
        <p className="text-xs text-ink/70">
          Test mode: no real bank details are collected.
        </p>
      )}

      {state !== "OFF" && <PayoutSetupButtons state={state} />}
      <Link href="/donor" className="btn-glass">
        Back to donor home
      </Link>
    </main>
  );
}
