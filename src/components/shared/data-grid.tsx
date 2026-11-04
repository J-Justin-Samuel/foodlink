"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FlexRender,
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type RowData,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

/** Stable, module-level table setup (TanStack Table v9 wants features and columns that don't change per render). */
export const gridFeatures = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
});
export const gridColumnHelper = <T extends RowData>() =>
  createColumnHelper<typeof gridFeatures, T>();
export type GridColumn<T extends RowData> = ColumnDef<
  typeof gridFeatures,
  T,
  any
>;

export interface GridFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface GridUrlState {
  page: number; // 0-based
  pageSize: number;
  q: string;
  sort: string;
  dir: "asc" | "desc";
  filters: Record<string, string>;
}

const EMPTY: never[] = [];
const PAGE_SIZES = [10, 25, 50];

function toQuery(s: GridUrlState): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  for (const [k, v] of Object.entries(s.filters)) if (v) p.set(k, v);
  p.set("sort", s.sort);
  p.set("dir", s.dir);
  if (s.page > 0) p.set("page", String(s.page));
  if (s.pageSize !== 10) p.set("size", String(s.pageSize));
  return p.toString();
}

/**
 * A table whose paging, sorting, search and filters all live in the page URL.
 * The server page reads the URL and sends only the rows for the current page, so the
 * grid stays fast with thousands of rows, and any view can be bookmarked or shared.
 */
export function DataGrid<T extends RowData>({
  basePath,
  columns,
  data,
  total,
  state,
  filters,
  searchPlaceholder,
  emptyText,
  label,
}: {
  basePath: string;
  columns: GridColumn<T>[];
  data: T[];
  total: number;
  state: GridUrlState;
  filters: GridFilter[];
  searchPlaceholder: string;
  emptyText: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, startNav] = useTransition();
  const [search, setSearch] = useState(state.q);

  const go = (next: Partial<GridUrlState>) =>
    startNav(() =>
      router.push(`${basePath}?${toQuery({ ...state, ...next })}`),
    );

  const table = useTable({
    features: gridFeatures,
    columns,
    data: data ?? EMPTY,
    manualPagination: true,
    manualSorting: true,
    rowCount: total,
    state: {
      pagination: { pageIndex: state.page, pageSize: state.pageSize },
      sorting: [{ id: state.sort, desc: state.dir === "desc" }],
    },
    onPaginationChange: (updater: Updater<PaginationState>) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: state.page, pageSize: state.pageSize })
          : updater;
      go({
        page: next.pageSize !== state.pageSize ? 0 : next.pageIndex,
        pageSize: next.pageSize,
      });
    },
    onSortingChange: (updater: Updater<SortingState>) => {
      const current: SortingState = [
        { id: state.sort, desc: state.dir === "desc" },
      ];
      const next = typeof updater === "function" ? updater(current) : updater;
      // Clicking the same column again flips direction instead of clearing the sort.
      const pick = next[0] ?? { id: state.sort, desc: state.dir !== "desc" };
      go({ sort: pick.id, dir: pick.desc ? "desc" : "asc", page: 0 });
    },
  });

  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const from = total === 0 ? 0 : state.page * state.pageSize + 1;
  const to = Math.min(total, (state.page + 1) * state.pageSize);
  const hasFilter = !!state.q || Object.keys(state.filters).length > 0;

  return (
    <section aria-label={label} className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: search.trim(), page: 0 });
        }}
        role="search"
      >
        <label className="grid gap-1 text-sm font-medium">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            maxLength={100}
            className="h-10 w-64 max-w-full rounded-md border-2 border-foreground bg-background px-3 text-sm"
          />
        </label>
        <Button type="submit" disabled={busy}>
          Search
        </Button>
        {filters.map((f) => (
          <label key={f.key} className="grid gap-1 text-sm font-medium">
            {f.label}
            <select
              value={state.filters[f.key] ?? ""}
              onChange={(e) =>
                go({
                  filters: { ...state.filters, [f.key]: e.target.value },
                  page: 0,
                })
              }
              className="h-10 rounded-md border-2 border-foreground bg-background px-2 text-sm"
            >
              <option value="">All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {hasFilter && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch("");
              go({ q: "", filters: {}, page: 0 });
            }}
          >
            Clear filters
          </Button>
        )}
      </form>

      <div
        className={`overflow-x-auto rounded-lg border-2 border-foreground transition-opacity ${busy ? "opacity-60" : ""}`}
        aria-busy={busy}
      >
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : canSort
                              ? "none"
                              : undefined
                      }
                      className="whitespace-nowrap px-3 py-2 font-semibold"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="text-xs">
                            {sorted === "asc"
                              ? "▲"
                              : sorted === "desc"
                                ? "▼"
                                : ""}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-top">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {hasFilter ? "Nothing matches these filters." : emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p role="status" aria-live="polite">
          {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={state.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-9 rounded-md border-2 border-foreground bg-background px-2"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy || state.page <= 0}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <span>
            Page {Math.min(state.page + 1, pageCount)} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={busy || state.page + 1 >= pageCount}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
