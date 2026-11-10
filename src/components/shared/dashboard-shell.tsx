import { GlassBottomNav } from "@/components/glass/bottom-nav";
import { requireDashboardUser } from "@/lib/guards";
import { ROLE_NAV } from "@/lib/routes";
import type { Role } from "@/types/roles";
import { AppHeader } from "./app-header";

/**
 * Layout wrapper for each role's area: checks sign-in, onboarding and role
 * (redirecting to the right place), then renders the header, the page and the phone tab bar.
 */
export async function DashboardShell({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const user = await requireDashboardUser(roles);
  const tabs = ROLE_NAV[user.role]
    .filter((i) => i.icon)
    .slice(0, 5)
    .map((i) => ({ href: i.href, label: i.short ?? i.label, icon: i.icon! }));
  return (
    <div className={tabs.length ? "has-bottom-nav" : undefined}>
      <AppHeader user={user} />
      {user.onboardingStatus === "SUBMITTED" && user.role !== "ADMIN" && (
        <p
          role="status"
          className="mx-3 mb-2 rounded-2xl border border-flame/40 bg-peach/80 px-4 py-2.5 text-center text-sm text-[#7c2d12] backdrop-blur-xl"
        >
          Your details are being reviewed. You can already look around. Some
          actions may open up once you are approved.
        </p>
      )}
      {children}
      {tabs.length > 0 && <GlassBottomNav items={tabs} />}
    </div>
  );
}
