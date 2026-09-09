import type { ReservationStatus } from "@prisma/client";
import { Search } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

type ReservationFiltersProps = {
  filters: {
    q: string;
    status: ReservationStatus | "";
    checkIn?: string;
    checkOut?: string;
  };
  resultCount: number;
};

const statusOptions: Array<{ value: ReservationStatus; label: string }> = [
  { value: "CONFIRMED", label: "Terkonfirmasi" },
  { value: "CHECKED_IN", label: "Sudah check-in" },
  { value: "CHECKED_OUT", label: "Sudah check-out" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

const fieldClass =
  "h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

export function ReservationFilters({
  filters,
  resultCount,
}: ReservationFiltersProps) {
  const hasActiveFilters =
    filters.q || filters.status || filters.checkIn || filters.checkOut;

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
        className={`${fieldClass} sm:w-[150px]`}
      >
        <option value="">Aktif</option>
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
          className={buttonVariants({ variant: "ghost" })}
        >
          Reset
        </Link>
      ) : null}

      <span className="min-w-0 flex-1" />
      <span className="whitespace-nowrap text-right text-sm font-medium text-slate-500">
        {resultCount} hasil
      </span>
    </form>
  );
}
