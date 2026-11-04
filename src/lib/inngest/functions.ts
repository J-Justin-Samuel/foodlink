import { inngest } from "./client";
import { reconcileEscrow } from "@/lib/escrow";
import { publishPriceTiers, runCharityFallback } from "@/lib/jobs/auctions";
import { runLeaderboardRebuild, runQuarterlyReports } from "@/lib/jobs/stage6";
import {
  alertVolunteersAbout,
  claimExpiringDonations,
  sweepExpiredDonations,
} from "@/lib/jobs/expiry";

/**
 * Every 5 minutes: expire food whose hard expiry time has passed.
 * Idempotent, so a retry or an overlapping run does no harm.
 */
export const expireUncollectedFood = inngest.createFunction(
  { id: "expire-uncollected-food", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => step.run("sweep", () => sweepExpiredDonations()),
);

/**
 * Every 5 minutes: batches with 45 minutes or less left (and nobody has
 * claimed) are announced to volunteers within 15 km. Each batch is marked in
 * the same step that finds it, then alerted in its own step, so a failure only
 * retries that batch's alerts.
 */
export const alertExpiringFood = inngest.createFunction(
  { id: "alert-expiring-food", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const batches = await step.run("find-expiring", () =>
      claimExpiringDonations(),
    );
    const results = [];
    for (const b of batches) {
      results.push({
        donationId: b.id,
        ...(await step.run(`alert-${b.id}`, () => alertVolunteersAbout(b))),
      });
    }
    return { batches: batches.length, results };
  },
);

/** Every minute: wake buyers' screens when an auction's price steps down. */
export const publishAuctionPrices = inngest.createFunction(
  { id: "publish-auction-prices", triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => ({
    published: await step.run("publish-tiers", () => publishPriceTiers()),
  }),
);

/**
 * Every 5 minutes: an auction already at its floor price with no buyer, inside the last
 * 30 minutes of the food's life, is cancelled and becomes a free donation for NGO pickup.
 */
export const auctionCharityFallback = inngest.createFunction(
  { id: "auction-charity-fallback", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => step.run("fallback", () => runCharityFallback()),
);

/**
 * Every 5 minutes: the safety net for money. Expires abandoned checkouts, honours
 * payments that finished but were never confirmed, releases holds for cancelled auctions,
 * and finishes any capture / payout that was interrupted.
 */
export const reconcileEscrowJob = inngest.createFunction(
  { id: "reconcile-escrow", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => step.run("reconcile", () => reconcileEscrow()),
);

/** 1st of Jan/Apr/Jul/Oct, 02:30 UTC (08:00 in India): make last quarter's CSR report for every donor with deliveries. */
export const quarterlyEsgReports = inngest.createFunction(
  { id: "quarterly-esg-reports", triggers: [{ cron: "30 2 1 1,4,7,10 *" }] },
  async ({ step }) => step.run("generate", () => runQuarterlyReports()),
);

/** Hourly: rebuild the Redis leaderboards from the ledger so they can never drift. */
export const rebuildLeaderboardsJob = inngest.createFunction(
  { id: "rebuild-leaderboards", triggers: [{ cron: "7 * * * *" }] },
  async ({ step }) => ({
    ranked: await step.run("rebuild", () => runLeaderboardRebuild()),
  }),
);

export const functions = [
  quarterlyEsgReports,
  rebuildLeaderboardsJob,
  expireUncollectedFood,
  alertExpiringFood,
  publishAuctionPrices,
  auctionCharityFallback,
  reconcileEscrowJob,
];
