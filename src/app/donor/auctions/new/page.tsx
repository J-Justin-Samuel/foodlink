import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AuctionForm } from "@/components/shared/auction-form";
import { db } from "@/db";
import { donations, foodAuctions } from "@/db/schema";
import { MIN_AUCTION_KG } from "@/lib/auction-price";
import { requireDashboardUser } from "@/lib/guards";
import { getPayoutState } from "@/lib/payouts";

export const dynamic = "force-dynamic";

export default async function NewAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ donationId?: string }>;
}) {
  const { donationId } = await searchParams;
  const user = await requireDashboardUser(["DONOR"]);
  if (!donationId || !/^[0-9a-f-]{36}$/i.test(donationId)) redirect("/donor");

  const [d] = await db
    .select()
    .from(donations)
    .where(and(eq(donations.id, donationId), eq(donations.donorId, user.id)));
  const back = (
    <Link href="/donor" className="btn-glass">
      Back to donor home
    </Link>
  );
  const problem = async (): Promise<string | null> => {
    if (!d) return "We couldn't find that batch.";
    if (d.status !== "LISTED")
      return "Only a batch that is still waiting for a volunteer can be auctioned.";
    if (Number(d.quantityKg) <= MIN_AUCTION_KG)
      return `Auctions are for batches over ${MIN_AUCTION_KG} kg. This one is ${d.quantityKg} kg.`;
    if (d.shelfLifeExpiresAt.getTime() <= Date.now())
      return "This batch has expired.";
    const [existing] = await db
      .select({ id: foodAuctions.id })
      .from(foodAuctions)
      .where(eq(foodAuctions.donationId, d.id));
    if (existing) return "This batch already has an auction.";
    return null;
  };
  const why = await problem();
  const payout = await getPayoutState(user.id);

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 pb-8 pt-4">
      <h1 className="text-3xl font-extrabold">Sell this batch</h1>
      {why && (
        <>
          <p
            role="alert"
            className="rounded-2xl bg-red-50 p-3 text-sm text-red-950 ring-1 ring-red-300"
          >
            {why}
          </p>
          {back}
        </>
      )}
      {!why && payout.state !== "READY" && (
        <>
          <p className="glass rounded-2xl p-3 text-sm">
            {payout.state === "OFF"
              ? "Payments aren't set up on this server yet, so auctions can't start."
              : "Before you can sell, set up where the money should go."}
          </p>
          <div className="flex flex-wrap gap-2">
            {payout.state !== "OFF" && (
              <Link href="/donor/payouts" className="btn-flame">
                Set up payouts
              </Link>
            )}
            {back}
          </div>
        </>
      )}
      {!why && payout.state === "READY" && d && (
        <div className="glass-strong rounded-3xl p-5">
          <AuctionForm
            donationId={d.id}
            title={d.title}
            quantityKg={Number(d.quantityKg)}
            expiresAtMs={d.shelfLifeExpiresAt.getTime()}
            nowMs={Date.now()}
          />
        </div>
      )}
    </main>
  );
}
