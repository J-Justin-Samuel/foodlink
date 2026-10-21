-- Stage 4: live tracking + expiry alerts. Run once in pgAdmin (F5). Safe to re-run.

-- Last known volunteer position, so a page opened mid-delivery shows the van straight away.
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS last_lat double precision,
  ADD COLUMN IF NOT EXISTS last_lng double precision,
  ADD COLUMN IF NOT EXISTS last_heading real,
  ADD COLUMN IF NOT EXISTS last_speed_mps real,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_last_location_valid;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_last_location_valid CHECK (
  (last_lat IS NULL AND last_lng IS NULL)
  OR (last_lat BETWEEN -90 AND 90 AND last_lng BETWEEN -180 AND 180)
);

-- Watchdog bookkeeping: alert once per batch, and record when a batch was expired.
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS expiry_alerted_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- Web Push subscriptions (one row per browser/device).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Speeds up the watchdog scan of listed batches by expiry time.
CREATE INDEX IF NOT EXISTS donations_listed_expiry_idx
  ON donations (shelf_life_expires_at) WHERE status = 'LISTED';
