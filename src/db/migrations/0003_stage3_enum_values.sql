-- FoodLink Stage 3 (part 1 of 2): enum changes.
-- Run this file ON ITS OWN first, then run 0004.
-- (Postgres will not let a newly added enum value be used in the same
--  transaction that added it, so these changes live in their own file.)

-- A batch that failed a freshness scan is taken out of the claimable pool.
ALTER TYPE "donation_status" ADD VALUE IF NOT EXISTS 'DIVERTED';

-- Scan verdicts now match the Freshness Index bands:
--   SAFE (>=70), CONSUME_SOON (40-69), SPOILED (<40).
-- Renaming keeps any existing rows intact. Guarded so re-running is harmless.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'scan_verdict' AND e.enumlabel = 'CAUTION'
  ) THEN
    ALTER TYPE "scan_verdict" RENAME VALUE 'CAUTION' TO 'CONSUME_SOON';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'scan_verdict' AND e.enumlabel = 'UNSAFE'
  ) THEN
    ALTER TYPE "scan_verdict" RENAME VALUE 'UNSAFE' TO 'SPOILED';
  END IF;
END $$;
