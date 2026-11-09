-- Stage 7: photos of the food, taken by the donor when listing it.
-- Stored in PostgreSQL so photos work without an S3/R2 bucket. Served through /api/food-photos/<id>.
CREATE TABLE IF NOT EXISTS food_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donation_id   uuid REFERENCES donations(id) ON DELETE CASCADE,
  content_type  varchar(20) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes         bytea NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS food_photos_donation_idx ON food_photos (donation_id);
CREATE INDEX IF NOT EXISTS food_photos_orphans_idx ON food_photos (created_at) WHERE donation_id IS NULL;
