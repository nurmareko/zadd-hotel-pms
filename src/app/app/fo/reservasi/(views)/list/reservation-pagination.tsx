import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

import { buildPageHref, type ReservationListFilters } from "./query";

type ReservationPaginationProps = {
  filters: ReservationListFilters;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  fromRow: number;
  toRow: number;
};

export function ReservationPagination({
  filters,
  currentPage,
  totalPages,
  totalCount,
  fromRow,
  toRow,
}: ReservationPaginationProps) {
  if (totalPages <= 1) return null;

  const buttonClass = buttonVariants({ variant: "outline" });

  return (
    <nav
      aria-label="Navigasi halaman reservasi"
      className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p>Menampilkan {fromRow}–{toRow} dari {totalCount} reservasi</p>
      <div className="flex flex-wrap items-center gap-3">
        <p>Halaman {currentPage} dari {totalPages}</p>
        <div className="flex gap-2">
          {currentPage <= 1 ? (
            <button type="button" disabled className={buttonClass}>Sebelumnya</button>
          ) : (
            <Link href={buildPageHref(filters, currentPage - 1)} className={buttonClass}>
              Sebelumnya
            </Link>
          )}
          {currentPage >= totalPages ? (
            <button type="button" disabled className={buttonClass}>Berikutnya</button>
          ) : (
            <Link href={buildPageHref(filters, currentPage + 1)} className={buttonClass}>
              Berikutnya
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
