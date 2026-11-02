"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Users,
  LogIn,
  LayoutDashboard,
  PackageCheck,
  Map,
  Bike,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icons are looked up here (client side) so server pages only pass plain strings.
const ICONS = {
  home: Home,
  compass: Compass,
  users: Users,
  login: LogIn,
  dashboard: LayoutDashboard,
  deliveries: PackageCheck,
  map: Map,
  bike: Bike,
  food: Utensils,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon };

/** Floating glass bottom navbar. Mobile-first; stays centered on desktop. */
export function GlassBottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <ul className="glass-strong flex w-full max-w-md items-center justify-between gap-1 rounded-full p-1.5">
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const active = href.startsWith("#") ? false : pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-0.5 rounded-full px-3 py-2 text-[11px] font-semibold transition-all duration-300",
                  active
                    ? "bg-gradient-to-br from-orange-400 to-orange-vibrant text-white shadow-lg shadow-orange-500/30"
                    : "text-charcoal/70 hover:bg-orange-soft hover:text-orange-700",
                )}
              >
                <Icon className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
