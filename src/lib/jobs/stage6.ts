import "server-only";
import { generateReportsForQuarter } from "@/lib/esg-reports";
import { previousQuarter } from "@/lib/esg";
import { rebuildLeaderboards } from "@/lib/leaderboard";

export async function runQuarterlyReports(now = new Date()) {
  const q = previousQuarter(now);
  return { quarter: q, ...(await generateReportsForQuarter(q, now)) };
}

export const runLeaderboardRebuild = (now = new Date()) =>
  rebuildLeaderboards(now);
