import Link from "next/link";
import { and, eq, inArray, or } from "drizzle-orm";
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
    {
      v: n(all.foodKg, 1),
      l: "kg of food rescued",
      e: "🥗",
      tone: "bg-gradient-to-br from-peach to-white",
    },
    {
      v: n(all.meals),
      l: "meals",
      e: "🍽️",
      tone: "bg-gradient-to-br from-peach to-white",
    },
    {
      v: n(all.co2eKg, 1),
      l: "kg CO2e diverted",
      e: "🌍",
      tone: "bg-gradient-to-br from-fresh/20 to-white",
    },
    {
      v: n(all.waterL),
      l: "litres of water conserved",
      e: "💧",
      tone: "bg-gradient-to-br from-fresh/20 to-white",
    },
  ];
  return (
    <main className="mx-auto w-full max-w-3xl space-y-7 px-4 pb-8 pt-4">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Your impact</h1>
        <p className="text-sm text-ink/70">
          Counted from deliveries that reached an NGO. {n(all.deliveries)} so
          far. {quarterLabel(cur)} to date: {n(thisQ.foodKg, 1)} kg,{" "}
          {n(thisQ.meals)} meals.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li
            key={t.l}
            className={`lift relative overflow-hidden rounded-3xl p-5 ring-1 ring-black/5 ${t.tone}`}
          >
            <span
              aria-hidden
              className="absolute right-4 top-3 text-4xl opacity-90"
            >
              {t.e}
            </span>
            <p className="font-display text-4xl font-extrabold text-forest">
              {t.v}
            </p>
            <p className="text-sm font-medium text-ink/75">{t.l}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink/70">
        Each kg of food counts as 2.5 kg CO2e diverted and 1,200 litres of water
        conserved. One meal is 0.4 kg.
      </p>

      <section className="space-y-3" aria-labelledby="rep-h">
        <h2 id="rep-h" className="text-xl font-bold">
          Quarterly CSR and donation reports
        </h2>
        <p className="text-sm text-ink/70">
          A signed PDF for each finished quarter: impact totals plus a record of
          every donation and who received it. It is a donation record for your
          accountant. It is not tax advice and carries no money value.
        </p>
        <ul className="glass-strong divide-y divide-black/5 overflow-hidden rounded-3xl">
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
                  <span className="block text-ink/70">
                    {imp.deliveries === 0
                      ? "No deliveries"
                      : `${imp.deliveries} deliveries · ${n(imp.foodKg, 1)} kg · ${n(imp.meals)} meals`}
                  </span>
                </span>
                {r ? (
                  <a
                    href={`/api/reports/${r.id}/pdf`}
                    download
                    className="btn-flame btn-sm"
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
      <Link href="/donor" className="btn-glass">
        Back to donor home
      </Link>
    </main>
  );
}
