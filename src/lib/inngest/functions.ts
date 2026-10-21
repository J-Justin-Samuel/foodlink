import { inngest } from "./client";
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

export const functions = [expireUncollectedFood, alertExpiringFood];
