/**
 * Seed script for local/staging environments.
 * Run with: `npx tsx src/db/seed.ts` (or `npm run db:seed`)
 *
 * NOTE: `externalAuthId` values below are placeholders. In a real environment
 * you'd create the corresponding Clerk users first (or via Clerk's test mode)
 * and paste their IDs here so RBAC + onboarding flows resolve correctly.
 */
import { db } from "./index";
import { sql } from "drizzle-orm";
import {
  users,
  profiles,
  donations,
  deliveries,
  type NewUser,
  type NewProfile,
  type NewDonation,
} from "./schema";

function otp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function main() {
  console.log("Seeding FoodLink database...");

  // -------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------
  const seedUsers: NewUser[] = [
    {
      externalAuthId: "seed_clerk_donor_1",
      email: "chef.rina@tasteofblr.example",
      role: "DONOR",
      onboardingStatus: "VERIFIED",
    },
    {
      externalAuthId: "seed_clerk_volunteer_1",
      email: "arjun.v@foodlink.example",
      role: "VOLUNTEER",
      onboardingStatus: "VERIFIED",
    },
    {
      externalAuthId: "seed_clerk_ngo_1",
      email: "contact@hopeshelter.example",
      role: "NGO",
      onboardingStatus: "VERIFIED",
    },
    {
      externalAuthId: "seed_clerk_buyer_1",
      email: "procurement@greengrocer.example",
      role: "BUYER",
      onboardingStatus: "VERIFIED",
    },
    {
      externalAuthId: "seed_clerk_admin_1",
      email: "admin@foodlink.example",
      role: "ADMIN",
      onboardingStatus: "VERIFIED",
    },
  ];

  const insertedUsers = await db.insert(users).values(seedUsers).returning();
  const [donor, volunteer, ngo] = insertedUsers;

  console.log(`Inserted ${insertedUsers.length} users`);

  // -------------------------------------------------------------------
  // Profiles (raw SQL for the geography column via ST_MakePoint)
  // -------------------------------------------------------------------
  const profileSeeds: Array<
    Omit<NewProfile, "location"> & { lat: number; lng: number }
  > = [
    {
      userId: donor.id,
      organizationName: "Taste of Bengaluru Hotel",
      displayName: "Rina Kapoor",
      phone: "+919800000001",
      licenseNumber: "FSSAI-10023456789",
      licenseType: "FSSAI",
      addressLine: "MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      verified: true,
      lat: 12.9758,
      lng: 77.6045,
    },
    {
      userId: volunteer.id,
      displayName: "Arjun Verma",
      phone: "+919800000002",
      addressLine: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560038",
      verified: true,
      lat: 12.9719,
      lng: 77.6412,
    },
    {
      userId: ngo.id,
      organizationName: "Hope Shelter Trust",
      displayName: "Meera Nair",
      phone: "+919800000003",
      licenseNumber: "80G-KA-556677",
      licenseType: "NGO_80G",
      addressLine: "Shivajinagar",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560051",
      verified: true,
      lat: 12.9857,
      lng: 77.6057,
    },
  ];

  for (const p of profileSeeds) {
    const { lat, lng, ...rest } = p;
    await db.execute(sql`
      INSERT INTO profiles (
        user_id, organization_name, display_name, phone, license_number,
        license_type, address_line, city, state, postal_code, verified, location
      ) VALUES (
        ${rest.userId}, ${rest.organizationName ?? null}, ${rest.displayName},
        ${rest.phone ?? null}, ${rest.licenseNumber ?? null}, ${rest.licenseType ?? null},
        ${rest.addressLine ?? null}, ${rest.city ?? null}, ${rest.state ?? null},
        ${rest.postalCode ?? null}, ${rest.verified ?? false},
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )
    `);
  }
  console.log(`Inserted ${profileSeeds.length} profiles`);

  // -------------------------------------------------------------------
  // A sample donation near the donor's hotel
  // -------------------------------------------------------------------
  const donationResult = await db.execute<{ id: string }>(sql`
    INSERT INTO donations (
      donor_id, title, description, category, quantity_kg,
      shelf_life_expires_at, pickup_location, pickup_address,
      pickup_otp, dropoff_otp, status
    ) VALUES (
      ${donor.id}, 'Surplus banquet meals', 'Vegetarian buffet leftovers from a wedding event',
      'COOKED_MEALS', 22.5, now() + interval '4 hours',
      ST_SetSRID(ST_MakePoint(77.6045, 12.9758), 4326)::geography,
      'MG Road, Bengaluru', ${otp()}, ${otp()}, 'LISTED'
    ) RETURNING id
  `);

  const donationId = (donationResult as unknown as { id: string }[])[0]?.id;
  if (donationId) {
    await db.insert(deliveries).values({
      donationId,
      volunteerId: volunteer.id,
      ngoId: ngo.id,
      status: "ASSIGNED",
    });
    console.log("Inserted 1 sample donation + delivery assignment");
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
