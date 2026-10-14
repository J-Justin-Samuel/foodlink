-- FoodLink Stage 2: donation intake + concurrency-safe claiming
-- Run AFTER 0000 and 0001. Safe to run once; re-running will error on CREATE TYPE.

-- 1. New classification enum
CREATE TYPE "food_classification" AS ENUM ('COOKED', 'PACKAGED', 'RAW');

-- 2. Stage 1's finer-grained category becomes optional
ALTER TABLE "donations" ALTER COLUMN "category" DROP NOT NULL;

-- 3. New intake columns (defaults keep the Stage 1 seed script working)
ALTER TABLE "donations"
  ADD COLUMN "food_classification" "food_classification" NOT NULL DEFAULT 'COOKED',
  ADD COLUMN "estimated_servings" integer NOT NULL DEFAULT 1,
  ADD COLUMN "items" jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN "pickup_instructions" text;

ALTER TABLE "donations"
  ADD CONSTRAINT "donations_servings_positive" CHECK ("estimated_servings" > 0);

-- 4. Speeds up the "LISTED and not expired" filter used by the matching query
CREATE INDEX "donations_status_expiry_idx"
  ON "donations" ("status", "shelf_life_expires_at");

-- 5. At most one non-failed delivery per donation (backstop for the row lock)
CREATE UNIQUE INDEX "deliveries_active_donation_uniq"
  ON "deliveries" ("donation_id")
  WHERE "status" <> 'FAILED';
