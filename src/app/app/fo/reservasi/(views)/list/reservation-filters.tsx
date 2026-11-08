import type { ReservationStatus } from "@prisma/client";
import { Download, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

import {
  buildExportQuery,
  type ReservationListFilters,
  type ReservationListPreset,
} from "./query";

const presetOptions: Array<{ value?: ReservationListPreset; label: string }> = [
  { label: "All" },
  { value: "in_house", label: "In-House" },
  { value: "today_arrivals", label: "Today's Arrivals" },
  { value: "today_departures", label: "Today's Departures" },
];

type ReservationFiltersProps = {
  filters: ReservationListFilters;
  resultCount: number;
};


const statusOptions: Array<{ value: ReservationStatus; label: string }> = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "CHECKED_OUT", label: "Checked Out" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No-show" },
];

const fieldClass =
  "h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 transition-colors";

export function ReservationFilters({
  filters,
  resultCount,
}: ReservationFiltersProps) {
  const hasActiveFilters =
    filters.q || filters.status || (filters.depositStatus && filters.depositStatus !== "ALL") || filters.checkIn || filters.checkOut || filters.preset || filters.sort === "arrival";
  const exportQuery = buildExportQuery(filters);
  const exportHref = `/app/fo/reservasi/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <form
      action="/app/fo/reservasi/list"
      method="get"
      key={`${exportQuery}&sort=${filters.sort}`}
      className="desktop:sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-200 bg-white p-4 md:p-5"
    >
      <nav aria-label="Reservation quick filters" className="flex w-full flex-wrap gap-2">
        {presetOptions.map((option) => {
          const query = buildExportQuery({ page: 1, q: filters.q, preset: option.value });
          const active = filters.preset === option.value;
          return (
            <Link
              key={option.value ?? "all"}
              href={`/app/fo/reservasi/list${query ? `?${query}` : ""}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 desktop:min-h-9 items-center rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${active ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
      {filters.preset ? <input type="hidden" name="preset" value={filters.preset} /> : null}
      <div className="grid w-full grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="filter-search" className="mb-1.5 block text-xs font-medium text-slate-600">
            Search reservations
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="filter-search"
              type="search"
              name="q"

              defaultValue={filters.q}
              placeholder="Reservation number, guest name, or room"
              className="h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="filter-status" className="mb-1.5 block text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            aria-label="Reservation status"
            defaultValue={filters.preset === "in_house" ? "CHECKED_IN" : filters.status ?? ""}
            disabled={filters.preset === "in_house"}
            className={fieldClass}
          >
            <option value="">Active</option>
            <option value="ALL">All Statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="filter-deposit-status" className="mb-1.5 block text-xs font-medium text-slate-600">
            Deposit Status
          </label>
          <select
            id="filter-deposit-status"
            name="depositStatus"
            defaultValue={filters.depositStatus ?? "ALL"}
            className={fieldClass}
          >
            <option value="ALL">All Deposit Statuses</option>
            <option value="COLLECTED">Guaranteed (Collected)</option>
            <option value="PENDING">Tentative (Pending)</option>
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="filter-sort" className="mb-1.5 block text-xs font-medium text-slate-600">
            Sort by
          </label>
          <select
            id="filter-sort"
            name="sort"
            aria-label="Sort reservations"
            defaultValue={filters.sort ?? "newest"}
            className={fieldClass}
          >
            <option value="newest">Most Recently Created</option>
            <option value="arrival">Check-in Date</option>
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="filter-check-in"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Check-in
          </label>
          <input
            id="filter-check-in"
            type="date"
            name="checkIn"
            disabled={Boolean(filters.preset)}
            defaultValue={filters.preset ? "" : filters.checkIn ?? ""}
            className={fieldClass}
          />
        </div>

        <div className="min-w-0">
          <label
            htmlFor="filter-check-out"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Check-out
          </label>
          <input
            id="filter-check-out"
            type="date"
            name="checkOut"
            disabled={Boolean(filters.preset)}
            defaultValue={filters.preset ? "" : filters.checkOut ?? ""}
            className={fieldClass}
          />
        </div>

        {filters.preset ? (
          <p className="text-xs text-slate-600 sm:col-span-2">
            Select All to use a custom date range.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <Button type="submit">Search</Button>
          {hasActiveFilters ? (
            <Link
              href="/app/fo/reservasi/list"
              aria-label="Reset all filters"
              className={buttonVariants({ variant: "ghost" })}
            >
              <RotateCcw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              Reset
            </Link>
          ) : null}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <span className="whitespace-nowrap text-sm font-medium tabular-nums text-slate-600">
            {resultCount} reservations
          </span>
          <Link
            href={exportHref}
            download
            prefetch={false}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download aria-hidden="true" className="mr-1 h-4 w-4" />
            Export CSV
          </Link>
        </div>
      </div>
    </form>
  );
}
