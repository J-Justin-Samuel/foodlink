-- FoodLink initial schema
-- Generated to match db/schema.ts. If you use `drizzle-kit generate`,
-- let it own this file going forward — this hand-authored version exists
-- so Stage 1 is runnable standalone.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "role" AS ENUM ('DONOR', 'VOLUNTEER', 'NGO', 'ADMIN', 'BUYER');
CREATE TYPE "onboarding_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'REJECTED');
CREATE TYPE "donation_status" AS ENUM ('LISTED', 'CLAIMED', 'IN_TRANSIT', 'DELIVERED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "food_category" AS ENUM ('COOKED_MEALS', 'PRODUCE', 'BAKERY', 'DAIRY', 'PACKAGED', 'OTHER');
CREATE TYPE "auction_status" AS ENUM ('SCHEDULED', 'ACTIVE', 'SOLD', 'EXPIRED', 'CANCELLED');
CREATE TYPE "delivery_status" AS ENUM ('ASSIGNED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'FAILED');
CREATE TYPE "scan_verdict" AS ENUM ('SAFE', 'CAUTION', 'UNSAFE', 'INCONCLUSIVE');
CREATE TYPE "ledger_reason" AS ENUM ('PICKUP_COMPLETED', 'DELIVERY_COMPLETED', 'REFERRAL_BONUS', 'AUCTION_WIN', 'PENALTY', 'MANUAL_ADJUSTMENT');

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_auth_id" varchar(191) NOT NULL UNIQUE,
  "email" varchar(255) NOT NULL UNIQUE,
  "role" "role" NOT NULL,
  "onboarding_status" "onboarding_status" NOT NULL DEFAULT 'PENDING',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "users_role_idx" ON "users" ("role");

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_name" varchar(255),
  "display_name" varchar(255) NOT NULL,
  "phone" varchar(20),
  "license_number" varchar(100),
  "license_type" varchar(50),
  "license_document_url" text,
  "address_line" text,
  "city" varchar(100),
  "state" varchar(100),
  "postal_code" varchar(20),
  "country" varchar(100) DEFAULT 'India',
  "location" geography(Point, 4326),
  "verified" boolean NOT NULL DEFAULT false,
  "reward_points" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "profiles_location_gist_idx" ON "profiles" USING GIST ("location");

-- ---------------------------------------------------------------------------
-- donations
-- ---------------------------------------------------------------------------
CREATE TABLE "donations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "donor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "category" "food_category" NOT NULL,
  "quantity_kg" numeric(8, 2) NOT NULL,
  "prepared_at" timestamptz,
  "shelf_life_expires_at" timestamptz NOT NULL,
  "pickup_location" geography(Point, 4326) NOT NULL,
  "pickup_address" text,
  "pickup_otp" varchar(6) NOT NULL,
  "dropoff_otp" varchar(6) NOT NULL,
  "status" "donation_status" NOT NULL DEFAULT 'LISTED',
  "image_urls" jsonb DEFAULT '[]',
  "is_bulk_auction" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "donations_pickup_location_gist_idx" ON "donations" USING GIST ("pickup_location");
CREATE INDEX "donations_status_idx" ON "donations" ("status");
CREATE INDEX "donations_donor_idx" ON "donations" ("donor_id");

-- ---------------------------------------------------------------------------
-- food_auctions
-- ---------------------------------------------------------------------------
CREATE TABLE "food_auctions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "donation_id" uuid NOT NULL UNIQUE REFERENCES "donations"("id") ON DELETE CASCADE,
  "start_price" numeric(10, 2) NOT NULL,
  "reserve_price" numeric(10, 2) NOT NULL,
  "decay_rate_per_minute" numeric(6, 4) NOT NULL,
  "current_price" numeric(10, 2) NOT NULL,
  "winning_buyer_id" uuid REFERENCES "users"("id"),
  "status" "auction_status" NOT NULL DEFAULT 'SCHEDULED',
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "food_auctions_status_idx" ON "food_auctions" ("status");

-- ---------------------------------------------------------------------------
-- deliveries
-- ---------------------------------------------------------------------------
CREATE TABLE "deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "donation_id" uuid NOT NULL REFERENCES "donations"("id") ON DELETE CASCADE,
  "volunteer_id" uuid REFERENCES "users"("id"),
  "ngo_id" uuid REFERENCES "users"("id"),
  "status" "delivery_status" NOT NULL DEFAULT 'ASSIGNED',
  "pickup_confirmed_at" timestamptz,
  "dropoff_confirmed_at" timestamptz,
  "distance_km" numeric(6, 2),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "deliveries_volunteer_idx" ON "deliveries" ("volunteer_id");
CREATE INDEX "deliveries_donation_idx" ON "deliveries" ("donation_id");

-- ---------------------------------------------------------------------------
-- food_quality_scans
-- ---------------------------------------------------------------------------
CREATE TABLE "food_quality_scans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "donation_id" uuid NOT NULL REFERENCES "donations"("id") ON DELETE CASCADE,
  "scanned_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "voc_ppm" numeric(8, 2),
  "surface_temp_c" numeric(5, 2),
  "humidity_pct" numeric(5, 2),
  "verdict" "scan_verdict" NOT NULL,
  "raw_payload" jsonb,
  "scanned_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "scans_donation_idx" ON "food_quality_scans" ("donation_id");

-- ---------------------------------------------------------------------------
-- reward_ledger
-- ---------------------------------------------------------------------------
CREATE TABLE "reward_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "delivery_id" uuid REFERENCES "deliveries"("id"),
  "points" integer NOT NULL,
  "reason" "ledger_reason" NOT NULL,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "reward_ledger_user_idx" ON "reward_ledger" ("user_id");
