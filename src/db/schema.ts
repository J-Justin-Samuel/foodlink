import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  doublePrecision,
  real,
  customType,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { DonationItem } from "@/types/donation";

// ---------------------------------------------------------------------------
// Custom PostGIS geography type
// Drizzle has no first-class geography type, so we define one backed by
// PostGIS `geography(Point, 4326)`. Values are read/written as GeoJSON-style
// { lat, lng } from the application layer via helper functions below.
// ---------------------------------------------------------------------------
export const geographyPoint = customType<{
  data: { lat: number; lng: number };
  driverData: string;
}>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver(value) {
    // ST_MakePoint expects (lng, lat)
    return sql`ST_SetSRID(ST_MakePoint(${value.lng}, ${value.lat}), 4326)::geography` as unknown as string;
  },
  fromDriver(value) {
    // pg returns geography as a WKB hex string unless ST_AsGeoJSON is used
    // in the query. Callers should select `ST_AsGeoJSON(location) as location_json`
    // for read paths; this fallback keeps the type honest for raw drivers.
    return value as unknown as { lat: number; lng: number };
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const roleEnum = pgEnum("role", [
  "DONOR",
  "VOLUNTEER",
  "NGO",
  "ADMIN",
  "BUYER",
]);

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
]);

export const donationStatusEnum = pgEnum("donation_status", [
  "LISTED",
  "CLAIMED",
  "IN_TRANSIT",
  "DELIVERED",
  "EXPIRED",
  "CANCELLED",
  // Stage 3: failed a freshness scan — no longer claimable by volunteers.
  "DIVERTED",
]);

// Stage 3: what a batch may be used for after freshness checks.
export const foodDispositionEnum = pgEnum("food_disposition", [
  "HUMAN_CONSUMPTION",
  "COMPOSTING",
  "ANIMAL_SHELTER",
]);

export const foodCategoryEnum = pgEnum("food_category", [
  "COOKED_MEALS",
  "PRODUCE",
  "BAKERY",
  "DAIRY",
  "PACKAGED",
  "OTHER",
]);

// Stage 2: how the food was prepared — drives safety rules and filtering.
export const foodClassificationEnum = pgEnum("food_classification", [
  "COOKED",
  "PACKAGED",
  "RAW",
]);

export const auctionStatusEnum = pgEnum("auction_status", [
  "SCHEDULED",
  "ACTIVE",
  "SOLD",
  "EXPIRED",
  "CANCELLED",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "ASSIGNED",
  "PICKED_UP",
  "EN_ROUTE",
  "DELIVERED",
  "FAILED",
]);

export const scanVerdictEnum = pgEnum("scan_verdict", [
  "SAFE",
  "CONSUME_SOON",
  "SPOILED",
  "INCONCLUSIVE",
]);

export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "PICKUP_COMPLETED",
  "DELIVERY_COMPLETED",
  "REFERRAL_BONUS",
  "AUCTION_WIN",
  "PENALTY",
  "MANUAL_ADJUSTMENT",
]);

// ---------------------------------------------------------------------------
// users — identity + role, mirrors auth provider (Clerk) via externalAuthId
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalAuthId: varchar("external_auth_id", { length: 191 })
      .notNull()
      .unique(), // Clerk user id
    email: varchar("email", { length: 255 }).notNull().unique(),
    role: roleEnum("role").notNull(),
    onboardingStatus: onboardingStatusEnum("onboarding_status")
      .notNull()
      .default("PENDING"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

// ---------------------------------------------------------------------------
// profiles — operational details captured during onboarding, 1:1 with users
// ---------------------------------------------------------------------------
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationName: varchar("organization_name", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    licenseNumber: varchar("license_number", { length: 100 }), // FSSAI, NGO 80G, etc.
    licenseType: varchar("license_type", { length: 50 }), // e.g. "FSSAI" | "NGO_80G"
    licenseDocumentUrl: text("license_document_url"), // presigned S3/R2 object
    addressLine: text("address_line"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 100 }).default("India"),
    location: geographyPoint("location"),
    verified: boolean("verified").notNull().default(false),
    rewardPoints: integer("reward_points").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    locationIdx: index("profiles_location_gist_idx").using(
      "gist",
      table.location,
    ),
  }),
);

// ---------------------------------------------------------------------------
// donations — perishable food listings from Donors
// ---------------------------------------------------------------------------
export const donations = pgTable(
  "donations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    // Stage 1 finer-grained category; now optional (Stage 2 uses `foodClassification`).
    category: foodCategoryEnum("category"),
    foodClassification: foodClassificationEnum("food_classification")
      .notNull()
      .default("COOKED"),
    estimatedServings: integer("estimated_servings").notNull().default(1),
    items: jsonb("items").$type<DonationItem[]>().notNull().default([]),
    pickupInstructions: text("pickup_instructions"),
    quantityKg: numeric("quantity_kg", { precision: 8, scale: 2 }).notNull(),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    shelfLifeExpiresAt: timestamp("shelf_life_expires_at", {
      withTimezone: true,
    }).notNull(),
    pickupLocation: geographyPoint("pickup_location").notNull(),
    pickupAddress: text("pickup_address"),
    // Legacy (Stage 1): codes now live on `deliveries`. Kept nullable, unused.
    pickupOtp: varchar("pickup_otp", { length: 6 }),
    dropoffOtp: varchar("dropoff_otp", { length: 6 }),
    status: donationStatusEnum("status").notNull().default("LISTED"),
    disposition: foodDispositionEnum("disposition")
      .notNull()
      .default("HUMAN_CONSUMPTION"),
    divertedAt: timestamp("diverted_at", { withTimezone: true }),
    diversionReason: text("diversion_reason"),
    // Stage 4: watchdog bookkeeping.
    expiryAlertedAt: timestamp("expiry_alerted_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    imageUrls: jsonb("image_urls").$type<string[]>().default([]),
    isBulkAuction: boolean("is_bulk_auction").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pickupLocationIdx: index("donations_pickup_location_gist_idx").using(
      "gist",
      table.pickupLocation,
    ),
    statusIdx: index("donations_status_idx").on(table.status),
    statusExpiryIdx: index("donations_status_expiry_idx").on(
      table.status,
      table.shelfLifeExpiresAt,
    ),
    donorIdx: index("donations_donor_idx").on(table.donorId),
  }),
);

// ---------------------------------------------------------------------------
// food_auctions — reverse Dutch flash auctions for bulk (>50kg) surplus
// ---------------------------------------------------------------------------
export const foodAuctions = pgTable(
  "food_auctions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donationId: uuid("donation_id")
      .notNull()
      .unique()
      .references(() => donations.id, { onDelete: "cascade" }),
    startPrice: numeric("start_price", { precision: 10, scale: 2 }).notNull(),
    reservePrice: numeric("reserve_price", {
      precision: 10,
      scale: 2,
    }).notNull(),
    decayRatePerMinute: numeric("decay_rate_per_minute", {
      precision: 6,
      scale: 4,
    }).notNull(),
    currentPrice: numeric("current_price", {
      precision: 10,
      scale: 2,
    }).notNull(),
    winningBuyerId: uuid("winning_buyer_id").references(() => users.id),
    status: auctionStatusEnum("status").notNull().default("SCHEDULED"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index("food_auctions_status_idx").on(table.status),
  }),
);

// ---------------------------------------------------------------------------
// deliveries — volunteer-executed pickup-to-dropoff legs
// ---------------------------------------------------------------------------
export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donationId: uuid("donation_id")
      .notNull()
      .references(() => donations.id, { onDelete: "cascade" }),
    volunteerId: uuid("volunteer_id").references(() => users.id),
    ngoId: uuid("ngo_id").references(() => users.id),
    status: deliveryStatusEnum("status").notNull().default("ASSIGNED"),
    pickupConfirmedAt: timestamp("pickup_confirmed_at", {
      withTimezone: true,
    }),
    dropoffConfirmedAt: timestamp("dropoff_confirmed_at", {
      withTimezone: true,
    }),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    // Stage 3: two distinct random codes per delivery + brute-force counters.
    pickupOtp: varchar("pickup_otp", { length: 6 }),
    dropoffOtp: varchar("dropoff_otp", { length: 6 }),
    pickupAttempts: integer("pickup_attempts").notNull().default(0),
    dropoffAttempts: integer("dropoff_attempts").notNull().default(0),
    otpLockedUntil: timestamp("otp_locked_until", { withTimezone: true }),
    // Proof of delivery: object key in S3/R2 (never a public URL).
    handoffPhotoKey: text("handoff_photo_key"),
    handoffPhotoUploadedAt: timestamp("handoff_photo_uploaded_at", {
      withTimezone: true,
    }),
    failureReason: text("failure_reason"),
    // Stage 4: last known volunteer position (live updates travel over Ably).
    lastLat: doublePrecision("last_lat"),
    lastLng: doublePrecision("last_lng"),
    lastHeading: real("last_heading"),
    lastSpeedMps: real("last_speed_mps"),
    lastLocationAt: timestamp("last_location_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ngoIdx: index("deliveries_ngo_idx").on(table.ngoId),
    volunteerIdx: index("deliveries_volunteer_idx").on(table.volunteerId),
    donationIdx: index("deliveries_donation_idx").on(table.donationId),
    // Last line of defence for claiming: at most one non-failed delivery per
    // donation, even if application-level locking were ever bypassed.
    activeDonationUniq: uniqueIndex("deliveries_active_donation_uniq")
      .on(table.donationId)
      .where(sql`${table.status} <> 'FAILED'`),
  }),
);

// ---------------------------------------------------------------------------
// food_quality_scans — IoT sensor readings (MQ-135 / MLX90614 / DHT22)
// ---------------------------------------------------------------------------
export const foodQualityScans = pgTable(
  "food_quality_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    donationId: uuid("donation_id")
      .notNull()
      .references(() => donations.id, { onDelete: "cascade" }),
    scannedByUserId: uuid("scanned_by_user_id")
      .notNull()
      .references(() => users.id),
    vocPpm: numeric("voc_ppm", { precision: 8, scale: 2 }), // MQ-135
    surfaceTempC: numeric("surface_temp_c", { precision: 5, scale: 2 }), // MLX90614
    humidityPct: numeric("humidity_pct", { precision: 5, scale: 2 }), // DHT22
    verdict: scanVerdictEnum("verdict").notNull(),
    freshnessScore: integer("freshness_score"), // 0-100, computed server-side
    source: varchar("source", { length: 20 }).notNull().default("BLUETOOTH"), // BLUETOOTH | SIMULATOR
    rawPayload: jsonb("raw_payload"), // inputs + score breakdown
    scannedAt: timestamp("scanned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    donationIdx: index("scans_donation_idx").on(table.donationId),
  }),
);

// ---------------------------------------------------------------------------
// push_subscriptions — Web Push endpoints for volunteer alerts (Stage 4)
// ---------------------------------------------------------------------------
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("push_subscriptions_user_idx").on(table.userId),
  }),
);

// ---------------------------------------------------------------------------
// reward_ledger — points/payout trail for volunteers, donors, NGOs
// ---------------------------------------------------------------------------
export const rewardLedger = pgTable(
  "reward_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deliveryId: uuid("delivery_id").references(() => deliveries.id),
    points: integer("points").notNull(),
    reason: ledgerReasonEnum("reason").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("reward_ledger_user_idx").on(table.userId),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  donations: many(donations),
  deliveriesAsVolunteer: many(deliveries, { relationName: "volunteer" }),
  rewardEntries: many(rewardLedger),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const donationsRelations = relations(donations, ({ one, many }) => ({
  donor: one(users, { fields: [donations.donorId], references: [users.id] }),
  auction: one(foodAuctions, {
    fields: [donations.id],
    references: [foodAuctions.donationId],
  }),
  deliveries: many(deliveries),
  scans: many(foodQualityScans),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  donation: one(donations, {
    fields: [deliveries.donationId],
    references: [donations.id],
  }),
  volunteer: one(users, {
    fields: [deliveries.volunteerId],
    references: [users.id],
  }),
  ngo: one(users, { fields: [deliveries.ngoId], references: [users.id] }),
}));

export const foodQualityScansRelations = relations(
  foodQualityScans,
  ({ one }) => ({
    donation: one(donations, {
      fields: [foodQualityScans.donationId],
      references: [donations.id],
    }),
    scannedBy: one(users, {
      fields: [foodQualityScans.scannedByUserId],
      references: [users.id],
    }),
  }),
);

export const rewardLedgerRelations = relations(rewardLedger, ({ one }) => ({
  user: one(users, { fields: [rewardLedger.userId], references: [users.id] }),
  delivery: one(deliveries, {
    fields: [rewardLedger.deliveryId],
    references: [deliveries.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types for application-layer use
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;
export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;
export type FoodQualityScan = typeof foodQualityScans.$inferSelect;
export type RewardLedgerEntry = typeof rewardLedger.$inferSelect;
