import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";
import { CertificateButton } from "@/components/shared/certificate-button";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import { requireDashboardUser } from "@/lib/guards";
import { getLeaderboard } from "@/lib/leaderboard";
import {
  PERIODS,
  isPeriod,
  periodLabel,
  type Period,
} from "@/lib/reward-points";
import { getMyRewards } from "@/lib/rewards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards - FoodLink" };

const REASON: Record<string, string> = {
  DELIVERY_COMPLETED: "Delivery completed",
  QUALITY_VERIFIED: "Food quality verified",
  PENALTY: "Penalty after a report",
  MANUAL_ADJUSTMENT: "Adjustment by FoodLink",
};
const when = (d: Date | string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireDashboardUser(["VOLUNTEER", "ADMIN"]);
  const period: Period = isPeriod(sp.period) ? sp.period : "month";
  const isVolunteer = user.role === "VOLUNTEER";
  const [mine, board, certs] = await Promise.all([
    getMyRewards(user.id),
    getLeaderboard(period, 10, isVolunteer ? user.id : null),
    db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, user.id))
      .orderBy(desc(certificates.issuedAt))
      .limit(20),
  ]);
  const kg = mine.foodKgHundredths / 100;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Points for every delivery, with a bonus when the food passes the
            quality scan.
          </p>
        </div>
        <Link href="/volunteer/discover" className={buttonVariants()}>
          Find pickups
        </Link>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {[
          { v: mine.points.toLocaleString("en-IN"), l: "points" },
          { v: String(mine.deliveries), l: "deliveries" },
          {
            v: kg.toLocaleString("en-IN", { maximumFractionDigits: 1 }),
            l: "kg of food moved",
          },
        ].map((t) => (
          <li key={t.l} className="rounded-lg border-2 border-foreground p-4">
            <p className="text-3xl font-bold">{t.v}</p>
            <p className="text-sm">{t.l}</p>
          </li>
        ))}
      </ul>

      <section className="space-y-3" aria-labelledby="lb-h">
        <h2 id="lb-h" className="font-semibold">
          Leaderboard
        </h2>
        <nav aria-label="Leaderboard period" className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/volunteer/rewards?period=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={`rounded-md border-2 px-3 py-1.5 text-sm font-medium ${p === period ? "border-foreground bg-foreground text-background" : "border-transparent hover:bg-muted"}`}
            >
              {periodLabel[p]}
            </Link>
          ))}
        </nav>
        {board.top.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed p-6 text-center text-sm">
            No points yet{" "}
            {period === "day"
              ? "today"
              : period === "month"
                ? "this month"
                : ""}
            . The first delivery puts you on the board.
          </p>
        ) : (
          <ol className="divide-y rounded-lg border-2 border-foreground">
            {board.top.map((r) => (
              <li
                key={r.userId}
                className={`flex items-center gap-3 px-4 py-2 text-sm ${r.userId === user.id ? "bg-muted font-semibold" : ""}`}
              >
                <span className="w-8 text-right tabular-nums">{r.rank}</span>
                <span className="flex-1 truncate">
                  {r.name}
                  {r.userId === user.id ? " (you)" : ""}
                </span>
                <span className="tabular-nums">
                  {r.points.toLocaleString("en-IN")} pts
                </span>
              </li>
            ))}
          </ol>
        )}
        {board.me && !board.top.some((r) => r.userId === user.id) && (
          <p className="text-sm">
            You are ranked <strong>{board.me.rank}</strong> with{" "}
            {board.me.points.toLocaleString("en-IN")} points.
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-semibold">
          Recent points
        </h2>
        {mine.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Points appear when a delivery is confirmed at the NGO.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border-2">
            {mine.recent.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <span>
                  {REASON[e.reason] ?? e.reason}
                  {e.title && (
                    <span className="text-muted-foreground"> · {e.title}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {when(e.at)}
                  </span>
                </span>
                <span
                  className={`font-semibold tabular-nums ${e.points < 0 ? "text-destructive" : ""}`}
                >
                  {e.points > 0 ? "+" : ""}
                  {e.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="cert-h">
        <h2 id="cert-h" className="font-semibold">
          Certificates
        </h2>
        <p className="text-sm text-muted-foreground">
          A PDF with a QR code. Anyone who scans it sees on FoodLink whether it
          is genuine.
        </p>
        {isVolunteer ? (
          <CertificateButton
            disabled={mine.deliveries === 0}
            hint={
              mine.deliveries === 0 ? "Complete a delivery first." : undefined
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Only volunteers earn certificates.
          </p>
        )}
        {certs.length > 0 && (
          <ul className="divide-y rounded-lg border-2">
            {certs.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{c.serial}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.deliveriesCount} deliveries · {when(c.issuedAt)}
                    {c.revokedAt ? " · withdrawn" : ""}
                  </span>
                </span>
                {c.revokedAt ? (
                  <span className="text-sm text-muted-foreground">
                    Withdrawn
                  </span>
                ) : (
                  <a
                    href={`/api/certificates/${c.id}/pdf`}
                    className={buttonVariants({ variant: "outline" })}
                    download
                  >
                    Download PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link
        href="/volunteer"
        className={buttonVariants({ variant: "outline" })}
      >
        Back to volunteer home
      </Link>
    </main>
  );
}
