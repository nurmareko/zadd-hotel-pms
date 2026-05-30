import type { ReservationStatus } from "@prisma/client";
import { Search } from "lucide-react";

type ReservationFiltersProps = {
  filters: {
    q: string;
    status: ReservationStatus | "";
    from: string;
    to: string;
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
  "h-8 w-full border border-slate-400 bg-console-surface px-2.5 text-[11px] font-medium text-console-ink outline-none focus:border-console-ink focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]";

export function ReservationFilters({
  filters,
  resultCount,
}: ReservationFiltersProps) {
  return (
    <form
      action="/app/fo/reservations"
      method="get"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-console-border bg-console-surface p-3.5"
    >
      <div className="relative w-full sm:w-[280px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Cari nomor reservasi atau nama tamu..."
          className="h-8 w-full border border-slate-400 bg-console-surface pl-8 pr-2.5 text-[12px] text-console-ink outline-none placeholder:text-slate-400 focus:border-console-ink focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]"
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

      <input
        type="date"
        name="from"
        aria-label="Tanggal mulai"
        defaultValue={filters.from}
        className={`${fieldClass} sm:w-[140px]`}
      />
      <span className="hidden text-slate-400 sm:inline">-</span>
      <input
        type="date"
        name="to"
        aria-label="Tanggal akhir"
        defaultValue={filters.to}
        className={`${fieldClass} sm:w-[140px]`}
      />

      <button
        type="submit"
        className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
      >
        Cari
      </button>

      <span className="min-w-0 flex-1" />
      <span className="num whitespace-nowrap text-right text-[11px] font-medium text-slate-500">
        {resultCount} hasil
      </span>
    </form>
  );
}
