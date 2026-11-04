import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { GenerateReportsButton } from "@/components/shared/generate-reports-button";
import { previousQuarter, quarterLabel, recentQuarters } from "@/lib/esg";
import { platformStats, quarterSeries } from "@/lib/esg-queries";
import { requireDashboardUser } from "@/lib/guards";

export const dynamic = "force-dynamic";
const n = (x: number, d = 0) =>
  x.toLocaleString("en-IN", { maximumFractionDigits: d });

export default async function AdminImpactPage() {
  await requireDashboardUser(["ADMIN"]);
  const now = new Date();
  const [stats, series] = await Promise.all([
    platformStats(now),
    quarterSeries(recentQuarters(now, 6)),
  ]);
  const i = stats.impact;
  const max = Math.max(1, ...series.map((s) => s.impact.foodKg));
  const tiles = [
    { v: n(i.foodKg, 1), l: "kg of food delivered" },
    { v: n(i.meals), l: "meals (at 0.4 kg each)" },
    { v: n(i.co2eKg, 1), l: "kg CO2e diverted (2.5 per kg)" },
    { v: n(i.waterL), l: "litres of water conserved (1,200 per kg)" },
  ];
  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Impact and reports</h1>
        <p className="text-sm text-muted-foreground">
          {i.deliveries} completed deliveries by {stats.volunteers} volunteers,
          from {stats.donors} donors to {stats.ngos} NGOs. Today so far:{" "}
          {n(stats.today.foodKg, 1)} kg.
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

      <section className="space-y-3" aria-labelledby="q-h">
        <h2 id="q-h" className="font-semibold">
          Food delivered per quarter
        </h2>
        <ul className="space-y-2">
          {series.map((s) => (
            <li
              key={`${s.year}-${s.quarter}`}
              className="grid grid-cols-[5.5rem_1fr_6rem] items-center gap-3 text-sm"
            >
              <span>
                Q{s.quarter} {s.year}
              </span>
              <span
                className="h-5 rounded-sm bg-muted"
                role="img"
                aria-label={`${n(s.impact.foodKg, 1)} kg`}
              >
                <span
                  className="block h-5 rounded-sm bg-green-700"
                  style={{ width: `${(s.impact.foodKg / max) * 100}%` }}
                />
              </span>
              <span className="text-right">{n(s.impact.foodKg, 1)} kg</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="space-y-2 rounded-lg border-2 p-4"
        aria-labelledby="r-h"
      >
        <h2 id="r-h" className="font-semibold">
          Quarterly donor reports
        </h2>
        <p className="text-sm text-muted-foreground">
          Reports are made on the 1st of each quarter for every donor who had
          deliveries. If one is missing, make it now. Donors who already have
          one are skipped.
        </p>
        <GenerateReportsButton label={quarterLabel(previousQuarter(now))} />
      </section>
      <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
        Back to admin
      </Link>
    </main>
  );
}
