import type { ReservationStatus } from "@prisma/client";
import { Download, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

type ReservationFilters = {
  q: string;
  status: ReservationStatus | "ALL" | "";
  checkIn?: string;
  checkOut?: string;
};

type ReservationFiltersProps = {
  filters: ReservationFilters;
  resultCount: number;
};

export function buildExportQuery(filters: ReservationFilters): string {
  const query = new URLSearchParams();

  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  if (filters.checkIn) query.set("checkIn", filters.checkIn);
  if (filters.checkOut) query.set("checkOut", filters.checkOut);

  return query.toString();
}

const statusOptions: Array<{ value: ReservationStatus; label: string }> = [
  { value: "CONFIRMED", label: "Terkonfirmasi" },
  { value: "CHECKED_IN", label: "Sudah check-in" },
  { value: "CHECKED_OUT", label: "Sudah check-out" },
  { value: "CANCELLED", label: "Dibatalkan" },
  { value: "NO_SHOW", label: "No-show" },
];

const fieldClass =
  "h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

export function ReservationFilters({
  filters,
  resultCount,
}: ReservationFiltersProps) {
  const hasActiveFilters =
    filters.q || filters.status || filters.checkIn || filters.checkOut;
  const exportQuery = buildExportQuery(filters);
  const exportHref = `/app/fo/reservasi/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <form
      action="/app/fo/reservasi/list"
      method="get"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-4"
    >
      <div className="relative w-full sm:w-[280px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
                  type="search"
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Cari nomor reservasi atau nama tamu..."
                  className="h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
      </div>

      <select
        name="status"
        defaultValue={filters.status}
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
          defaultValue={filters.checkIn ?? ""}
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
          defaultValue={filters.checkOut ?? ""}
          className={`${fieldClass} sm:w-[145px]`}
        />
      </div>

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
