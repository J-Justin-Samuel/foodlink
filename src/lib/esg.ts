/*
 * ESG impact formulas (pure, shared by pages, reports and tests).
 *   CO2e diverted (kg)      = food diverted (kg) x 2.5
 *   Water conserved (litres) = food diverted (kg) x 1200
 *   Standard meals           = food diverted (kg) / 0.4
 * Weights are handled as whole hundredths of a kilo so the maths is exact.
 */
export const CO2E_KG_PER_KG = 2.5;
export const WATER_L_PER_KG = 1200;
export const KG_PER_MEAL = 0.4;

export interface Impact {
  foodKg: number;
  co2eKg: number;
  waterL: number;
  meals: number;
}

export const toHundredths = (kg: number | string): number =>
  Math.round(Number(kg) * 100);

export function impactFromHundredths(h: number): Impact {
  if (!Number.isFinite(h) || h < 0)
    throw new Error("Food weight must be zero or more.");
  return {
    foodKg: h / 100,
    co2eKg: Math.round(h * CO2E_KG_PER_KG) / 100, // h * 2.5 hundredths, rounded to a hundredth
    waterL: (h * WATER_L_PER_KG) / 100,
    meals: Math.floor(h / (KG_PER_MEAL * 100)), // kg / 0.4 = hundredths / 40, whole meals only
  };
}

export const computeImpact = (foodKg: number | string): Impact =>
  impactFromHundredths(toHundredths(foodKg));

// ---- Calendar quarters, in Indian Standard Time (UTC+05:30) ------------------------------
const IST_OFFSET_MS = 5.5 * 3600_000;

export interface Quarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

export function quarterOf(date: Date): Quarter {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    quarter: (Math.floor(ist.getUTCMonth() / 3) + 1) as Quarter["quarter"],
  };
}

/** [start, end) as real instants. */
export function quarterRange({ year, quarter }: Quarter): {
  start: Date;
  end: Date;
} {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, startMonth + 3, 1) - IST_OFFSET_MS),
  };
}

export function previousQuarter(now: Date): Quarter {
  const { year, quarter } = quarterOf(now);
  return quarter === 1
    ? { year: year - 1, quarter: 4 }
    : { year, quarter: (quarter - 1) as Quarter["quarter"] };
}

export const quarterLabel = ({ year, quarter }: Quarter) =>
  `Q${quarter} ${year}`;

export const isCompletedQuarter = (q: Quarter, now: Date) =>
  quarterRange(q).end.getTime() <= now.getTime();

/** The last `n` completed quarters, newest first. */
export function recentQuarters(now: Date, n: number): Quarter[] {
  const out: Quarter[] = [];
  let q = previousQuarter(now);
  for (let i = 0; i < n; i++) {
    out.push(q);
    q =
      q.quarter === 1
        ? { year: q.year - 1, quarter: 4 }
        : { year: q.year, quarter: (q.quarter - 1) as Quarter["quarter"] };
  }
  return out;
}
