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
  { label: "Semua" },
  { value: "today_arrivals", label: "Kedatangan Hari Ini" },
  { value: "today_departures", label: "Keberangkatan Hari Ini" },
];

type ReservationFiltersProps = {
  filters: ReservationListFilters;
  resultCount: number;
};


const statusOptions: Array<{ value: ReservationStatus; label: string }> = [
  { value: "CONFIRMED", label: "Terkonfirmasi" },
  { value: "CHECKED_IN", label: "Sudah check-in" },
  { value: "CHECKED_OUT", label: "Sudah check-out" },
  { value: "CANCELLED", label: "Dibatalkan" },
  { value: "NO_SHOW", label: "No-show" },
];

const fieldClass =
  "h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 transition-colors";

export function ReservationFilters({
  filters,
  resultCount,
}: ReservationFiltersProps) {
  const hasActiveFilters =
    filters.q || filters.status || filters.checkIn || filters.checkOut || filters.preset;
  const exportQuery = buildExportQuery(filters);
  const exportHref = `/app/fo/reservasi/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <form
      action="/app/fo/reservasi/list"
      method="get"
      key={exportQuery}
      className="desktop:sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-4"
    >
      <nav aria-label="Filter cepat reservasi" className="flex w-full flex-wrap gap-2">
        {presetOptions.map((option) => {
          const query = buildExportQuery({ q: filters.q, preset: option.value });
          const active = filters.preset === option.value;
          return (
            <Link
              key={option.value ?? "all"}
              href={`/app/fo/reservasi/list${query ? `?${query}` : ""}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 desktop:min-h-9 items-center rounded-full border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${active ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
      {filters.preset ? <input type="hidden" name="preset" value={filters.preset} /> : null}
      <div className="relative w-full sm:w-[280px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          name="q"
          aria-label="Cari nomor reservasi atau nama tamu"
          defaultValue={filters.q}
          placeholder="Cari nomor reservasi atau nama tamu..."
          className="h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
        />
      </div>

      <select
        name="status"
        aria-label="Status reservasi"
        defaultValue={filters.status ?? ""}
        className={`${fieldClass} sm:w-[160px]`}
      >
        <option value="">Aktif</option>
        <option value="ALL">Semua Status</option>
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5">
        <label
          htmlFor="filter-check-in"
          className="whitespace-nowrap text-xs font-medium text-slate-600"
        >
          Check-in
        </label>
        <input
          id="filter-check-in"
          type="date"
          name="checkIn"
          disabled={Boolean(filters.preset)}
          defaultValue={filters.preset ? "" : filters.checkIn ?? ""}
          className={`${fieldClass} sm:w-[145px]`}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <label
          htmlFor="filter-check-out"
          className="whitespace-nowrap text-xs font-medium text-slate-600"
        >
          Check-out
        </label>
        <input
          id="filter-check-out"
          type="date"
          name="checkOut"
          disabled={Boolean(filters.preset)}
          defaultValue={filters.preset ? "" : filters.checkOut ?? ""}
          className={`${fieldClass} sm:w-[145px]`}
        />
      </div>

      {filters.preset ? (
        <p className="w-full text-xs text-slate-500">
          Pilih Semua untuk menggunakan rentang tanggal khusus.
        </p>
      ) : null}
      <Button type="submit">Cari</Button>
      {hasActiveFilters ? (
        <Link
          href="/app/fo/reservasi/list"
          aria-label="Atur ulang semua filter"
          className={buttonVariants({ variant: "ghost" })}
        >
          <RotateCcw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
          Atur Ulang
        </Link>
      ) : null}

      <span className="min-w-0 flex-1" />
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-right text-sm font-medium text-slate-500">
          {resultCount} hasil
        </span>
        <Link
          href={exportHref}
          download
          prefetch={false}
          className={buttonVariants({ variant: "outline" })}
        >
          <Download aria-hidden="true" className="mr-1 h-4 w-4" />
          Ekspor CSV
        </Link>
      </div>
    </form>
  );
}
