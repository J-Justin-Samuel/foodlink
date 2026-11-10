"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Flag,
  Gavel,
  Gift,
  HelpCircle,
  Home,
  MapPin,
  Package,
  PlusCircle,
  Receipt,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  package: Package,
  plus: PlusCircle,
  map: MapPin,
  gift: Gift,
  chart: BarChart3,
  wallet: Wallet,
  help: HelpCircle,
  gavel: Gavel,
  users: Users,
  flag: Flag,
  truck: Truck,
  bag: ShoppingBag,
  receipt: Receipt,
} satisfies Record<string, LucideIcon>;
export type NavIcon = keyof typeof ICONS;
export interface BottomNavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/**
 * Floating glass tab bar for phones (hidden from md up, where the top bar is used).
 * Keep to 5 items or fewer. The most specific matching href is the active one.
 */
export function GlassBottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();
  const active = items
    .filter(
      (i) =>
        pathname === i.href.split("#")[0] ||
        pathname.startsWith(i.href.split("#")[0] + "/"),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-3 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="glass-strong mx-auto flex max-w-md items-stretch justify-between rounded-full p-1.5">
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const on = href === active;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "press flex flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-semibold transition-colors",
                  on
                    ? "bg-flame text-ink shadow-[0_8px_18px_-6px_rgba(249,115,22,0.7)]"
                    : "text-ink/70 hover:bg-peach hover:text-forest",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
