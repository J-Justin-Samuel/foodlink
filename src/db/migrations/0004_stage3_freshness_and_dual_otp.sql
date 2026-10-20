-- FoodLink Stage 3 (part 2 of 2): freshness scans, reclassification, dual-OTP delivery.
-- Run AFTER 0003. Safe to run once.

-- ---------------------------------------------------------------------------
-- 1. What the batch can be used for after a failed scan
-- ---------------------------------------------------------------------------
CREATE TYPE "food_disposition" AS ENUM ('HUMAN_CONSUMPTION', 'COMPOSTING', 'ANIMAL_SHELTER');

ALTER TABLE "donations"
  ADD COLUMN "disposition" "food_disposition" NOT NULL DEFAULT 'HUMAN_CONSUMPTION',
  ADD COLUMN "diverted_at" timestamptz,
  ADD COLUMN "diversion_reason" text;

-- ---------------------------------------------------------------------------
-- 2. Per-delivery codes replace the per-donation codes from Stage 1
--    (the old columns stay, but nothing reads them any more)
-- ---------------------------------------------------------------------------
ALTER TABLE "donations" ALTER COLUMN "pickup_otp" DROP NOT NULL;
ALTER TABLE "donations" ALTER COLUMN "dropoff_otp" DROP NOT NULL;
UPDATE "donations" SET "pickup_otp" = NULL, "dropoff_otp" = NULL;

-- ---------------------------------------------------------------------------
-- 3. Scan records: the computed score and where the reading came from
-- ---------------------------------------------------------------------------
ALTER TABLE "food_quality_scans"
  ADD COLUMN "freshness_score" integer,
  ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'BLUETOOTH';

ALTER TABLE "food_quality_scans"
  ADD CONSTRAINT "scans_score_range" CHECK ("freshness_score" IS NULL OR "freshness_score" BETWEEN 0 AND 100);

-- ---------------------------------------------------------------------------
-- 4. Deliveries: two codes, brute-force counters, proof-of-delivery photo
--    (columns are nullable so the Stage 1 sample delivery still loads)
-- ---------------------------------------------------------------------------
ALTER TABLE "deliveries"
  ADD COLUMN "pickup_otp" varchar(6),
  ADD COLUMN "dropoff_otp" varchar(6),
  ADD COLUMN "pickup_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN "dropoff_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN "otp_locked_until" timestamptz,
  ADD COLUMN "handoff_photo_key" text,
  ADD COLUMN "handoff_photo_uploaded_at" timestamptz,
  ADD COLUMN "failure_reason" text;

-- The two codes of one delivery must differ.
ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_otps_distinct"
  CHECK ("pickup_otp" IS NULL OR "dropoff_otp" IS NULL OR "pickup_otp" <> "dropoff_otp");

-- NGO dashboard: "deliveries headed to me"
CREATE INDEX "deliveries_ngo_idx" ON "deliveries" ("ngo_id");
