-- FoodLink: enable spatial support
-- This must be applied before any migration that references `geography` columns.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid() support if not already present
