import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { AuctionCheckout } from "@/components/shared/auction-checkout";
import { FoodPhotoGallery } from "@/components/shared/food-photo";
import { getAuctionDetail } from "@/lib/auction-queries";
import { buyerCanBuy } from "@/lib/buyer-eligibility";
import { requireDashboardUser } from "@/lib/guards";
import { formatMoney } from "@/lib/money";
import { paymentCurrency, paymentsMode } from "@/lib/payments";
import { isRealtimeConfigured } from "@/lib/realtime";
import { formatTimeLeft } from "@/lib/urgency";
import { CLASSIFICATION_LABELS } from "@/types/donation";

export const dynamic = "force-dynamic";

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireDashboardUser(["BUYER", "ADMIN"]);
  const detail = await getAuctionDetail(id, user.id);
  if (!detail) notFound();
  const { card: a, serverNowMs, myOrder, soldToSomeoneElse } = detail;
  const mode = paymentsMode();
  const currency = paymentCurrency();
  const open =
    a.status === "ACTIVE" &&
    new Date(a.expiresAt).getTime() > serverNowMs &&
    !soldToSomeoneElse &&
    !myOrder?.status.startsWith("AUTH");
  const mine =
    myOrder &&
    ["AUTHORIZED", "CAPTURE_REQUESTED", "CAPTURED"].includes(myOrder.status);
  const blocked =
    buyerCanBuy(user) ??
    (mode === "off" ? "Payments aren't set up on this server yet." : null);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <AutoRefresh everyMs={20000} />
      <Link
        href="/buyer"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        ← All auctions
      </Link>

      <FoodPhotoGallery photos={a.photos} title={a.title} />

      <div>
        <h1 className="text-2xl font-bold">{a.title}</h1>
        <p className="text-sm text-muted-foreground">
          {a.donorName ?? "Donor"} · {a.quantityKg} kg · {a.servings} servings ·{" "}
          {CLASSIFICATION_LABELS[a.classification]}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatTimeLeft(a.expiresAt)}
          {a.distanceKm !== null
            ? ` · ${a.distanceKm.toFixed(1)} km from you`
            : ""}
          {a.address ? ` · ${a.address}` : ""}
        </p>
      </div>

      {a.items.length > 0 && (
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {a.items.map((it, k) => (
            <li key={k}>
              {it.name} — {it.quantity}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        Starts at {formatMoney(a.startMinor, currency)}, falls by{" "}
        {formatMoney(a.stepMinor, currency)} every {a.intervalMinutes} minutes,
        never below {formatMoney(a.floorMinor, currency)}.
      </p>

      {mine ? (
        <div
          role="status"
          className="space-y-2 rounded-lg border-2 border-green-600 p-4"
        >
          <p className="font-semibold">
            You bought this for {formatMoney(myOrder!.amountMinor, currency)}.
          </p>
          <Link
            href="/buyer#purchases"
            className={buttonVariants({ size: "sm" })}
          >
            Go to my purchases
          </Link>
        </div>
      ) : open && (mode === "stripe" || mode === "mock") ? (
        <AuctionCheckout
          auctionId={a.id}
          serverNowMs={serverNowMs}
          realtime={isRealtimeConfigured()}
          currency={currency}
          mode={mode}
          blockedReason={blocked}
          pricing={{
            startMinor: a.startMinor,
            floorMinor: a.floorMinor,
            stepMinor: a.stepMinor,
            intervalMinutes: a.intervalMinutes,
            startsAtMs: a.startsAtMs,
          }}
        />
      ) : (
        <p className="rounded-lg border-2 border-dashed p-4 text-sm">
          {soldToSomeoneElse || a.status === "SOLD"
            ? "Someone else bought this batch."
            : a.status === "CANCELLED"
              ? "This auction ended and the food is now being given away free."
              : "This auction has ended."}
        </p>
      )}
    </main>
  );
}
