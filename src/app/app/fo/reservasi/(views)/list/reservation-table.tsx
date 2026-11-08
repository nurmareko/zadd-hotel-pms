import type { DepositStatus, ReservationStatus, ReservationType } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { CalendarX } from "lucide-react";
import Link from "next/link";

import { BookingStatusBadge, ReservationTypeBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatDateID,
  formatDateWithWeekday,
  formatDecimalID,
} from "@/lib/format";


import { ClickableReservationRow } from "./clickable-reservation-row";

export type ReservationRow = {
  id: number;
  reservationNo: string;
  reservationType: ReservationType;
  roomTypeCode: string;
  roomTypeName: string;
  guestName: string;
  arrivalDate: Date;
  departureDate: Date;
  createdAt: Date;
  adults: number;
  children: number;
  roomNumber: string | null;
  status: ReservationStatus;
  depositStatus: DepositStatus;
  total: number;
  // null when the reservation has no folio yet (e.g. CONFIRMED pre-check-in).
  outstanding: number | null;
  groupBookingId: string | null;
  groupRoomCount: number | null;
};

export type ReservationGroup = {
  dateKey: string;
  arrivalDate: Date;
  rows: ReservationRow[];
};

type ReservationTableProps = {
  groups: ReservationGroup[];
  groupByArrival?: boolean;
};

const COLUMN_COUNT = 9;


function occupantsLabel(adults: number, children: number) {
  // Compact adult/child counts, e.g. "2A · 1C".
  return children > 0 ? `${adults}A · ${children}C` : `${adults}A`;
}

const headerCellClass =
  "bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600";
const numericHeaderCellClass =
  "bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600";

export function ReservationTable({ groups, groupByArrival = true }: ReservationTableProps) {
  const hasRows = groups.length > 0;

  if (!hasRows) {
    return (
      <div className="px-4 py-8 md:p-10">
        <EmptyState
          icon={CalendarX}
          title="No matching reservations"
          description="Try a different guest name, status, or date range. To add a booking, create a new reservation."
          action={
            <Link
              className={buttonVariants({ variant: "default" })}
              href="/app/fo/reservasi/new?from=list"
            >
              New Reservation
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-auto" role="region" aria-label="Reservation results" tabIndex={0}>
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <caption className="sr-only">
          {groupByArrival
            ? "Hotel reservations grouped by check-in date"
            : "Hotel reservations, most recently created first"}
        </caption>
        <thead>
          <tr>
            <th className={headerCellClass} scope="col">
              Reference
            </th>
            <th className={headerCellClass} scope="col">
              Reservation Type
            </th>
            <th className={headerCellClass} scope="col">
              Guest Name
            </th>
            <th className={headerCellClass} scope="col">
              Room
            </th>
            <th className={headerCellClass} scope="col">
              Room Type
            </th>
            <th className={headerCellClass} scope="col">
              Check-in / Check-out
            </th>
            <th className={numericHeaderCellClass} scope="col">
              Total (Rp)
            </th>
            <th className={numericHeaderCellClass} scope="col">
              Balance Due (Rp)
            </th>
            <th className={headerCellClass} scope="col">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows key={group.dateKey} group={group} groupByArrival={groupByArrival} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group, groupByArrival }: { group: ReservationGroup; groupByArrival: boolean }) {
  return (
    <>
      {groupByArrival ? <tr>
        <th
          colSpan={COLUMN_COUNT}
          scope="colgroup"
          className="border-y border-slate-200 bg-slate-100/70 px-4 py-2 text-left text-xs font-semibold text-slate-700"
        >
          {formatDateWithWeekday(group.arrivalDate)}
          <span className="ml-2 font-normal text-slate-500">
            · {group.rows.length} reservations
          </span>
        </th>
      </tr> : null}
      {group.rows.map((row) => {
        const href = `/app/fo/reservasi/${row.id}`;
        const nights = differenceInCalendarDays(row.departureDate, row.arrivalDate);

        return (
          <ClickableReservationRow key={row.id} href={href}>

            <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
              <div className="flex flex-col gap-1">
                <Link
                  href={href}
                  aria-label={`Open reservation ${row.reservationNo} for ${row.guestName}`}
                  className="inline-flex min-h-11 items-center rounded-sm hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {row.reservationNo}
                </Link>
                {row.groupBookingId ? (
                  <Link
                    href={`/app/fo/reservasi/grup/${row.groupBookingId}`}
                    className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900"
                  >
                    Group ({row.groupRoomCount} rooms)
                  </Link>
                ) : null}
              </div>
            </td>
            <td className="border-b border-slate-100 px-4 py-3">
              <ReservationTypeBadge type={row.reservationType} />
            </td>
            <td className="border-b border-slate-100 px-4 py-3">
              <div className="font-semibold text-slate-900">{row.guestName}</div>
              <div className="mt-1 text-xs text-slate-500">{occupantsLabel(row.adults, row.children)}</div>
            </td>
            <td className="border-b border-slate-100 px-4 py-3">
              {row.roomNumber ? (
                <span className="font-semibold text-slate-900">
                  {row.roomNumber}
                </span>
              ) : (
                <Link
                  href={`${href}?mode=edit`}
                  aria-label={`Assign a room to reservation ${row.reservationNo}`}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  Unassigned
                </Link>
              )}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
              {row.roomTypeName}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
              <div className="whitespace-nowrap">{formatDateID(row.arrivalDate)} – {formatDateID(row.departureDate)}</div>
              <div className="mt-1 text-xs text-slate-500">{nights} {nights === 1 ? "night" : "nights"}</div>
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-right font-medium tabular-nums text-slate-900">
              {formatDecimalID(row.total, 0)}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-right font-medium tabular-nums text-slate-900">
              {row.outstanding === null ? (
                <span className="text-slate-400">-</span>
              ) : (
                <span className={row.outstanding > 0 ? "text-amber-700" : undefined}>
                  {formatDecimalID(row.outstanding, 0)}
                </span>
              )}
            </td>
            <td className="border-b border-slate-100 px-4 py-3">
              <BookingStatusBadge status={row.status} depositStatus={row.depositStatus} />
            </td>
          </ClickableReservationRow>
        );
      })}
    </>
  );
}
