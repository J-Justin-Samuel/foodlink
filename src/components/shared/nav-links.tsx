"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/routes";

export function NavLinks({
  items,
  hideOnPhone = false,
}: {
  items: NavItem[];
  hideOnPhone?: boolean;
}) {
  const pathname = usePathname();

  // The most specific matching link is the active one (so "/donor" isn't
  // highlighted while you're on "/donor/donations/new").
  const matches = items.filter(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  const active = matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label="Main"
      className={`min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] ${hideOnPhone ? "hidden md:flex" : "flex"}`}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 ${
            item.href === active
              ? "bg-flame text-ink shadow-[0_6px_14px_-6px_rgba(249,115,22,0.8)]"
              : "text-ink/70 hover:bg-peach hover:text-forest"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
