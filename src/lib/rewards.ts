import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  deliveries,
  donations,
  foodQualityScans,
  profiles,
  rewardLedger,
} from "@/db/schema";
import { deliveryPoints, qualityPoints } from "@/lib/reward-points";
import type { RewardEntry } from "@/lib/leaderboard";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Called inside the transaction that marks a delivery DELIVERED. Appends the volunteer's points to
 * the ledger (once per delivery and reason: a unique index makes a repeat harmless) and keeps the
 * profile's running total in step. Returns only the rows that were really added.
 */
export async function awardForDelivery(
  tx: Tx,
  deliveryId: string,
): Promise<RewardEntry[]> {
  const [d] = await tx
    .select({
      volunteerId: deliveries.volunteerId,
      donationId: deliveries.donationId,
      kg: donations.quantityKg,
    })
    .from(deliveries)
    .innerJoin(donations, eq(donations.id, deliveries.donationId))
    .where(eq(deliveries.id, deliveryId));
  if (!d?.volunteerId) return [];

  const [scan] = await tx
    .select({ verdict: foodQualityScans.verdict })
    .from(foodQualityScans)
    .where(eq(foodQualityScans.donationId, d.donationId))
    .orderBy(desc(foodQualityScans.scannedAt))
    .limit(1);

  const kg = Number(d.kg);
  const plan = [
    {
      reason: "DELIVERY_COMPLETED" as const,
      points: deliveryPoints(kg),
      metadata: { kg },
    },
    {
      reason: "QUALITY_VERIFIED" as const,
      points: qualityPoints(scan?.verdict),
      metadata: { verdict: scan?.verdict ?? null },
    },
  ].filter((p) => p.points > 0);

  const added: RewardEntry[] = [];
  for (const p of plan) {
    const [row] = await tx
      .insert(rewardLedger)
      .values({
        userId: d.volunteerId,
        deliveryId,
        points: p.points,
        reason: p.reason,
        metadata: p.metadata,
      })
      .onConflictDoNothing()
      .returning({ id: rewardLedger.id, createdAt: rewardLedger.createdAt });
    if (row)
      added.push({
        id: row.id,
        userId: d.volunteerId,
        points: p.points,
        at: row.createdAt,
      });
  }
  const sum = added.reduce((s, e) => s + e.points, 0);
  if (sum > 0) {
    await tx
      .update(profiles)
      .set({
        rewardPoints: sql`${profiles.rewardPoints} + ${sum}`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, d.volunteerId));
  }
  return added;
}

export interface MyRewards {
  points: number;
  deliveries: number;
  foodKgHundredths: number;
  recent: {
    id: string;
    points: number;
    reason: string;
    at: string;
    title: string | null;
  }[];
}

export async function getMyRewards(userId: string): Promise<MyRewards> {
  const [agg] = (await db.execute(sql`
    SELECT COALESCE((SELECT SUM(points) FROM reward_ledger WHERE user_id = ${userId}), 0)::int AS points,
           (SELECT count(*) FROM deliveries WHERE volunteer_id = ${userId} AND status = 'DELIVERED')::int AS deliveries,
           COALESCE((SELECT SUM(ROUND(d.quantity_kg * 100)) FROM deliveries x JOIN donations d ON d.id = x.donation_id
                     WHERE x.volunteer_id = ${userId} AND x.status = 'DELIVERED'), 0)::bigint AS hundredths
  `)) as unknown as {
    points: number;
    deliveries: number;
    hundredths: string;
  }[];
  const recent = (await db.execute(sql`
    SELECT l.id, l.points, l.reason, l.created_at, d.title
    FROM reward_ledger l
    LEFT JOIN deliveries x ON x.id = l.delivery_id LEFT JOIN donations d ON d.id = x.donation_id
    WHERE l.user_id = ${userId} ORDER BY l.created_at DESC, l.id LIMIT 15
  `)) as unknown as {
    id: string;
    points: number;
    reason: string;
    created_at: Date;
    title: string | null;
  }[];
  return {
    points: agg.points,
    deliveries: agg.deliveries,
    foodKgHundredths: Number(agg.hundredths),
    recent: recent.map((r) => ({
      id: r.id,
      points: r.points,
      reason: r.reason,
      at: new Date(r.created_at).toISOString(),
      title: r.title,
    })),
  };
}
