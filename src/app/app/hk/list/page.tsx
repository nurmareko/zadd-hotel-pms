import type { RoomStatus } from "@prisma/client";
import { addDays, formatISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { StatusBadge } from "@/components/status-badge";
import {
  formatDateWithWeekday,
  formatISODate,
} from "@/lib/format";
import {
  getHousekeepingListData,
  type HousekeepingCleaningState,
  type HousekeepingListRow,
  type HousekeepingReservationContextKind,
} from "@/lib/housekeeping-list-data";

export const dynamic = "force-dynamic";

type SearchParams = {
  date?: string | string[];
};

const statusClassNames: Record<
  RoomStatus,
  { badge: string; pip: string }
> = {
  VC: {
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
  },
  OC: {
    badge: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
    pip: "bg-status-oc-pip",
  },
  VD: {
    badge: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
    pip: "bg-status-vd-pip",
  },
  OD: {
    badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
    pip: "bg-status-od-pip",
  },
  VCU: {
    badge: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
    pip: "bg-status-vcu-pip",
  },
  OOO: {
    badge: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
    pip: "bg-status-ooo-pip",
  },
};

const reservationKindClassNames: Record<
  HousekeepingReservationContextKind,
  { badge: string; pip: string }
> = {
  arrival: {
    badge: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
    pip: "bg-status-oc-pip",
  },
  departure: {
    badge: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
    pip: "bg-status-vd-pip",
  },
  stayover: {
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
  },
};

const headerCellClass =
  "bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent";
const bodyCellClass =
  "border-b border-console-border-soft px-3 py-[9px] align-top";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateParam(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, monthIndex, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function dateHref(date: Date) {
  return `/app/hk/list?date=${formatISO(date, { representation: "date" })}`;
}

function CleaningStateBadge({ state }: { state: HousekeepingCleaningState }) {
  if (state === "IN_PROGRESS") {
    return (
      <StatusBadge
        label="In progress"
        className="border-console-ink bg-console-ink text-console-accent"
        pipClassName="bg-console-accent"
        size="md"
      />
    );
  }

  const classes = statusClassNames[state];

  return (
    <StatusBadge
      label={state}
      className={classes.badge}
      pipClassName={classes.pip}
      size="md"
    />
  );
}

function ReservationContextBadges({ row }: { row: HousekeepingListRow }) {
  if (row.reservationContexts.length === 0) {
    return (
      <span className="text-[11px] italic text-slate-400">No activity</span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {row.reservationContexts.map((context) => {
        const classes = reservationKindClassNames[context.kind];

        return (
          <div
            key={`${context.kind}-${context.reservationNo}`}
            className="flex flex-wrap items-center gap-2"
          >
            <StatusBadge
              label={context.label}
              className={classes.badge}
              pipClassName={classes.pip}
            />
            <span className="font-semibold text-console-ink">
              {context.guestName}
            </span>
            <span className="num text-[11px] text-slate-500">
              {context.nightsLabel}
            </span>
            {context.etaLabel ? (
              <span className="num text-[11px] text-slate-500">
                ETA {context.etaLabel}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AssignmentCell({ row }: { row: HousekeepingListRow }) {
  if (!row.assignedHousekeeper) {
    return <span className="text-[11px] italic text-slate-400">Unassigned</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-console-border bg-console-bg text-[10px] font-bold text-console-ink">
        {row.assignedHousekeeper.initials}
      </span>
      <span className="text-[12px] font-semibold text-console-ink">
        {row.assignedHousekeeper.name}
      </span>
    </div>
  );
}

function NoteCell({ row }: { row: HousekeepingListRow }) {
  if (!row.note) {
    return <span className="text-[11px] italic text-slate-400">-</span>;
  }

  return (
    <div className="max-w-[280px] space-y-1">
      <div className="num text-[11px] font-semibold text-console-ink">
        {row.note.reservationNo}
        {row.note.etaLabel ? (
          <span className="font-medium text-slate-500">
            {" "}
            · ETA {row.note.etaLabel}
          </span>
        ) : null}
      </div>
      {row.note.housekeepingNote ? (
        <div className="text-[12px] leading-5 text-slate-600">
          {row.note.housekeepingNote}
        </div>
      ) : (
        <div className="text-[11px] italic text-slate-400">
          No HK note
        </div>
      )}
    </div>
  );
}

function AddOnsCell({ row }: { row: HousekeepingListRow }) {
  if (row.addOns.length === 0) {
    return <span className="text-[11px] italic text-slate-400">None</span>;
  }

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1.5">
      {row.addOns.map((addOn) => (
        <span
          key={`${addOn.label}-${addOn.delivered}`}
          className={[
            "inline-flex items-center border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]",
            addOn.delivered
              ? "border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
              : "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
          ].join(" ")}
        >
          {addOn.label} · {addOn.delivered ? "Delivered" : "Pending"}
        </span>
      ))}
    </div>
  );
}

function groupRowsByFloor(rows: HousekeepingListRow[]) {
  const floors = new Map<number, HousekeepingListRow[]>();

  for (const row of rows) {
    const floorRows = floors.get(row.room.floor) ?? [];
    floorRows.push(row);
    floors.set(row.room.floor, floorRows);
  }

  return [...floors.entries()].sort(
    ([firstFloor], [secondFloor]) => firstFloor - secondFloor,
  );
}

export default async function HousekeepingListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selectedDate = parseDateParam(firstParam(params.date));
  const { date, rows } = await getHousekeepingListData(selectedDate);
  const groupedRows = groupRowsByFloor(rows);

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Housekeeping List
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatDateWithWeekday(date)} · {rows.length} rooms
          </p>
        </div>

        <nav aria-label="Housekeeping list date" className="flex flex-wrap gap-2">
          <Link
            href={dateHref(addDays(date, -1))}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Prev
          </Link>
          <Link
            href="/app/hk/list"
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Today
          </Link>
          <Link
            href={dateHref(addDays(date, 1))}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </div>

      <section className="border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// "}
          {formatISODate(date)} HK room worksheet
        </div>

        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-[1180px] border-collapse text-[12px]">
            <caption className="sr-only">
              Read-only housekeeping list by room and reservation context
            </caption>
            <thead>
              <tr>
                <th className={headerCellClass} scope="col">
                  State
                </th>
                <th className={headerCellClass} scope="col">
                  Room
                </th>
                <th className={headerCellClass} scope="col">
                  Service
                </th>
                <th className={headerCellClass} scope="col">
                  Reservation
                </th>
                <th className={headerCellClass} scope="col">
                  Note
                </th>
                <th className={headerCellClass} scope="col">
                  Add-ons
                </th>
                <th className={headerCellClass} scope="col">
                  Housekeeper
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(([floor, floorRows]) => (
                <Fragment key={floor}>
                  <tr>
                    <th
                      colSpan={7}
                      scope="colgroup"
                      className="border-y border-console-border bg-[var(--slate-100)] px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-console-ink"
                    >
                      Floor {floor}
                      <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
                        · {floorRows.length} rooms
                      </span>
                    </th>
                  </tr>
                  {floorRows.map((row) => (
                    <tr
                      key={row.room.id}
                      className="odd:bg-white even:bg-console-bg hover:bg-status-vc-bg"
                    >
                      <td className={bodyCellClass}>
                        <CleaningStateBadge state={row.cleaningState} />
                      </td>
                      <td className={bodyCellClass}>
                        <div className="num text-[16px] font-bold leading-none text-console-ink">
                          {row.room.number}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {row.room.typeCode} · {row.room.typeName}
                        </div>
                        <div className="mt-1">
                          <CleaningStateBadge state={row.room.status} />
                        </div>
                      </td>
                      <td className={bodyCellClass}>
                        <span className="font-semibold text-console-ink">
                          {row.serviceLabel}
                        </span>
                      </td>
                      <td className={bodyCellClass}>
                        <ReservationContextBadges row={row} />
                      </td>
                      <td className={bodyCellClass}>
                        <NoteCell row={row} />
                      </td>
                      <td className={bodyCellClass}>
                        <AddOnsCell row={row} />
                      </td>
                      <td className={bodyCellClass}>
                        <AssignmentCell row={row} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
