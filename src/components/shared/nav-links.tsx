"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/routes";

export function NavLinks({ items }: { items: NavItem[] }) {
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
      className="flex min-w-0 items-center gap-1 overflow-x-auto"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            item.href === active
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
