"use server";

import { z } from "zod";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, profiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ROLES } from "@/types/roles";
import { revalidatePath } from "next/cache";

const roleSchema = z.enum(ROLES);

const operationalDetailsSchema = z.object({
  role: roleSchema,
  organizationName: z.string().min(2).max(255).optional(),
  displayName: z.string().min(2).max(255),
  phone: z.string().min(7).max(20),
  licenseNumber: z.string().min(3).max(100).optional(),
  licenseType: z.enum(["FSSAI", "NGO_80G", "OTHER"]).optional(),
  addressLine: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3).max(20),
  country: z.string().min(2).default("India"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type OperationalDetailsInput = z.infer<typeof operationalDetailsSchema>;

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Step 1: persist the selected role for a freshly-signed-up Clerk user,
 * creating the local `users` row if it doesn't exist yet.
 */
export async function selectRole(role: string): Promise<ActionResult> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) {
    return { ok: false, error: "Invalid role selection" };
  }

  const { userId: externalAuthId } = await auth();
  if (!externalAuthId) {
    return { ok: false, error: "Not authenticated" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(externalAuthId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;

  if (!primaryEmail) {
    return { ok: false, error: "No verified email on this account" };
  }

  await db
    .insert(users)
    .values({
      externalAuthId,
      email: primaryEmail,
      role: parsed.data,
      onboardingStatus: "IN_PROGRESS",
    })
    .onConflictDoUpdate({
      target: users.externalAuthId,
      set: { role: parsed.data, onboardingStatus: "IN_PROGRESS" },
    });

  // Mirror role into Clerk's public metadata so middleware can read it
  // straight off the session JWT without a DB hit on every request.
  await client.users.updateUserMetadata(externalAuthId, {
    publicMetadata: { role: parsed.data, onboardingStatus: "IN_PROGRESS" },
  });

  revalidatePath("/onboarding");
  return { ok: true };
}

/**
 * Step 2: persist operational details (org name, license, address, GPS).
 * Marks onboarding SUBMITTED — an admin verification step (Stage 6) will
 * flip it to VERIFIED after license checks.
 */
export async function submitOperationalDetails(
  input: OperationalDetailsInput,
): Promise<ActionResult> {
  const parsed = operationalDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { userId: externalAuthId } = await auth();
  if (!externalAuthId) {
    return { ok: false, error: "Not authenticated" };
  }

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.externalAuthId, externalAuthId))
    .limit(1);

  if (!userRecord) {
    return { ok: false, error: "Complete role selection first" };
  }

  const d = parsed.data;

  // Requires a raw geography literal, so this step uses a parameterized
  // SQL upsert rather than the Drizzle query builder (see db/schema.ts
  // geographyPoint custom type notes).
  await db.execute(sql`
    INSERT INTO profiles (
      user_id, organization_name, display_name, phone, license_number,
      license_type, address_line, city, state, postal_code, country, location
    ) VALUES (
      ${userRecord.id}, ${d.organizationName ?? null}, ${d.displayName}, ${d.phone},
      ${d.licenseNumber ?? null}, ${d.licenseType ?? null}, ${d.addressLine},
      ${d.city}, ${d.state}, ${d.postalCode}, ${d.country},
      ST_SetSRID(ST_MakePoint(${d.longitude}, ${d.latitude}), 4326)::geography
    )
    ON CONFLICT (user_id) DO UPDATE SET
      organization_name = EXCLUDED.organization_name,
      display_name = EXCLUDED.display_name,
      phone = EXCLUDED.phone,
      license_number = EXCLUDED.license_number,
      license_type = EXCLUDED.license_type,
      address_line = EXCLUDED.address_line,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      postal_code = EXCLUDED.postal_code,
      country = EXCLUDED.country,
      location = EXCLUDED.location,
      updated_at = now()
  `);

  await db
    .update(users)
    .set({ onboardingStatus: "SUBMITTED", updatedAt: new Date() })
    .where(eq(users.id, userRecord.id));

  const client = await clerkClient();
  await client.users.updateUserMetadata(externalAuthId, {
    publicMetadata: { role: userRecord.role, onboardingStatus: "SUBMITTED" },
  });

  revalidatePath("/onboarding");
  return { ok: true };
}
