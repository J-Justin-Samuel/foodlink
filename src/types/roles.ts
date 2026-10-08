export const ROLES = ["DONOR", "VOLUNTEER", "NGO", "ADMIN", "BUYER"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/**
 * Maps a route prefix to the roles allowed to access it.
 * Checked in order — first match wins. Routes not listed here are
 * treated as public (still passed through Clerk's auth() for session
 * hydration, but not role-gated).
 */
export const ROLE_PROTECTED_ROUTES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/donor", roles: ["DONOR", "ADMIN"] },
  { prefix: "/volunteer", roles: ["VOLUNTEER", "ADMIN"] },
  { prefix: "/ngo", roles: ["NGO", "ADMIN"] },
  { prefix: "/buyer", roles: ["BUYER", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

export function findRouteGuard(pathname: string) {
  return ROLE_PROTECTED_ROUTES.find((entry) =>
    pathname.startsWith(entry.prefix),
  );
}
