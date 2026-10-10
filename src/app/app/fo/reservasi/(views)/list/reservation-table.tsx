import type { ReservationStatus } from "@prisma/client";
import { CalendarX } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatDateID,
  formatDateWithWeekday,
  formatDecimalID,
} from "@/lib/format";
import { hasSharedReservationStatusColor } from "@/lib/reservation-status-colors";

import { ClickableReservationRow } from "./clickable-reservation-row";

export type ReservationRow = {
  id: number;
  reservationNo: string;
  guestName: string;
  arrivalDate: Date;
  departureDate: Date;
  createdAt: Date;
  adults: number;
  children: number;
  roomNumber: string | null;
  status: ReservationStatus;
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

const COLUMN_COUNT = 10;

const statusLabels: Record<ReservationStatus, string> = {
  CONFIRMED: "Terkonfirmasi",
  CHECKED_IN: "Sudah check-in",
  CHECKED_OUT: "Sudah check-out",
  CANCELLED: "Dibatalkan",
  NO_SHOW: "No-show",
};

const noShowClassNames = {
  badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
  pip: "bg-status-od-pip",
};

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  if (hasSharedReservationStatusColor(status)) {
    return <StatusBadge label={statusLabels[status]} reservationStatus={status} />;
  }

  return (
    <StatusBadge
      label={statusLabels[status]}
      className={noShowClassNames.badge}
      pipClassName={noShowClassNames.pip}
    />
  );
}

function occupantsLabel(adults: number, children: number) {
  // Compact: "2D" (dewasa/adults), append children when present, e.g. "2D · 1A".
  return children > 0 ? `${adults}D · ${children}A` : `${adults}D`;
}

const headerCellClass =
  "bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600";
const numericHeaderCellClass =
  "bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600";

export function ReservationTable({ groups, groupByArrival = true }: ReservationTableProps) {
  const hasRows = groups.length > 0;

  return (
    <div className="max-w-full overflow-auto">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <caption className="sr-only">
          {groupByArrival
            ? "Daftar reservasi hotel dikelompokkan menurut tanggal check-in"
            : "Daftar reservasi hotel dari yang terbaru dibuat"}
        </caption>
        <thead>
          <tr>
            <th className={headerCellClass} scope="col">
              Status
            </th>
            <th className={headerCellClass} scope="col">
              Nama
            </th>
            <th className={headerCellClass} scope="col">
              Referensi
            </th>
            <th className={headerCellClass} scope="col">
              Tamu
            </th>
            <th className={headerCellClass} scope="col">
              Check-in
            </th>
            <th className={headerCellClass} scope="col">
              Check-out
            </th>
            <th className={headerCellClass} scope="col">
              Dibuat
            </th>
            <th className={headerCellClass} scope="col">
              Kamar
            </th>
            <th className={numericHeaderCellClass} scope="col">
              Total (Rp)
            </th>
            <th className={numericHeaderCellClass} scope="col">
              Saldo (Rp)
            </th>
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            groups.map((group) => (
              <GroupRows key={group.dateKey} group={group} groupByArrival={groupByArrival} />
            ))
          ) : (
            <tr>
              <td
                className="border-b border-slate-100 px-4 py-8"
                colSpan={COLUMN_COUNT}
              >
                <EmptyState
                  icon={CalendarX}
                  title="Tidak ada reservasi"
                  description="Tidak ada reservasi yang cocok dengan filter Anda."
                  action={
                    <Link
                                          className={buttonVariants({ variant: "default" })}
                                          href="/app/fo/reservasi/new?from=list"
                    >
                      Buat Reservasi
                    </Link>
                  }
                />
              </td>
            </tr>
          )}
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
            · {group.rows.length} reservasi
          </span>
        </th>
      </tr> : null}
      {group.rows.map((row) => {
        const href = `/app/fo/reservasi/${row.id}`;

        return (
          <ClickableReservationRow key={row.id} href={href}>
            <td className="border-b border-slate-100 px-4 py-3">
              <ReservationStatusBadge status={row.status} />
            </td>
            <td className="border-b border-slate-100 p-0">
              <Link
                href={href}
                aria-label={`Buka reservasi ${row.reservationNo} untuk ${row.guestName}`}
                className="flex min-h-11 items-center px-4 py-3 font-semibold text-slate-900 outline-none transition-colors hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500"
              >
                {row.guestName}
              </Link>
            </td>
            <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
              <div className="flex flex-col gap-1">
                <span>{row.reservationNo}</span>
                {row.groupBookingId && row.groupRoomCount ? (
                  <Link
                    href={`/app/fo/reservasi/grup/${row.groupBookingId}`}
                    className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900"
                  >
                    Grup ({row.groupRoomCount} kamar)
                  </Link>
                ) : null}
              </div>
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
              {occupantsLabel(row.adults, row.children)}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
              {formatDateID(row.arrivalDate)}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
              {formatDateID(row.departureDate)}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
              {formatDateID(row.createdAt)}
            </td>
            <td className="border-b border-slate-100 px-4 py-3">
              {row.roomNumber ? (
                <span className="font-semibold text-slate-900">
                  {row.roomNumber}
                </span>
              ) : (
                <Link
                  href={`${href}?mode=edit`}
                  aria-label={`Alokasikan kamar untuk reservasi ${row.reservationNo}`}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  + Alokasikan
                </Link>
              )}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-right font-medium tabular-nums text-slate-900">
              {formatDecimalID(row.total, 0)}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-right font-medium tabular-nums text-slate-900">
              {row.outstanding === null ? (
                <span className="text-slate-400">-</span>
              ) : (
                formatDecimalID(row.outstanding, 0)
              )}
            </td>
          </ClickableReservationRow>
        );
      })}
    </>
  );
}
