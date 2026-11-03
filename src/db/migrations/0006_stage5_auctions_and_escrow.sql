-- Stage 5: reverse Dutch auctions + escrow payments. Run once in pgAdmin (F5). Safe to re-run.

-- ---------------------------------------------------------------------------
-- Auction parameters. The live price is computed on read from these values
-- (start - floor(elapsed / interval) * step, never below the floor), so
-- nothing is written while the price falls.
-- ---------------------------------------------------------------------------
ALTER TABLE food_auctions
  ADD COLUMN IF NOT EXISTS decrement_step numeric(10,2),
  ADD COLUMN IF NOT EXISTS interval_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS final_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS last_published_tier integer NOT NULL DEFAULT 0;

-- Stage 1 columns that the computed price replaces.
ALTER TABLE food_auctions ALTER COLUMN decay_rate_per_minute DROP NOT NULL;
ALTER TABLE food_auctions ALTER COLUMN current_price DROP NOT NULL;

ALTER TABLE food_auctions DROP CONSTRAINT IF EXISTS food_auctions_prices_valid;
ALTER TABLE food_auctions ADD CONSTRAINT food_auctions_prices_valid CHECK (
  start_price > reserve_price AND reserve_price >= 0 AND (decrement_step IS NULL OR decrement_step > 0)
);
ALTER TABLE food_auctions DROP CONSTRAINT IF EXISTS food_auctions_interval_valid;
ALTER TABLE food_auctions ADD CONSTRAINT food_auctions_interval_valid CHECK (interval_minutes BETWEEN 5 AND 60);

-- ---------------------------------------------------------------------------
-- auction_orders: one row per purchase attempt. The money state machine:
--   PENDING_PAYMENT -> AUTHORIZED -> CAPTURE_REQUESTED -> CAPTURED
--   PENDING_PAYMENT -> EXPIRED | FAILED
--   PENDING_PAYMENT/AUTHORIZED -> VOID_REQUESTED -> CANCELLED
-- "...REQUESTED" is written in the same transaction as the delivery change, so
-- a crash between that commit and the call to the payment provider is retried
-- by a background job instead of being lost.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES food_auctions(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES users(id),
  status varchar(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
  amount_minor integer NOT NULL,          -- smallest currency unit (paise)
  currency char(3) NOT NULL DEFAULT 'inr',
  provider varchar(10) NOT NULL,          -- 'stripe' | 'mock'
  provider_ref text,                      -- Stripe PaymentIntent id
  reserved_until timestamptz,             -- how long the price is held while the buyer pays
  authorized_at timestamptz,
  capture_requested_at timestamptz,
  captured_at timestamptz,
  charge_id text,
  donor_minor integer,
  volunteer_minor integer,
  platform_minor integer,
  donor_transfer_id text,
  donor_transferred_at timestamptz,
  settled_at timestamptz,
  void_reason text,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auction_orders_status_valid CHECK (status IN
    ('PENDING_PAYMENT','AUTHORIZED','CAPTURE_REQUESTED','CAPTURED','EXPIRED','FAILED','VOID_REQUESTED','CANCELLED')),
  CONSTRAINT auction_orders_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT auction_orders_split_adds_up CHECK (
    donor_minor IS NULL OR donor_minor + volunteer_minor + platform_minor = amount_minor)
);
-- At most one live order per auction: the database itself decides a simultaneous "Buy now".
CREATE UNIQUE INDEX IF NOT EXISTS auction_orders_one_live
  ON auction_orders (auction_id)
  WHERE status IN ('PENDING_PAYMENT','AUTHORIZED','CAPTURE_REQUESTED','CAPTURED');
CREATE INDEX IF NOT EXISTS auction_orders_buyer_idx ON auction_orders (buyer_id);
CREATE INDEX IF NOT EXISTS auction_orders_status_idx ON auction_orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS auction_orders_provider_ref_uniq ON auction_orders (provider_ref) WHERE provider_ref IS NOT NULL;

-- ---------------------------------------------------------------------------
-- payout_accounts: a donor's connected payout account (Stripe Connect Express).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payout_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(10) NOT NULL,
  provider_account_id text NOT NULL,
  details_submitted boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- payout_ledger: where each rupee of a captured order went (75 / 15 / 10).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payout_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES auction_orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),      -- NULL for the platform fee
  kind varchar(24) NOT NULL,
  amount_minor integer NOT NULL,
  currency char(3) NOT NULL,
  status varchar(12) NOT NULL,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT payout_ledger_kind_valid CHECK (kind IN ('DONOR_PAYOUT','VOLUNTEER_REIMBURSEMENT','PLATFORM_FEE')),
  CONSTRAINT payout_ledger_status_valid CHECK (status IN ('PENDING','PAID','RECORDED')),
  CONSTRAINT payout_ledger_amount_nonneg CHECK (amount_minor >= 0),
  CONSTRAINT payout_ledger_once UNIQUE (order_id, kind)
);
CREATE INDEX IF NOT EXISTS payout_ledger_user_idx ON payout_ledger (user_id);

-- Quick lookups for the price publisher and fallback jobs.
CREATE INDEX IF NOT EXISTS food_auctions_active_idx ON food_auctions (ends_at) WHERE status = 'ACTIVE';
