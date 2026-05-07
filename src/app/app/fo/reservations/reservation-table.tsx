import type { ReservationStatus } from "@prisma/client";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";

import { formatIDR } from "@/lib/format";

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

function dateLabel(date: Date) {
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
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
    <span
      className={`inline-flex h-5 items-center gap-1.5 border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${classes.badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 ${classes.pip}`} />
      {classes.label}
    </span>
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
      <table className="w-full min-w-[920px] border-collapse text-[12px]">
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
              <td
                className="border-b border-console-border-soft px-3 py-10 text-center text-[12px] text-slate-500"
                colSpan={8}
              >
                Tidak ada reservasi yang cocok dengan filter Anda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
