import type { ReservationStatus } from "@prisma/client";
import { CalendarX } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateID, formatDateWithWeekday, formatIDR } from "@/lib/format";

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

const statusClassNames: Record<
  ReservationStatus,
  { label: string; badge: string; pip: string }
> = {
  CONFIRMED: {
    label: "Confirmed",
    badge: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
    pip: "bg-status-oc-pip",
  },
  CHECKED_IN: {
    label: "Checked In",
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
  },
  CHECKED_OUT: {
    label: "Checked Out",
    badge: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
    pip: "bg-status-ooo-pip",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
    pip: "bg-status-od-pip",
  },
  NO_SHOW: {
    label: "No Show",
    badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
    pip: "bg-status-od-pip",
  },
};

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const classes = statusClassNames[status];

  return (
    <StatusBadge
      label={classes.label}
      className={classes.badge}
      pipClassName={classes.pip}
    />
  );
}

function occupantsLabel(adults: number, children: number) {
  // Compact: "2D" (dewasa/adults), append children when present, e.g. "2D · 1A".
  return children > 0 ? `${adults}D · ${children}A` : `${adults}D`;
}

const headerCellClass =
  "bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent";
const numericHeaderCellClass =
  "bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent";

export function ReservationTable({ groups }: ReservationTableProps) {
  const hasRows = groups.length > 0;

  return (
    <div className="max-w-full overflow-auto">
      <table className="w-full min-w-[1100px] border-collapse text-[12px]">
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
                className="border-b border-console-border-soft px-3 py-3"
                colSpan={COLUMN_COUNT}
              >
                <EmptyState
                  icon={CalendarX}
                  title="Tidak ada reservasi"
                  description="Tidak ada reservasi yang cocok dengan filter Anda."
                  action={
                    <Link
                      className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
                      href="/app/fo/reservations/new"
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
          className="border-y border-console-border bg-[var(--slate-100)] px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-console-ink"
        >
          {formatDateWithWeekday(group.arrivalDate)}
          <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
            · {group.rows.length} reservasi
          </span>
        </th>
      </tr>
      {group.rows.map((row) => {
        const href = `/app/fo/reservations/${row.id}`;

        return (
          <ClickableReservationRow key={row.id} href={href}>
            <td className="border-b border-console-border-soft px-3 py-[9px]">
              <ReservationStatusBadge status={row.status} />
            </td>
            <td className="border-b border-console-border-soft px-3 py-[9px] font-semibold text-console-ink">
              <Link
                href={href}
                className="hover:text-console-accent hover:underline"
              >
                {row.guestName}
              </Link>
            </td>
            <td className="num border-b border-console-border-soft px-3 py-[9px] font-semibold text-console-ink">
              {row.reservationNo}
            </td>
            <td className="num border-b border-console-border-soft px-3 py-[9px] text-slate-600">
              {occupantsLabel(row.adults, row.children)}
            </td>
            <td className="num border-b border-console-border-soft px-3 py-[9px]">
              {formatDateID(row.arrivalDate)}
            </td>
            <td className="num border-b border-console-border-soft px-3 py-[9px]">
              {formatDateID(row.departureDate)}
            </td>
            <td className="num border-b border-console-border-soft px-3 py-[9px] text-slate-500">
              {formatDateID(row.createdAt)}
            </td>
            <td className="border-b border-console-border-soft px-3 py-[9px]">
              {row.roomNumber ? (
                <span className="num font-semibold text-console-ink">
                  {row.roomNumber}
                </span>
              ) : (
                <span className="text-[11px] italic text-slate-400">
                  Belum dialokasikan
                </span>
              )}
            </td>
            <td className="num border-b border-console-border-soft px-3 py-[9px] text-right">
              {formatIDR(row.total)}
            </td>
            <td className="num border-b border-console-border-soft px-3 py-[9px] text-right">
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
