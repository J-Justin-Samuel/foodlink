import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import type { User } from "@/db/schema";
import { ROLE_HOME, ROLE_LABEL, ROLE_NAV } from "@/lib/routes";
import { NavLinks } from "./nav-links";

/** Top bar for every signed-in page. Exactly 4rem tall (the map page relies on it). */
export function AppHeader({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-2 border-foreground bg-background px-4">
      <Link
        href={ROLE_HOME[user.role]}
        className="shrink-0 text-lg font-black tracking-tight"
      >
        FoodLink
      </Link>
      <NavLinks items={ROLE_NAV[user.role]} />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {ROLE_LABEL[user.role]}
        </span>
        <UserButton />
      </div>
    </header>
  );
}
