import type { ReservationStatus } from "@prisma/client";
import { CalendarX } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateID, formatDateWithWeekday, formatIDR } from "@/lib/format";
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
};

export type ReservationGroup = {
  dateKey: string;
  arrivalDate: Date;
  rows: ReservationRow[];
};

type ReservationTableProps = {
  groups: ReservationGroup[];
};

const COLUMN_COUNT = 10;

const statusLabels: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
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

export function ReservationTable({ groups }: ReservationTableProps) {
  const hasRows = groups.length > 0;

  return (
    <div className="max-w-full overflow-auto">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <caption className="sr-only">
          Daftar reservasi hotel dikelompokkan menurut tanggal check-in
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
              Check In
            </th>
            <th className={headerCellClass} scope="col">
              Check Out
            </th>
            <th className={headerCellClass} scope="col">
              Dibuat
            </th>
            <th className={headerCellClass} scope="col">
              Kamar
            </th>
            <th className={numericHeaderCellClass} scope="col">
              Total
            </th>
            <th className={numericHeaderCellClass} scope="col">
              Saldo
            </th>
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            groups.map((group) => (
              <GroupRows key={group.dateKey} group={group} />
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
                      className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors"
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

function GroupRows({ group }: { group: ReservationGroup }) {
  return (
    <>
      <tr>
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
      </tr>
      {group.rows.map((row) => {
        const href = `/app/fo/reservasi/${row.id}`;

        return (
          <ClickableReservationRow key={row.id} href={href}>
            <td className="border-b border-slate-100 px-4 py-3">
              <ReservationStatusBadge status={row.status} />
            </td>
            <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
              {row.guestName}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
              {row.reservationNo}
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
                <span className="text-xs italic text-slate-400">
                  Belum dialokasikan
                </span>
              )}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-right font-medium text-slate-900">
              {formatIDR(row.total)}
            </td>
            <td className="border-b border-slate-100 px-4 py-3 text-right font-medium text-slate-900">
              {row.outstanding === null ? (
                <span className="text-slate-400">-</span>
              ) : (
                formatIDR(row.outstanding)
              )}
            </td>
          </ClickableReservationRow>
        );
      })}
    </>
  );
}
