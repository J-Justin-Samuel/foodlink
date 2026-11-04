import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

export interface GridQuery {
  page: number; // 0-based
  pageSize: number;
  q: string;
  sort: string;
  dir: "asc" | "desc";
  filters: Record<string, string>;
}
export const PAGE_SIZES = [10, 25, 50];

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Reads grid state from the URL, falling back to safe defaults and whitelisting everything. */
export function parseGridQuery(
  sp: Record<string, string | string[] | undefined>,
  opts: {
    sorts: string[];
    defaultSort: string;
    filters: Record<string, readonly string[]>;
  },
): GridQuery {
  const one = (k: string) =>
    (Array.isArray(sp[k])
      ? (sp[k] as string[])[0]
      : (sp[k] as string | undefined)) ?? "";
  const page = Math.max(
    0,
    Math.min(100_000, parseInt(one("page") || "0", 10) || 0),
  );
  const size = parseInt(one("size") || "10", 10);
  const filters: Record<string, string> = {};
  for (const [k, allowed] of Object.entries(opts.filters)) {
    const v = one(k);
    if (v && allowed.includes(v)) filters[k] = v;
  }
  return {
    page,
    pageSize: PAGE_SIZES.includes(size) ? size : 10,
    q: one("q").trim().slice(0, 100),
    sort: opts.sorts.includes(one("sort")) ? one("sort") : opts.defaultSort,
    dir: one("dir") === "asc" ? "asc" : "desc",
    filters,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export interface UserRow {
  id: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  name: string | null;
  city: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  lastAudit: string | null;
  createdAt: string;
}

const USER_SORT: Record<string, string> = {
  createdAt: "u.created_at",
  email: "u.email",
  role: "u.role",
  status: "u.onboarding_status",
  name: "name",
};
export const USER_SORTS = Object.keys(USER_SORT);
export const USER_FILTERS = {
  role: ["DONOR", "VOLUNTEER", "NGO", "BUYER", "ADMIN"],
  status: ["SUBMITTED", "VERIFIED", "REJECTED", "IN_PROGRESS", "PENDING"],
  active: ["yes", "no"],
  audit: ["PASSED", "FAILED", "NONE"],
} as const;

export async function listUsers(
  g: GridQuery,
): Promise<{ rows: UserRow[]; total: number }> {
  const where = [sql`true`];
  if (g.q) {
    const like = `%${likeEscape(g.q)}%`;
    where.push(
      sql`(u.email ILIKE ${like} OR p.display_name ILIKE ${like} OR p.organization_name ILIKE ${like} OR p.license_number ILIKE ${like})`,
    );
  }
  if (g.filters.role) where.push(sql`u.role = ${g.filters.role}`);
  if (g.filters.status)
    where.push(sql`u.onboarding_status = ${g.filters.status}`);
  if (g.filters.active)
    where.push(sql`u.is_active = ${g.filters.active === "yes"}`);
  if (g.filters.audit === "NONE") where.push(sql`la.result IS NULL`);
  else if (g.filters.audit) where.push(sql`la.result = ${g.filters.audit}`);
  const w = sql.join(where, sql` AND `);
  const order = sql.raw(
    `${USER_SORT[g.sort]} ${g.dir === "asc" ? "ASC" : "DESC"} NULLS LAST, u.id`,
  );

  const from = sql`
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN LATERAL (SELECT result FROM license_audits a WHERE a.user_id = u.id ORDER BY created_at DESC LIMIT 1) la ON true
    WHERE ${w}`;
  const [t] = await rows<{ n: number }>(sql`SELECT count(*)::int AS n ${from}`);
  const list = await rows<Record<string, any>>(sql`
    SELECT u.id, u.email, u.role, u.onboarding_status AS status, u.is_active, u.created_at,
           COALESCE(p.organization_name, p.display_name) AS name, p.city, p.license_type, p.license_number, la.result AS last_audit
    ${from} ORDER BY ${order} LIMIT ${g.pageSize} OFFSET ${g.page * g.pageSize}
  `);
  return {
    total: t.n,
    rows: list.map((x) => ({
      id: x.id,
      email: x.email,
      role: x.role,
      status: x.status,
      isActive: x.is_active,
      name: x.name,
      city: x.city,
      licenseType: x.license_type,
      licenseNumber: x.license_number,
      lastAudit: x.last_audit,
      createdAt: iso(x.created_at)!,
    })),
  };
}

export interface UserDetail {
  id: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
  name: string | null;
  organization: string | null;
  phone: string | null;
  address: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  licenseDocumentUrl: string | null;
  rewardPoints: number;
  audits: {
    id: string;
    result: string;
    note: string | null;
    at: string;
    auditor: string | null;
    licenseNumber: string | null;
  }[];
  counts: {
    donations: number;
    deliveries: number;
    disputesRaised: number;
    disputesAgainst: number;
  };
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const [u] = await rows<Record<string, any>>(sql`
    SELECT u.*, p.display_name, p.organization_name, p.phone, p.license_type, p.license_number, p.license_document_url, p.reward_points,
           concat_ws(', ', p.address_line, p.city, p.state, p.postal_code) AS address,
           (SELECT COALESCE(rp.organization_name, rp.display_name) FROM profiles rp WHERE rp.user_id = u.reviewed_by) AS reviewer
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ${id}
  `);
  if (!u) return null;
  const audits = await rows<Record<string, any>>(sql`
    SELECT a.id, a.result, a.note, a.created_at, a.license_number, COALESCE(p.display_name, 'Admin') AS auditor
    FROM license_audits a LEFT JOIN profiles p ON p.user_id = a.auditor_id WHERE a.user_id = ${id} ORDER BY a.created_at DESC LIMIT 20
  `);
  const [c] = await rows<Record<string, number>>(sql`
    SELECT (SELECT count(*) FROM donations WHERE donor_id = ${id})::int AS donations,
           (SELECT count(*) FROM deliveries WHERE volunteer_id = ${id} OR ngo_id = ${id})::int AS deliveries,
           (SELECT count(*) FROM disputes WHERE raised_by = ${id})::int AS raised,
           (SELECT count(*) FROM disputes WHERE against_user_id = ${id})::int AS against
  `);
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.onboarding_status,
    isActive: u.is_active,
    reviewNote: u.review_note,
    reviewedAt: iso(u.reviewed_at),
    reviewedByName: u.reviewer ?? null,
    createdAt: iso(u.created_at)!,
    name: u.display_name,
    organization: u.organization_name,
    phone: u.phone,
    address: u.address || null,
    licenseType: u.license_type,
    licenseNumber: u.license_number,
    licenseDocumentUrl: u.license_document_url,
    rewardPoints: u.reward_points ?? 0,
    audits: audits.map((a) => ({
      id: a.id,
      result: a.result,
      note: a.note,
      at: iso(a.created_at)!,
      auditor: a.auditor,
      licenseNumber: a.license_number,
    })),
    counts: {
      donations: c.donations,
      deliveries: c.deliveries,
      disputesRaised: c.raised,
      disputesAgainst: c.against,
    },
  };
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------
export interface DisputeRow {
  id: string;
  category: string;
  status: string;
  raisedBy: string;
  raisedByRole: string;
  against: string | null;
  deliveryTitle: string | null;
  createdAt: string;
  description: string;
}
const DISPUTE_SORT: Record<string, string> = {
  createdAt: "d.created_at",
  status: "d.status",
  category: "d.category",
};
export const DISPUTE_SORTS = Object.keys(DISPUTE_SORT);
export const DISPUTE_FILTERS = {
  status: ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"],
  category: [
    "QUALITY",
    "NO_SHOW",
    "WRONG_QUANTITY",
    "PAYMENT",
    "CONDUCT",
    "OTHER",
  ],
} as const;

const DISPUTE_FROM = sql`
  FROM disputes d
  JOIN users ru ON ru.id = d.raised_by
  LEFT JOIN profiles rp ON rp.user_id = d.raised_by
  LEFT JOIN profiles ap ON ap.user_id = d.against_user_id
  LEFT JOIN deliveries x ON x.id = d.delivery_id
  LEFT JOIN donations dn ON dn.id = x.donation_id`;

export async function listDisputes(
  g: GridQuery,
): Promise<{ rows: DisputeRow[]; total: number }> {
  const where = [sql`true`];
  if (g.q) {
    const like = `%${likeEscape(g.q)}%`;
    where.push(
      sql`(d.description ILIKE ${like} OR ru.email ILIKE ${like} OR rp.display_name ILIKE ${like} OR ap.display_name ILIKE ${like} OR dn.title ILIKE ${like})`,
    );
  }
  if (g.filters.status) where.push(sql`d.status = ${g.filters.status}`);
  if (g.filters.category) where.push(sql`d.category = ${g.filters.category}`);
  const w = sql.join(where, sql` AND `);
  const order = sql.raw(
    `${DISPUTE_SORT[g.sort]} ${g.dir === "asc" ? "ASC" : "DESC"}, d.id`,
  );
  const [t] = await rows<{ n: number }>(
    sql`SELECT count(*)::int AS n ${DISPUTE_FROM} WHERE ${w}`,
  );
  const list = await rows<Record<string, any>>(sql`
    SELECT d.id, d.category, d.status, d.created_at, d.description, ru.role AS raised_role,
           COALESCE(rp.display_name, ru.email) AS raised_by, ap.display_name AS against, dn.title
    ${DISPUTE_FROM} WHERE ${w} ORDER BY ${order} LIMIT ${g.pageSize} OFFSET ${g.page * g.pageSize}
  `);
  return {
    total: t.n,
    rows: list.map((x) => ({
      id: x.id,
      category: x.category,
      status: x.status,
      raisedBy: x.raised_by,
      raisedByRole: x.raised_role,
      against: x.against,
      deliveryTitle: x.title,
      createdAt: iso(x.created_at)!,
      description: x.description,
    })),
  };
}

export interface DisputeDetail {
  id: string;
  category: string;
  status: string;
  description: string;
  resolutionNote: string | null;
  penaltyPoints: number;
  createdAt: string;
  resolvedAt: string | null;
  raisedBy: { id: string; name: string; role: string; email: string };
  against: { id: string; name: string; role: string; email: string } | null;
  delivery: { id: string; title: string; status: string } | null;
}

export async function getDisputeDetail(
  id: string,
): Promise<DisputeDetail | null> {
  const [x] = await rows<Record<string, any>>(sql`
    SELECT d.*, ru.email AS r_email, ru.role AS r_role, COALESCE(rp.display_name, ru.email) AS r_name,
           au.email AS a_email, au.role AS a_role, COALESCE(ap.display_name, au.email) AS a_name,
           dn.title AS d_title, x.status AS d_status
    FROM disputes d
    JOIN users ru ON ru.id = d.raised_by LEFT JOIN profiles rp ON rp.user_id = d.raised_by
    LEFT JOIN users au ON au.id = d.against_user_id LEFT JOIN profiles ap ON ap.user_id = d.against_user_id
    LEFT JOIN deliveries x ON x.id = d.delivery_id LEFT JOIN donations dn ON dn.id = x.donation_id
    WHERE d.id = ${id}
  `);
  if (!x) return null;
  return {
    id: x.id,
    category: x.category,
    status: x.status,
    description: x.description,
    resolutionNote: x.resolution_note,
    penaltyPoints: x.penalty_points,
    createdAt: iso(x.created_at)!,
    resolvedAt: iso(x.resolved_at),
    raisedBy: {
      id: x.raised_by,
      name: x.r_name,
      role: x.r_role,
      email: x.r_email,
    },
    against: x.against_user_id
      ? {
          id: x.against_user_id,
          name: x.a_name,
          role: x.a_role,
          email: x.a_email,
        }
      : null,
    delivery: x.delivery_id
      ? { id: x.delivery_id, title: x.d_title, status: x.d_status }
      : null,
  };
}

/** What a person can report about: their own recent deliveries and who else was in them. */
export interface MyDeliveryOption {
  id: string;
  title: string;
  status: string;
  parties: { id: string; name: string; role: string }[];
}
export async function myDeliveryOptions(
  userId: string,
): Promise<MyDeliveryOption[]> {
  const r = await rows<Record<string, any>>(sql`
    SELECT x.id, d.title, x.status,
           json_build_array(
             json_build_object('id', d.donor_id, 'role', 'DONOR', 'name', COALESCE(dp.organization_name, dp.display_name, 'Donor')),
             json_build_object('id', x.volunteer_id, 'role', 'VOLUNTEER', 'name', COALESCE(vp.display_name, 'Volunteer')),
             json_build_object('id', x.ngo_id, 'role', nu.role, 'name', COALESCE(np.organization_name, np.display_name, 'Receiver'))
           ) AS parties
    FROM deliveries x JOIN donations d ON d.id = x.donation_id
    LEFT JOIN profiles dp ON dp.user_id = d.donor_id
    LEFT JOIN profiles vp ON vp.user_id = x.volunteer_id
    LEFT JOIN users nu ON nu.id = x.ngo_id LEFT JOIN profiles np ON np.user_id = x.ngo_id
    WHERE (x.volunteer_id = ${userId} OR x.ngo_id = ${userId} OR d.donor_id = ${userId})
    ORDER BY x.created_at DESC LIMIT 30
  `);
  return r.map((x) => ({
    id: x.id,
    title: x.title,
    status: x.status,
    parties: (
      x.parties as { id: string | null; name: string; role: string }[]
    ).filter(
      (p): p is { id: string; name: string; role: string } =>
        !!p.id && p.id !== userId,
    ),
  }));
}

export interface MyDispute {
  id: string;
  category: string;
  status: string;
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  deliveryTitle: string | null;
}
export async function myDisputes(userId: string): Promise<MyDispute[]> {
  const r = await rows<Record<string, any>>(sql`
    SELECT d.id, d.category, d.status, d.description, d.resolution_note, d.created_at, dn.title
    FROM disputes d LEFT JOIN deliveries x ON x.id = d.delivery_id LEFT JOIN donations dn ON dn.id = x.donation_id
    WHERE d.raised_by = ${userId} ORDER BY d.created_at DESC LIMIT 50
  `);
  return r.map((x) => ({
    id: x.id,
    category: x.category,
    status: x.status,
    description: x.description,
    resolutionNote: x.resolution_note,
    createdAt: iso(x.created_at)!,
    deliveryTitle: x.title,
  }));
}

export interface AdminOverview {
  pendingReviews: number;
  openDisputes: number;
  failedAudits: number;
  users: number;
  suspended: number;
}
export async function adminOverview(): Promise<AdminOverview> {
  const [x] = await rows<Record<string, number>>(sql`
    SELECT (SELECT count(*) FROM users WHERE onboarding_status = 'SUBMITTED' AND role <> 'ADMIN')::int AS pending,
           (SELECT count(*) FROM disputes WHERE status IN ('OPEN','IN_REVIEW'))::int AS disputes,
           (SELECT count(*) FROM users u WHERE (SELECT result FROM license_audits a WHERE a.user_id = u.id ORDER BY created_at DESC LIMIT 1) = 'FAILED')::int AS failed,
           (SELECT count(*) FROM users)::int AS users,
           (SELECT count(*) FROM users WHERE NOT is_active)::int AS suspended
  `);
  return {
    pendingReviews: x.pending,
    openDisputes: x.disputes,
    failedAudits: x.failed,
    users: x.users,
    suspended: x.suspended,
  };
}
