import type { ReservationStatus, ReservationType } from "@prisma/client";
import { ArrowDown, ArrowUp, CalendarX } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateID, formatIDR } from "@/lib/format";

type SortKey = "reservation_no" | "arrival" | "departure";
type SortDirection = "asc" | "desc";

type ReservationTableProps = {
  filters: {
    q: string;
    status: ReservationStatus | "";
    type: string;
    from: string;
    to: string;
    sort: SortKey;
    dir: SortDirection;
  };
  reservations: Array<{
    id: number;
    reservationNo: string;
    arrivalDate: Date;
    departureDate: Date;
    rateAmount: { toString(): string };
    deposit: { toString(): string };
    status: ReservationStatus;
    reservationType: ReservationType;
    guest: {
      fullName: string;
    };
    roomType: {
      name: string;
    };
  }>;
};

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

const reservationTypeLabels: Record<ReservationType, string> = {
  INDIVIDUAL: "Individual",
  COMPANY: "Company",
  GOVERNMENT: "Government",
  OTA: "Online Travel Agent",
  WALK_IN: "Walk-in",
};

function dateLabel(date: Date) {
  return formatDateID(date);
}

function ariaSort(
  filters: ReservationTableProps["filters"],
  column: SortKey,
) {
  if (filters.sort !== column) {
    return "none";
  }

  return filters.dir === "asc" ? "ascending" : "descending";
}

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

function buildQueryString({
  filters,
  sort,
  dir,
}: {
  filters: ReservationTableProps["filters"];
  sort: SortKey;
  dir: SortDirection;
}) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.type) {
    params.set("type", filters.type);
  }

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  params.set("sort", sort);
  params.set("dir", dir);

  return params.toString();
}

function SortHeader({
  children,
  column,
  filters,
}: {
  children: React.ReactNode;
  column: SortKey;
  filters: ReservationTableProps["filters"];
}) {
  const isActive = filters.sort === column;
  const nextDir = isActive && filters.dir === "asc" ? "desc" : "asc";
  const href = `/app/fo/reservations?${buildQueryString({
    filters,
    sort: column,
    dir: nextDir,
  })}`;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-console-accent hover:text-white"
    >
      {children}
      {isActive ? (
        filters.dir === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        )
      ) : null}
    </Link>
  );
}

function LinkedCell({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`border-b border-console-border-soft px-0 py-0 ${className}`}>
      <Link className="block px-3 py-[9px]" href={href}>
        {children}
      </Link>
    </td>
  );
}

export function ReservationTable({
  filters,
  reservations,
}: ReservationTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[1020px] border-collapse text-[12px]">
        <caption className="sr-only">Daftar reservasi hotel</caption>
        <thead>
          <tr>
            <th
              aria-sort={ariaSort(filters, "reservation_no")}
              className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              <SortHeader column="reservation_no" filters={filters}>
                No. Reservasi
              </SortHeader>
            </th>
            <th
              className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              Tamu
            </th>
            <th
              className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              Tipe Kamar
            </th>
            <th
              className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              Tipe Reservasi
            </th>
            <th
              aria-sort={ariaSort(filters, "arrival")}
              className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              <SortHeader column="arrival" filters={filters}>
                Arrival
              </SortHeader>
            </th>
            <th
              aria-sort={ariaSort(filters, "departure")}
              className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              <SortHeader column="departure" filters={filters}>
                Departure
              </SortHeader>
            </th>
            <th
              className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              Rate / Mlm
            </th>
            <th
              className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              Deposit
            </th>
            <th
              className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent"
              scope="col"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {reservations.length > 0 ? (
            reservations.map((reservation) => {
              const href = `/app/fo/reservations/${reservation.id}`;

              return (
                <tr
                  key={reservation.id}
                  className="odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                >
                  <LinkedCell href={href}>
                    <span className="num font-semibold text-console-ink">
                      {reservation.reservationNo}
                    </span>
                  </LinkedCell>
                  <LinkedCell href={href}>
                    <span className="font-semibold text-console-ink">
                      {reservation.guest.fullName}
                    </span>
                  </LinkedCell>
                  <LinkedCell href={href}>{reservation.roomType.name}</LinkedCell>
                  <LinkedCell href={href}>
                    {reservationTypeLabels[reservation.reservationType]}
                  </LinkedCell>
                  <LinkedCell href={href}>
                    <span className="num">
                      {dateLabel(reservation.arrivalDate)}
                    </span>
                  </LinkedCell>
                  <LinkedCell href={href}>
                    <span className="num">
                      {dateLabel(reservation.departureDate)}
                    </span>
                  </LinkedCell>
                  <LinkedCell className="text-right" href={href}>
                    <span className="num">
                      {formatIDR(reservation.rateAmount.toString())}
                    </span>
                  </LinkedCell>
                  <LinkedCell className="text-right" href={href}>
                    <span className="num">
                      {formatIDR(reservation.deposit.toString())}
                    </span>
                  </LinkedCell>
                  <LinkedCell href={href}>
                    <ReservationStatusBadge status={reservation.status} />
                  </LinkedCell>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="border-b border-console-border-soft px-3 py-3" colSpan={9}>
                <EmptyState
                  icon={CalendarX}
                  title="Tidak ada reservasi"
                  description="Tidak ada reservasi yang cocok dengan filter Anda."
                  action={
                    <Link
                      className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
                      href="/app/fo/reservations/new"
                    >
                      Tambah Reservasi
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
