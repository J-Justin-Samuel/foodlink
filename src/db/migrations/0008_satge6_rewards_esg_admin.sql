-- Stage 6, step 2 of 2. Safe to run more than once.

-- ---- Admin review trail on users ------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE INDEX IF NOT EXISTS users_status_idx ON users (onboarding_status);

-- ---- reward_ledger: append-only, one award per delivery/user/reason ----------
CREATE UNIQUE INDEX IF NOT EXISTS reward_ledger_once_per_delivery
  ON reward_ledger (delivery_id, user_id, reason)
  WHERE reason IN ('PICKUP_COMPLETED', 'DELIVERY_COMPLETED', 'QUALITY_VERIFIED');
CREATE INDEX IF NOT EXISTS reward_ledger_created_idx ON reward_ledger (created_at);

CREATE OR REPLACE FUNCTION reward_ledger_append_only() RETURNS trigger AS $$
BEGIN
  -- Deleting a user cascades to their ledger rows (depth > 0); nothing else may edit history.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'reward_ledger is append-only: add a correcting entry instead of changing history';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS reward_ledger_no_edit ON reward_ledger;
CREATE TRIGGER reward_ledger_no_edit BEFORE UPDATE OR DELETE ON reward_ledger
  FOR EACH ROW EXECUTE FUNCTION reward_ledger_append_only();

-- ---- Volunteer certificates -----------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial varchar(20) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holder_name varchar(255) NOT NULL,
  deliveries_count int NOT NULL CHECK (deliveries_count >= 0),
  food_kg numeric(12,2) NOT NULL CHECK (food_kg >= 0),
  meals int NOT NULL CHECK (meals >= 0),
  points int NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  hash char(64) NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS certificates_user_idx ON certificates (user_id, issued_at DESC);

-- ---- Quarterly CSR / ESG reports for donors ----------------------------------
CREATE TABLE IF NOT EXISTS esg_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial varchar(20) NOT NULL UNIQUE,
  donor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year int NOT NULL,
  quarter int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  deliveries_count int NOT NULL,
  food_kg numeric(12,2) NOT NULL,
  co2e_kg numeric(14,2) NOT NULL,
  water_l numeric(16,2) NOT NULL,
  meals int NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  hash char(64) NOT NULL,
  UNIQUE (donor_id, year, quarter)
);

-- ---- Disputes -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  against_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  category varchar(30) NOT NULL CHECK (category IN ('QUALITY','NO_SHOW','WRONG_QUANTITY','PAYMENT','CONDUCT','OTHER')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')),
  resolution_note text,
  penalty_points int NOT NULL DEFAULT 0 CHECK (penalty_points >= 0),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS disputes_raised_idx ON disputes (raised_by);
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_delivery
  ON disputes (raised_by, delivery_id) WHERE delivery_id IS NOT NULL AND status IN ('OPEN','IN_REVIEW');

-- ---- License audits (append-only trail) ----------------------------------------
CREATE TABLE IF NOT EXISTS license_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auditor_id uuid NOT NULL REFERENCES users(id),
  result varchar(10) NOT NULL CHECK (result IN ('PASSED','FAILED')),
  license_type varchar(50),
  license_number varchar(100),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_audits_user_idx ON license_audits (user_id, created_at DESC);
