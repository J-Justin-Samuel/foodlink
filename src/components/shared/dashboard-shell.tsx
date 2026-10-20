import { requireDashboardUser } from "@/lib/guards";
import type { Role } from "@/types/roles";
import { AppHeader } from "./app-header";

/**
 * Layout wrapper for each role's area: checks sign-in, onboarding and role
 * (redirecting to the right place), then renders the header and the page.
 */
export async function DashboardShell({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const user = await requireDashboardUser(roles);
  return (
    <>
      <AppHeader user={user} />
      {children}
    </>
  );
}
