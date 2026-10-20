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
  ],
  VOLUNTEER: [
    { href: "/volunteer", label: "My deliveries" },
    { href: "/volunteer/discover", label: "Find pickups" },
  ],
  NGO: [{ href: "/ngo", label: "Incoming deliveries" }],
  BUYER: [{ href: "/buyer", label: "Auctions" }],
  ADMIN: [
    { href: "/admin", label: "Admin" },
    { href: "/donor", label: "Donor view" },
    { href: "/volunteer", label: "Volunteer view" },
    { href: "/ngo", label: "NGO view" },
  ],
};
