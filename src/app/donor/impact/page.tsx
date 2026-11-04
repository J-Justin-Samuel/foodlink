import Link from "next/link";
import { and, eq, inArray, or } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";
import { ReportButton } from "@/components/shared/report-button";
import { db } from "@/db";
import { esgReports } from "@/db/schema";
import { quarterLabel, quarterOf, recentQuarters } from "@/lib/esg";
import { impactSummary, quarterImpact } from "@/lib/esg-queries";
import { requireDashboardUser } from "@/lib/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impact - FoodLink" };
const n = (x: number, d = 0) =>
  x.toLocaleString("en-IN", { maximumFractionDigits: d });

export default async function DonorImpactPage() {
  const user = await requireDashboardUser(["DONOR", "ADMIN"]);
  const now = new Date();
  const cur = quarterOf(now);
  const past = recentQuarters(now, 8);
  const [all, thisQ, reports, pastImpact] = await Promise.all([
    impactSummary({ donorId: user.id }),
    quarterImpact(cur, user.id),
    db
      .select()
      .from(esgReports)
      .where(
        and(
          eq(esgReports.donorId, user.id),
          or(
            ...past.map((q) =>
              and(
                eq(esgReports.year, q.year),
                eq(esgReports.quarter, q.quarter),
              ),
            ),
          ),
        ),
      ),
    Promise.all(past.map((q) => quarterImpact(q, user.id))),
  ]);
  const byKey = new Map(reports.map((r) => [`${r.year}-${r.quarter}`, r]));
  const tiles = [
    { v: n(all.foodKg, 1), l: "kg of food rescued" },
    { v: n(all.meals), l: "meals" },
    { v: n(all.co2eKg, 1), l: "kg CO2e diverted" },
    { v: n(all.waterL), l: "litres of water conserved" },
  ];
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Your impact</h1>
        <p className="text-sm text-muted-foreground">
          Counted from deliveries that reached an NGO. {n(all.deliveries)} so
          far. {quarterLabel(cur)} to date: {n(thisQ.foodKg, 1)} kg,{" "}
          {n(thisQ.meals)} meals.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.l} className="rounded-lg border-2 border-foreground p-4">
            <p className="text-3xl font-bold">{t.v}</p>
            <p className="text-sm">{t.l}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Each kg of food counts as 2.5 kg CO2e diverted and 1,200 litres of water
        conserved. One meal is 0.4 kg.
      </p>

      <section className="space-y-3" aria-labelledby="rep-h">
        <h2 id="rep-h" className="font-semibold">
          Quarterly CSR and donation reports
        </h2>
        <p className="text-sm text-muted-foreground">
          A signed PDF for each finished quarter: impact totals plus a record of
          every donation and who received it. It is a donation record for your
          accountant. It is not tax advice and carries no money value.
        </p>
        <ul className="divide-y rounded-lg border-2 border-foreground">
          {past.map((q, idx) => {
            const imp = pastImpact[idx];
            const r = byKey.get(`${q.year}-${q.quarter}`);
            return (
              <li
                key={`${q.year}-${q.quarter}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-semibold">{quarterLabel(q)}</span>
                  <span className="block text-muted-foreground">
                    {imp.deliveries === 0
                      ? "No deliveries"
                      : `${imp.deliveries} deliveries · ${n(imp.foodKg, 1)} kg · ${n(imp.meals)} meals`}
                  </span>
                </span>
                {r ? (
                  <a
                    href={`/api/reports/${r.id}/pdf`}
                    download
                    className={buttonVariants()}
                  >
                    Download PDF
                  </a>
                ) : imp.deliveries === 0 ? null : (
                  <ReportButton
                    year={q.year}
                    quarter={q.quarter}
                    label={quarterLabel(q)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <Link href="/donor" className={buttonVariants({ variant: "outline" })}>
        Back to my donations
      </Link>
    </main>
  );
}
