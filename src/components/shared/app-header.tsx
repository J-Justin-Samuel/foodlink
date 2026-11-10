import { UserButton } from "@clerk/nextjs";
import type { User } from "@/db/schema";
import { Logo } from "@/components/glass/logo";
import { ROLE_HOME, ROLE_LABEL, ROLE_NAV } from "@/lib/routes";
import { NavLinks } from "./nav-links";

/**
 * Floating glass top bar. The wrapper is exactly 4rem tall (the map page relies on it).
 * On phones the page links live in the bottom bar, unless the role has no icons (then they scroll here).
 */
export function AppHeader({ user }: { user: User }) {
  const items = ROLE_NAV[user.role];
  const hasBottomNav = items.some((i) => i.icon);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center px-3">
      <div className="glass-strong flex h-12 w-full items-center gap-3 rounded-full pl-4 pr-2">
        <Logo href={ROLE_HOME[user.role]} className="shrink-0 !text-lg" />
        <NavLinks items={items} hideOnPhone={hasBottomNav} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-peach px-2.5 py-1 text-xs font-bold text-[#7c2d12]">
            {ROLE_LABEL[user.role]}
          </span>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
