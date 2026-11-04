-- Stage 6, step 1 of 2. Run this file ALONE first (a new enum value can't be used in the same transaction).
ALTER TYPE ledger_reason ADD VALUE IF NOT EXISTS 'QUALITY_VERIFIED';
