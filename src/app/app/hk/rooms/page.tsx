import { addDays, formatISO } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import { Search } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { formatDateWithWeekday, formatISODate } from "@/lib/format";
import {
  getHousekeepingListData,
  type HousekeepingListRow,
} from "@/lib/housekeeping-list-data";

import { StatusPill } from "../room-status-grid";
import { RoomFilterForm } from "./room-filter-form";
import { SupervisorRoomStatusSelect } from "./supervisor-room-status-select";

export const dynamic = "force-dynamic";

type SearchParams = {
  date?: string | string[];
  q?: string | string[];
  status?: string | string[];
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

function buildQuery(params: {
  date: Date;
  q: string;
  status: string;
}) {
  const p = new URLSearchParams();
  p.set("date", formatISO(params.date, { representation: "date" }));
  if (params.q) p.set("q", params.q);
  if (params.status) p.set("status", params.status);
  return `?${p.toString()}`;
}

function dateHref(params: { date: Date; q: string; status: string }) {
  return `/app/hk/rooms${buildQuery(params)}`;
}

function printHref(params: { date: Date; q: string; status: string }) {
  return `/api/hk/daily-list${buildQuery(params)}`;
}

function ReservationGuestCell({ row }: { row: HousekeepingListRow }) {
  if (row.reservationContexts.length === 0) {
    return (
      <span className="text-[11px] italic text-slate-400">
        Tidak ada aktivitas
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {row.reservationContexts.map((context) => (
        <span
          key={`${context.kind}-${context.reservationNo}`}
          className="font-semibold text-console-ink"
        >
          {context.guestName}
        </span>
      ))}
    </div>
  );
}

function AssignmentCell({ row }: { row: HousekeepingListRow }) {
  if (!row.assignedHousekeeper) {
    return (
      <span className="text-[11px] italic text-slate-400">
        Belum ditugaskan
      </span>
    );
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
    <div className="max-w-[280px]">
      {row.note.notes ? (
        <div className="text-[12px] leading-5 text-slate-600">
          {row.note.notes}
        </div>
      ) : (
        <div className="text-[11px] italic text-slate-400">
          Tidak ada catatan reservasi
        </div>
      )}
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

export default async function HkRoomsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selectedDate = parseDateParam(firstParam(params.date));
  const q = firstParam(params.q)?.trim() ?? "";
  const statusParam = firstParam(params.status)?.trim() ?? "";
  const status =
    statusParam === "VC" ||
    statusParam === "OC" ||
    statusParam === "VD" ||
    statusParam === "OD" ||
    statusParam === "VCU" ||
    statusParam === "OOO"
      ? statusParam
      : undefined;

  const { date, rows } = await getHousekeepingListData(selectedDate, q, status);
  const groupedRows = groupRowsByFloor(rows);

  const queryParams = { date, q, status: statusParam };

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Kamar
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatDateWithWeekday(date)} · {rows.length} kamar
          </p>
        </div>

        <nav aria-label="Tanggal kamar housekeeping" className="flex flex-wrap gap-2">
          <Link
            href={dateHref({ ...queryParams, date: addDays(date, -1) })}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Sebelumnya
          </Link>
          <Link
            href={dateHref({ ...queryParams, date: new Date() })}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Hari Ini
          </Link>
          <Link
            href={dateHref({ ...queryParams, date: addDays(date, 1) })}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Berikutnya
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            href={printHref(queryParams)}
            target="_blank"
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Cetak Daily List
          </Link>
        </nav>
      </div>

      <section className="mb-4 border border-console-border bg-console-surface">
        <RoomFilterForm
          dateIso={formatISO(date, { representation: "date" })}
          defaultQ={q}
          defaultStatus={statusParam}
        />
      </section>

      <section className="border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {formatISODate(date)} worksheet kamar supervisor
        </div>

        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-[1180px] border-collapse text-[12px]">
            <caption className="sr-only">
              Worksheet kamar housekeeping supervisor berisi status kamar,
              kontrol ubah status, konteks reservasi bertanggal, catatan, dan
              penugasan housekeeper
            </caption>
            <thead>
              <tr>
                <th className={headerCellClass} scope="col">
                  Kamar
                </th>
                <th className={headerCellClass} scope="col">
                  Status
                </th>
                <th className={headerCellClass} scope="col">
                  Ubah Status
                </th>
                <th className={headerCellClass} scope="col">
                  Reservasi
                </th>
                <th className={headerCellClass} scope="col">
                  Housekeeper
                </th>
                <th className={headerCellClass} scope="col">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(([floor, floorRows]) => (
                <Fragment key={floor}>
                  <tr>
                    <th
                      colSpan={6}
                      scope="colgroup"
                      className="border-y border-console-border bg-[var(--slate-100)] px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-console-ink"
                    >
                      Lantai {floor}
                      <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
                        · {floorRows.length} kamar
                      </span>
                    </th>
                  </tr>
                  {floorRows.map((row) => (
                    <tr
                      key={row.room.id}
                      className="odd:bg-white even:bg-console-bg hover:bg-status-vc-bg"
                    >
                      <td className={bodyCellClass}>
                        <Link
                          href={`/app/hk/rooms/${row.room.id}`}
                          className="num text-[16px] font-bold leading-none text-console-ink hover:underline hover:text-console-accent"
                        >
                          {row.room.number}
                        </Link>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {row.room.typeName}
                        </div>
                      </td>
                      <td className={bodyCellClass}>
                        <StatusPill status={row.room.status} />
                      </td>
                      <td className={`${bodyCellClass} min-w-[220px]`}>
                        <SupervisorRoomStatusSelect
                          key={`${row.room.id}-${row.room.status}`}
                          roomId={row.room.id}
                          roomNumber={row.room.number}
                          status={row.room.status}
                        />
                      </td>
                      <td className={`${bodyCellClass} min-w-[260px]`}>
                        <ReservationGuestCell row={row} />
                      </td>
                      <td className={`${bodyCellClass} min-w-[180px]`}>
                        <AssignmentCell row={row} />
                      </td>
                      <td className={bodyCellClass}>
                        <NoteCell row={row} />
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
