import type { ReservationStatus } from "@prisma/client";
import { Search } from "lucide-react";

type ReservationFiltersProps = {
  filters: {
    q: string;
    status: ReservationStatus | "";
    startDate: string;
  };
  resultCount: number;
};

const statusOptions: Array<{ value: ReservationStatus; label: string }> = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "CHECKED_OUT", label: "Checked Out" },
  { value: "CANCELLED", label: "Cancelled" },
];

const fieldClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

export function ReservationFilters({
  filters,
  resultCount,
}: ReservationFiltersProps) {
  return (
    <form
      action="/app/fo/reservasi/list"
      method="get"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-4"
    >
      <input type="hidden" name="startDate" value={filters.startDate} />

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
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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

      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors"
      >
        Cari
      </button>

      <span className="min-w-0 flex-1" />
      <span className="whitespace-nowrap text-right text-sm font-medium text-slate-500">
        {resultCount} hasil
      </span>
    </form>
  );
}
