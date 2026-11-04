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
      {user.onboardingStatus === "SUBMITTED" && user.role !== "ADMIN" && (
        <p
          role="status"
          className="border-b-2 border-amber-500 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Your details are being reviewed. You can already look around. Some
          actions may open up once you are approved.
        </p>
      )}
      {children}
    </>
  );
}
