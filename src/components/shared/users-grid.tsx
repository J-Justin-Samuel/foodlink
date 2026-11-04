"use client";

import Link from "next/link";
import {
  DataGrid,
  gridColumnHelper,
  type GridFilter,
  type GridUrlState,
} from "@/components/shared/data-grid";
import { Pill } from "@/components/shared/status-badge";
import type { UserRow } from "@/lib/admin-queries";
import { ROLE_LABEL } from "@/lib/routes";
import type { Role } from "@/types/roles";

const h = gridColumnHelper<UserRow>();
const date = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));

const STATUS: Record<
  string,
  [string, "green" | "amber" | "red" | "blue" | "gray"]
> = {
  SUBMITTED: ["Waiting for review", "amber"],
  VERIFIED: ["Approved", "green"],
  REJECTED: ["Rejected", "red"],
  IN_PROGRESS: ["Setting up", "gray"],
  PENDING: ["Not started", "gray"],
};

const columns = h.columns([
  h.accessor("name", {
    id: "name",
    header: "Name",
    cell: (c) => (
      <div>
        <p className="font-medium">{c.getValue() ?? "No name yet"}</p>
        <p className="text-xs text-muted-foreground">{c.row.original.email}</p>
      </div>
    ),
  }),
  h.accessor("role", {
    id: "role",
    header: "Role",
    cell: (c) => ROLE_LABEL[c.getValue() as Role] ?? c.getValue(),
  }),
  h.accessor("status", {
    id: "status",
    header: "Status",
    cell: (c) => {
      const [label, tone] = STATUS[c.getValue()] ?? [
        c.getValue(),
        "gray" as const,
      ];
      return (
        <span className="flex flex-wrap items-center gap-1">
          <Pill tone={tone}>{label}</Pill>
          {!c.row.original.isActive && <Pill tone="red">Suspended</Pill>}
        </span>
      );
    },
  }),
  h.display({
    id: "license",
    header: "Licence",
    enableSorting: false,
    cell: (c) => {
      const r = c.row.original;
      return (
        <div className="text-xs">
          <p>
            {r.licenseNumber
              ? `${r.licenseType ?? ""} ${r.licenseNumber}`.trim()
              : "None on file"}
          </p>
          {r.lastAudit && (
            <Pill tone={r.lastAudit === "PASSED" ? "green" : "red"}>
              {r.lastAudit === "PASSED" ? "Audit passed" : "Audit failed"}
            </Pill>
          )}
        </div>
      );
    },
  }),
  h.accessor("createdAt", {
    id: "createdAt",
    header: "Joined",
    cell: (c) => date(c.getValue()),
  }),
  h.display({
    id: "open",
    header: () => <span className="sr-only">Open</span>,
    enableSorting: false,
    cell: (c) => (
      <Link
        href={`/admin/users/${c.row.original.id}`}
        className="font-semibold underline"
      >
        {c.row.original.status === "SUBMITTED" ? "Review" : "Open"}
      </Link>
    ),
  }),
]);

const FILTERS: GridFilter[] = [
  {
    key: "role",
    label: "Role",
    options: Object.entries(ROLE_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    key: "status",
    label: "Status",
    options: Object.entries(STATUS).map(([value, [label]]) => ({
      value,
      label,
    })),
  },
  {
    key: "active",
    label: "Account",
    options: [
      { value: "yes", label: "Active" },
      { value: "no", label: "Suspended" },
    ],
  },
  {
    key: "audit",
    label: "Licence audit",
    options: [
      { value: "PASSED", label: "Passed" },
      { value: "FAILED", label: "Failed" },
      { value: "NONE", label: "Never audited" },
    ],
  },
];

export function UsersGrid({
  rows,
  total,
  state,
}: {
  rows: UserRow[];
  total: number;
  state: GridUrlState;
}) {
  return (
    <DataGrid
      label="Accounts"
      basePath="/admin/users"
      columns={columns}
      data={rows}
      total={total}
      state={state}
      filters={FILTERS}
      searchPlaceholder="Name, email, organisation or licence"
      emptyText="No accounts yet."
    />
  );
}
