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
      aria-label="Reservation pagination"
      className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p>Showing {fromRow}–{toRow} of {totalCount} reservations</p>
      <div className="flex flex-wrap items-center gap-3">
        <p>Page {currentPage} of {totalPages}</p>
        <div className="flex gap-2">
          {currentPage <= 1 ? (
            <button type="button" disabled className={buttonClass}>Previous</button>
          ) : (
            <Link href={buildPageHref(filters, currentPage - 1)} className={buttonClass}>
              Previous
            </Link>
          )}
          {currentPage >= totalPages ? (
            <button type="button" disabled className={buttonClass}>Next</button>
          ) : (
            <Link href={buildPageHref(filters, currentPage + 1)} className={buttonClass}>
              Next
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
