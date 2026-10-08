import "server-only";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type Role, isRole } from "@/types/roles";

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolves the current session's FoodLink user row, throwing if there's
 * no session or the account doesn't exist locally yet.
 *
 * Middleware protects routes by role claim, but Server Actions can be
 * invoked directly (bypassing route matching), so every mutating action
 * must independently re-verify identity and role here.
 */
export async function requireUser() {
  const { userId: externalAuthId } = await auth();
  if (!externalAuthId) {
    throw new UnauthorizedError();
  }

  const [record] = await db
    .select()
    .from(users)
    .where(eq(users.externalAuthId, externalAuthId))
    .limit(1);

  if (!record) {
    throw new UnauthorizedError("No FoodLink account linked to this session");
  }
  if (!record.isActive) {
    throw new ForbiddenError("Account has been suspended");
  }

  return record;
}

/**
 * Requires the current user to hold one of `allowedRoles`.
 * ADMIN is intentionally NOT auto-included — pass it explicitly where
 * admins should be allowed to act on behalf of other roles.
 */
export async function requireRole(allowedRoles: Role[]) {
  const user = await requireUser();
  if (!isRole(user.role) || !allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Role '${user.role}' is not permitted to perform this action`,
    );
  }
  return user;
}

/**
 * Convenience wrapper for Server Actions: catches the typed errors above
 * and returns a discriminated result instead of throwing across the
 * server/client boundary (Next.js serializes thrown errors poorly).
 */
export async function withRoleGuard<T>(
  allowedRoles: Role[],
  fn: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<T>,
): Promise<
  | { ok: true; data: T }
  | { ok: false; error: string; code: "UNAUTHORIZED" | "FORBIDDEN" | "UNKNOWN" }
> {
  try {
    const user = await requireRole(allowedRoles);
    const data = await fn(user);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return { ok: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message, code: "FORBIDDEN" };
    }
    console.error("withRoleGuard: unexpected error", err);
    return { ok: false, error: "Something went wrong", code: "UNKNOWN" };
  }
}
