"use client";

import Link from "next/link";
import {
  DataGrid,
  gridColumnHelper,
  type GridFilter,
  type GridUrlState,
} from "@/components/shared/data-grid";
import { Pill } from "@/components/shared/status-badge";
import type { DisputeRow } from "@/lib/admin-queries";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_CATEGORY_LABELS,
} from "@/lib/validations/stage6";

const h = gridColumnHelper<DisputeRow>();
const date = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
const STATUS: Record<
  string,
  [string, "green" | "amber" | "red" | "blue" | "gray"]
> = {
  OPEN: ["Open", "amber"],
  IN_REVIEW: ["In review", "blue"],
  RESOLVED: ["Resolved", "green"],
  DISMISSED: ["Dismissed", "gray"],
};

const columns = h.columns([
  h.accessor("category", {
    id: "category",
    header: "Problem",
    cell: (c) => (
      <div className="max-w-sm">
        <p className="font-medium">
          {DISPUTE_CATEGORY_LABELS[
            c.getValue() as keyof typeof DISPUTE_CATEGORY_LABELS
          ] ?? c.getValue()}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {c.row.original.description}
        </p>
      </div>
    ),
  }),
  h.display({
    id: "people",
    header: "Raised by",
    enableSorting: false,
    cell: (c) => (
      <div className="text-xs">
        <p>{c.row.original.raisedBy}</p>
        {c.row.original.against && (
          <p className="text-muted-foreground">
            Against: {c.row.original.against}
          </p>
        )}
        {c.row.original.deliveryTitle && (
          <p className="text-muted-foreground">
            Delivery: {c.row.original.deliveryTitle}
          </p>
        )}
      </div>
    ),
  }),
  h.accessor("status", {
    id: "status",
    header: "Status",
    cell: (c) => {
      const [label, tone] = STATUS[c.getValue()] ?? [
        c.getValue(),
        "gray" as const,
      ];
      return <Pill tone={tone}>{label}</Pill>;
    },
  }),
  h.accessor("createdAt", {
    id: "createdAt",
    header: "Reported",
    cell: (c) => date(c.getValue()),
  }),
  h.display({
    id: "open",
    header: () => <span className="sr-only">Open</span>,
    enableSorting: false,
    cell: (c) => (
      <Link
        href={`/admin/disputes/${c.row.original.id}`}
        className="font-semibold underline"
      >
        {c.row.original.status === "OPEN" ||
        c.row.original.status === "IN_REVIEW"
          ? "Handle"
          : "View"}
      </Link>
    ),
  }),
]);

const FILTERS: GridFilter[] = [
  {
    key: "status",
    label: "Status",
    options: Object.entries(STATUS).map(([value, [label]]) => ({
      value,
      label,
    })),
  },
  {
    key: "category",
    label: "Problem",
    options: DISPUTE_CATEGORIES.map((value) => ({
      value,
      label: DISPUTE_CATEGORY_LABELS[value],
    })),
  },
];

export function DisputesGrid({
  rows,
  total,
  state,
}: {
  rows: DisputeRow[];
  total: number;
  state: GridUrlState;
}) {
  return (
    <DataGrid
      label="Reported problems"
      basePath="/admin/disputes"
      columns={columns}
      data={rows}
      total={total}
      state={state}
      filters={FILTERS}
      searchPlaceholder="Description, person or delivery"
      emptyText="No problems have been reported."
    />
  );
}
