import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import type { Role } from "@/types/roles";

/**
 * The signed-in user's FoodLink row (the database is the source of truth for
 * role and onboarding status — session claims can be a minute stale).
 * `cache` makes layout + page share one lookup per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.externalAuthId, userId))
    .limit(1);
  return row ?? null;
});

const NEEDS_ONBOARDING = new Set(["PENDING", "IN_PROGRESS", "REJECTED"]);

/**
 * Gate for dashboard layouts and pages: sends people to the right place
 * instead of showing an error.
 *   signed out       -> /sign-in
 *   no account yet   -> /onboarding
 *   onboarding open  -> /onboarding
 *   wrong role       -> /unauthorized
 */
export async function requireDashboardUser(allowed: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const { userId } = await auth();
    redirect(userId ? "/onboarding" : "/sign-in");
  }
  if (NEEDS_ONBOARDING.has(user.onboardingStatus)) redirect("/onboarding");
  if (!user.isActive || !allowed.includes(user.role)) redirect("/unauthorized");
  return user;
}
