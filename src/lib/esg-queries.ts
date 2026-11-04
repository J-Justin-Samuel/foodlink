import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  impactFromHundredths,
  quarterRange,
  type Impact,
  type Quarter,
} from "@/lib/esg";

const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];

/** Completed deliveries only. `donorId` limits to one donor; the range is [start, end) on the drop-off confirmation time. */
async function sumHundredths(opts: {
  donorId?: string;
  start?: Date;
  end?: Date;
}): Promise<{ hundredths: number; deliveries: number }> {
  const [r] = await rows<{ h: string; n: number }>(sql`
    SELECT COALESCE(SUM(ROUND(d.quantity_kg * 100)), 0)::bigint AS h, count(*)::int AS n
    FROM deliveries x JOIN donations d ON d.id = x.donation_id
    WHERE x.status = 'DELIVERED' AND x.dropoff_confirmed_at IS NOT NULL
      ${opts.donorId ? sql`AND d.donor_id = ${opts.donorId}` : sql``}
      ${opts.start ? sql`AND x.dropoff_confirmed_at >= ${opts.start.toISOString()}::timestamptz` : sql``}
      ${opts.end ? sql`AND x.dropoff_confirmed_at < ${opts.end.toISOString()}::timestamptz` : sql``}
  `);
  return { hundredths: Number(r.h), deliveries: r.n };
}

export interface ImpactSummary extends Impact {
  deliveries: number;
}

export async function impactSummary(
  opts: { donorId?: string; start?: Date; end?: Date } = {},
): Promise<ImpactSummary> {
  const { hundredths, deliveries } = await sumHundredths(opts);
  return { ...impactFromHundredths(hundredths), deliveries };
}

export const quarterImpact = (q: Quarter, donorId?: string) => {
  const { start, end } = quarterRange(q);
  return impactSummary({ donorId, start, end });
};

export interface PlatformStats {
  impact: ImpactSummary;
  donors: number;
  volunteers: number;
  ngos: number;
  today: ImpactSummary;
}

export async function platformStats(now = new Date()): Promise<PlatformStats> {
  const [c] = await rows<{
    donors: number;
    volunteers: number;
    ngos: number;
  }>(sql`
    SELECT (SELECT count(DISTINCT d.donor_id) FROM deliveries x JOIN donations d ON d.id = x.donation_id WHERE x.status = 'DELIVERED')::int AS donors,
           (SELECT count(DISTINCT volunteer_id) FROM deliveries WHERE status = 'DELIVERED')::int AS volunteers,
           (SELECT count(DISTINCT ngo_id) FROM deliveries WHERE status = 'DELIVERED')::int AS ngos
  `);
  const dayStart = new Date(
    Math.floor((now.getTime() + 5.5 * 3600_000) / 86_400_000) * 86_400_000 -
      5.5 * 3600_000,
  );
  return {
    impact: await impactSummary(),
    today: await impactSummary({ start: dayStart }),
    ...c,
  };
}

export interface QuarterRow {
  year: number;
  quarter: number;
  impact: ImpactSummary;
}

/** Month-by-quarter series for the admin chart, oldest first. */
export async function quarterSeries(
  quarters: Quarter[],
): Promise<QuarterRow[]> {
  const out: QuarterRow[] = [];
  for (const q of [...quarters].reverse())
    out.push({ ...q, impact: await quarterImpact(q) });
  return out;
}
