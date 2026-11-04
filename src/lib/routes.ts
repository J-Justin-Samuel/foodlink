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
}

/** Top-bar links per role. Every page a role can use is reachable from here. */
export const ROLE_NAV: Record<Role, NavItem[]> = {
  DONOR: [
    { href: "/donor", label: "My donations" },
    { href: "/donor/donations/new", label: "List food" },
    { href: "/donor/impact", label: "Impact" },
    { href: "/donor/payouts", label: "Payouts" },
    { href: "/support", label: "Help" },
  ],
  VOLUNTEER: [
    { href: "/volunteer", label: "My deliveries" },
    { href: "/volunteer/discover", label: "Find pickups" },
    { href: "/volunteer/rewards", label: "Rewards" },
    { href: "/support", label: "Help" },
  ],
  NGO: [
    { href: "/ngo", label: "Incoming deliveries" },
    { href: "/support", label: "Help" },
  ],
  BUYER: [
    { href: "/buyer", label: "Auctions" },
    { href: "/buyer#purchases", label: "My purchases" },
    { href: "/support", label: "Help" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/users", label: "Accounts" },
    { href: "/admin/disputes", label: "Reports" },
    { href: "/admin/impact", label: "Impact" },
    { href: "/donor", label: "Donor view" },
    { href: "/volunteer", label: "Volunteer view" },
    { href: "/ngo", label: "NGO view" },
    { href: "/buyer", label: "Buyer view" },
  ],
};
