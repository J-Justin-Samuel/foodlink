/**
 * Freshness Index (0-100) — pure functions, no server-only imports.
 *
 * The SERVER is the source of truth: `submitFreshnessScan` recomputes the
 * score from the raw readings and ignores anything the client claims. The
 * browser imports this same file only to draw the live gauge while the
 * sensor streams, so the preview can never disagree with the saved result.
 *
 * Score = 100 − TVOC penalty − temperature penalty − humidity penalty
 *
 *  TVOC (MQ-135)     0 up to 220 ppm (baseline), then rises linearly to
 *                    −65 at 1000 ppm and above.
 *  Temperature       inside the bacterial danger zone (15–55 °C, inclusive)
 *  (MLX90614)        −35, and a further −10 in the fast-growth band 25–45 °C.
 *  Humidity (DHT22)  0 up to 60 % RH, then rises linearly to −15 at 90 %+
 *                    (mould / moisture).
 *
 * Status:  SAFE >= 70  |  CONSUME_SOON 40–69  |  SPOILED < 40
 */

export const FRESHNESS = {
  TVOC_BASELINE_PPM: 220,
  TVOC_FULL_PENALTY_PPM: 1000,
  TVOC_MAX_PENALTY: 65,

  DANGER_ZONE_MIN_C: 15,
  DANGER_ZONE_MAX_C: 55,
  DANGER_ZONE_PENALTY: 35,
  FAST_GROWTH_MIN_C: 25,
  FAST_GROWTH_MAX_C: 45,
  FAST_GROWTH_EXTRA_PENALTY: 10,

  HUMIDITY_START_PCT: 60,
  HUMIDITY_FULL_PCT: 90,
  HUMIDITY_MAX_PENALTY: 15,

  SAFE_MIN: 70,
  CONSUME_SOON_MIN: 40,
} as const;

export type FreshnessStatus = "SAFE" | "CONSUME_SOON" | "SPOILED";

export interface SensorReading {
  /** Total volatile organic compounds, ppm (MQ-135). */
  tvocPpm: number;
  /** Surface temperature, °C (MLX90614 infrared). */
  surfaceTempC: number;
  /** Relative ambient humidity, % (DHT22). */
  humidityPct: number;
}

export interface FreshnessResult {
  score: number;
  status: FreshnessStatus;
  penalties: { tvoc: number; temperature: number; humidity: number };
  /** Human-readable explanation of every deduction. */
  reasons: string[];
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function statusForScore(score: number): FreshnessStatus {
  if (score >= FRESHNESS.SAFE_MIN) return "SAFE";
  if (score >= FRESHNESS.CONSUME_SOON_MIN) return "CONSUME_SOON";
  return "SPOILED";
}

export function computeFreshness(r: SensorReading): FreshnessResult {
  const F = FRESHNESS;
  const reasons: string[] = [];

  // --- TVOC ---------------------------------------------------------------
  let tvoc = 0;
  if (r.tvocPpm > F.TVOC_BASELINE_PPM) {
    const span = F.TVOC_FULL_PENALTY_PPM - F.TVOC_BASELINE_PPM;
    tvoc =
      F.TVOC_MAX_PENALTY *
      clamp((r.tvocPpm - F.TVOC_BASELINE_PPM) / span, 0, 1);
    tvoc = round1(tvoc);
    reasons.push(
      `TVOC ${Math.round(r.tvocPpm)} ppm is above the ${F.TVOC_BASELINE_PPM} ppm baseline (−${tvoc})`,
    );
  }

  // --- Temperature --------------------------------------------------------
  let temperature = 0;
  if (
    r.surfaceTempC >= F.DANGER_ZONE_MIN_C &&
    r.surfaceTempC <= F.DANGER_ZONE_MAX_C
  ) {
    temperature = F.DANGER_ZONE_PENALTY;
    reasons.push(
      `Surface temperature ${r.surfaceTempC.toFixed(1)} °C is in the bacterial danger zone (${F.DANGER_ZONE_MIN_C}–${F.DANGER_ZONE_MAX_C} °C) (−${F.DANGER_ZONE_PENALTY})`,
    );
    if (
      r.surfaceTempC >= F.FAST_GROWTH_MIN_C &&
      r.surfaceTempC <= F.FAST_GROWTH_MAX_C
    ) {
      temperature += F.FAST_GROWTH_EXTRA_PENALTY;
      reasons.push(
        `…and in the fast-growth band (${F.FAST_GROWTH_MIN_C}–${F.FAST_GROWTH_MAX_C} °C) (−${F.FAST_GROWTH_EXTRA_PENALTY})`,
      );
    }
  }

  // --- Humidity -----------------------------------------------------------
  let humidity = 0;
  if (r.humidityPct > F.HUMIDITY_START_PCT) {
    const span = F.HUMIDITY_FULL_PCT - F.HUMIDITY_START_PCT;
    humidity =
      F.HUMIDITY_MAX_PENALTY *
      clamp((r.humidityPct - F.HUMIDITY_START_PCT) / span, 0, 1);
    humidity = round1(humidity);
    reasons.push(
      `Humidity ${Math.round(r.humidityPct)} % is above ${F.HUMIDITY_START_PCT} % (−${humidity})`,
    );
  }

  const score = Math.round(clamp(100 - tvoc - temperature - humidity, 0, 100));
  if (reasons.length === 0) reasons.push("All readings are within safe limits");

  return {
    score,
    status: statusForScore(score),
    penalties: { tvoc, temperature, humidity },
    reasons,
  };
}

export const STATUS_META: Record<
  FreshnessStatus,
  { label: string; hex: string; badgeClass: string; advice: string }
> = {
  SAFE: {
    label: "Safe",
    hex: "#16a34a",
    badgeClass: "bg-green-100 text-green-800",
    advice: "Good to deliver for human consumption.",
  },
  CONSUME_SOON: {
    label: "Consume soon",
    hex: "#d97706",
    badgeClass: "bg-amber-100 text-amber-800",
    advice: "Deliver quickly — it should be eaten right away.",
  },
  SPOILED: {
    label: "Spoiled",
    hex: "#dc2626",
    badgeClass: "bg-red-100 text-red-800",
    advice:
      "Not safe for people. The batch is pulled from claiming and reclassified.",
  },
};

export type Disposition = "HUMAN_CONSUMPTION" | "COMPOSTING" | "ANIMAL_SHELTER";

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  HUMAN_CONSUMPTION: "Human consumption",
  COMPOSTING: "Composting",
  ANIMAL_SHELTER: "Animal shelter",
};

/**
 * Where a SPOILED batch goes next.
 * POLICY PLACEHOLDER — confirm the rule with a food-safety advisor and the
 * receiving shelter before relying on it: borderline-spoiled cooked/raw food
 * (score 20–39) is offered to animal shelters; anything worse, and all
 * packaged food, goes to composting.
 */
export function chooseDisposition(
  score: number,
  classification: "COOKED" | "PACKAGED" | "RAW",
): Exclude<Disposition, "HUMAN_CONSUMPTION"> {
  return score >= 20 && classification !== "PACKAGED"
    ? "ANIMAL_SHELTER"
    : "COMPOSTING";
}
