import type { NavIcon } from "@/components/glass/bottom-nav";
import type { Role } from "@/types/roles";

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  DONOR: "/donor",
  VOLUNTEER: "/volunteer",
  NGO: "/ngo",
  BUYER: "/buyer",
  ADMIN: "/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  DONOR: "Donor",
  VOLUNTEER: "Volunteer",
  NGO: "NGO / Shelter",
  BUYER: "Buyer",
  ADMIN: "Admin",
};

export interface NavItem {
  href: string;
  label: string;
  /** Items with an icon also appear in the phone's floating bottom bar (keep to 5 or fewer). */
  icon?: NavIcon;
  /** Short label for the bottom bar. */
  short?: string;
}

/** Top-bar links per role. Every page a role can use is reachable from here. */
export const ROLE_NAV: Record<Role, NavItem[]> = {
  DONOR: [
    { href: "/donor", label: "Home", icon: "home" },
    {
      href: "/donor/donations/new",
      label: "List food",
      short: "List",
      icon: "plus",
    },
    { href: "/donor/impact", label: "Impact", icon: "chart" },
    { href: "/donor/payouts", label: "Payouts", icon: "wallet" },
    { href: "/support", label: "Help", icon: "help" },
  ],
  VOLUNTEER: [
    { href: "/volunteer", label: "Home", icon: "truck" },
    {
      href: "/volunteer/discover",
      label: "Find pickups",
      short: "Pickups",
      icon: "map",
    },
    { href: "/volunteer/rewards", label: "Rewards", icon: "gift" },
    { href: "/support", label: "Help", icon: "help" },
  ],
  NGO: [
    { href: "/ngo", label: "Home", icon: "package" },
    { href: "/support", label: "Help", icon: "help" },
  ],
  BUYER: [
    { href: "/buyer", label: "Home", icon: "home" },
    { href: "/buyer#auctions", label: "Auctions", icon: "gavel" },
    {
      href: "/buyer#purchases",
      label: "My purchases",
      short: "Purchases",
      icon: "bag",
    },
    { href: "/support", label: "Help", icon: "help" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview", icon: "home" },
    { href: "/admin/users", label: "Accounts", icon: "users" },
    { href: "/admin/disputes", label: "Reports", icon: "flag" },
    { href: "/admin/impact", label: "Impact", icon: "chart" },
    { href: "/donor", label: "Donor view" },
    { href: "/volunteer", label: "Volunteer view" },
    { href: "/ngo", label: "NGO view" },
    { href: "/buyer", label: "Buyer view" },
  ],
};
