import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { esgReports } from "@/db/schema";
import {
  hashMatches,
  newSerial,
  reportParts,
  sign,
} from "@/lib/certificate-hash";
import {
  isCompletedQuarter,
  quarterLabel,
  quarterRange,
  type Quarter,
} from "@/lib/esg";
import { quarterImpact } from "@/lib/esg-queries";
import { isUniqueViolation } from "@/lib/action-utils";
import type { ReportData, ReportLine } from "@/lib/pdf/esg-report";
import type { Verification } from "@/lib/certificates";

export type EsgReport = typeof esgReports.$inferSelect;
const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];

/** Creates (once) the stored summary for a donor's completed quarter. A quarter with no deliveries gets no report. */
export async function generateReport(
  donorId: string,
  q: Quarter,
  now = new Date(),
): Promise<
  { ok: true; report: EsgReport; isNew: boolean } | { ok: false; error: string }
> {
  if (!isCompletedQuarter(q, now))
    return {
      ok: false,
      error: `${quarterLabel(q)} isn't over yet. Reports are made when a quarter ends.`,
    };
  const [existing] = await db
    .select()
    .from(esgReports)
    .where(
      and(
        eq(esgReports.donorId, donorId),
        eq(esgReports.year, q.year),
        eq(esgReports.quarter, q.quarter),
      ),
    );
  if (existing) return { ok: true, report: existing, isNew: false };

  const imp = await quarterImpact(q, donorId);
  if (imp.deliveries === 0)
    return {
      ok: false,
      error: `No completed deliveries in ${quarterLabel(q)}.`,
    };

  for (let attempt = 0; attempt < 3; attempt++) {
    const base = {
      serial: newSerial("ESG"),
      donorId,
      year: q.year,
      quarter: q.quarter,
      deliveriesCount: imp.deliveries,
      foodKg: imp.foodKg.toFixed(2),
      co2eKg: imp.co2eKg.toFixed(2),
      waterL: imp.waterL.toFixed(2),
      meals: imp.meals,
    };
    try {
      const [row] = await db
        .insert(esgReports)
        .values({ ...base, generatedAt: now, hash: sign(reportParts(base)) })
        .onConflictDoNothing({
          target: [esgReports.donorId, esgReports.year, esgReports.quarter],
        })
        .returning();
      if (row) return { ok: true, report: row, isNew: true };
      const [again] = await db
        .select()
        .from(esgReports)
        .where(
          and(
            eq(esgReports.donorId, donorId),
            eq(esgReports.year, q.year),
            eq(esgReports.quarter, q.quarter),
          ),
        );
      if (again) return { ok: true, report: again, isNew: false };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return { ok: false, error: "Could not create the report. Please try again." };
}

/** Quarterly job: a report for every donor who had deliveries in `q`. */
export async function generateReportsForQuarter(
  q: Quarter,
  now = new Date(),
): Promise<{ created: number; existing: number; failed: number }> {
  const { start, end } = quarterRange(q);
  const donors = await rows<{ donor_id: string }>(sql`
    SELECT DISTINCT d.donor_id FROM deliveries x JOIN donations d ON d.id = x.donation_id
    WHERE x.status = 'DELIVERED' AND x.dropoff_confirmed_at >= ${start.toISOString()}::timestamptz AND x.dropoff_confirmed_at < ${end.toISOString()}::timestamptz
  `);
  const out = { created: 0, existing: 0, failed: 0 };
  for (const d of donors) {
    try {
      const r = await generateReport(d.donor_id, q, now);
      if (!r.ok) out.failed++;
      else if (r.isNew) out.created++;
      else out.existing++;
    } catch (err) {
      console.error("[esg] report failed", d.donor_id, err);
      out.failed++;
    }
  }
  return out;
}

const fmtDay = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(d);

/** Everything the PDF prints: stored totals plus the donation list (completed deliveries are never edited, so it is stable). */
export async function reportPdfData(report: EsgReport): Promise<ReportData> {
  const { start, end } = quarterRange({
    year: report.year,
    quarter: report.quarter as Quarter["quarter"],
  });
  const [donor] = await rows<{ name: string; license: string | null }>(sql`
    SELECT COALESCE(p.organization_name, p.display_name) AS name,
           NULLIF(concat_ws(' ', p.license_type, p.license_number), '') AS license
    FROM profiles p WHERE p.user_id = ${report.donorId}
  `);
  const lines = await rows<{
    at: Date;
    title: string;
    recipient: string | null;
    lic: string | null;
    kg: string;
  }>(sql`
    SELECT x.dropoff_confirmed_at AS at, d.title,
           COALESCE(np.organization_name, np.display_name) AS recipient,
           NULLIF(concat_ws(' ', np.license_type, np.license_number), '') AS lic,
           d.quantity_kg AS kg
    FROM deliveries x JOIN donations d ON d.id = x.donation_id
    LEFT JOIN profiles np ON np.user_id = x.ngo_id
    WHERE d.donor_id = ${report.donorId} AND x.status = 'DELIVERED'
      AND x.dropoff_confirmed_at >= ${start.toISOString()}::timestamptz AND x.dropoff_confirmed_at < ${end.toISOString()}::timestamptz
    ORDER BY x.dropoff_confirmed_at
  `);
  const lastDay = new Date(end.getTime() - 86_400_000);
  const out: ReportLine[] = lines.map((l) => ({
    date: fmtDay(new Date(l.at)),
    title: l.title,
    recipient: l.recipient ?? "-",
    recipientLicense: l.lic,
    kg: Number(l.kg),
  }));
  return {
    serial: report.serial,
    hash: report.hash,
    donorName: donor?.name ?? "Donor",
    donorLicense: donor?.license ?? null,
    label: quarterLabel({
      year: report.year,
      quarter: report.quarter as Quarter["quarter"],
    }),
    periodText: `${fmtDay(start)} to ${fmtDay(lastDay)}`,
    generatedAt: report.generatedAt,
    deliveries: report.deliveriesCount,
    foodKg: Number(report.foodKg),
    co2eKg: Number(report.co2eKg),
    waterL: Number(report.waterL),
    meals: report.meals,
    lines: out,
  };
}

export async function verifyReport(
  serial: string,
  h: string | null,
): Promise<Verification> {
  const [r] = await db
    .select()
    .from(esgReports)
    .where(eq(esgReports.serial, serial));
  if (!r) return { status: "NOT_FOUND", serial };
  const ok =
    hashMatches(sign(reportParts(r)), r.hash) &&
    (!h || r.hash.startsWith(h.toLowerCase()));
  if (!ok) return { status: "INVALID", serial };
  const [d] = await rows<{ name: string }>(
    sql`SELECT COALESCE(organization_name, display_name) AS name FROM profiles WHERE user_id = ${r.donorId}`,
  );
  return {
    status: "VALID",
    kind: "REPORT",
    serial,
    name: d?.name ?? "Donor",
    summary: `${quarterLabel({ year: r.year, quarter: r.quarter as Quarter["quarter"] })}: ${Number(r.foodKg).toFixed(1)} kg of food diverted, ${r.meals} meals, ${Number(r.co2eKg).toFixed(1)} kg CO2e`,
    issuedAt: r.generatedAt,
  };
}
