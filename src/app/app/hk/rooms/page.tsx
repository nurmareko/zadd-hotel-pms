import { addDays, formatISO } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatDateWithWeekday, formatISODate } from "@/lib/format";
import {
  getHousekeepingListData,
  type HousekeepingListRow,
} from "@/lib/housekeeping-list-data";

import { StatusPill } from "../status-pill
import { RoomFilterForm } from "./room-filter-form";
import { SupervisorRoomStatusSelect } from "./supervisor-room-status-select";

export const dynamic = "force-dynamic";

type SearchParams = {
  date?: string | string[];
  q?: string | string[];
  status?: string | string[];
};

const headerCellClass =
  "border-b border-slate-200 bg-white px-3 py-3 text-left text-[12px] font-medium text-slate-600 desktop:px-4";
const bodyCellClass =
  "border-b border-slate-100 px-3 py-3 align-top desktop:px-4 desktop:py-4";
const operationalStateClass = "text-[13px] italic text-slate-600";

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
      <span className={operationalStateClass}>
        Tidak ada aktivitas
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {row.reservationContexts.map((context) => (
        <span
          key={`${context.kind}-${context.reservationNo}`}
          className="font-semibold text-slate-900"
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
      <span className={operationalStateClass}>
        Belum ditugaskan
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">
        {row.assignedHousekeeper.initials}
      </span>
      <span className="text-[13px] font-medium text-slate-900">
        {row.assignedHousekeeper.name}
      </span>
    </div>
  );
}

function NoteCell({ row }: { row: HousekeepingListRow }) {
  if (!row.note) {
    return <span className={operationalStateClass}>-</span>;
  }

  return (
    <div className="max-w-[280px]">
      {row.note.notes ? (
        <div className="text-[12px] leading-5 text-slate-600">
          {row.note.notes}
        </div>
      ) : (
        <div className={operationalStateClass}>
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
    <main className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-6 text-slate-900">
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Worksheet Kamar
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatDateWithWeekday(date)} · {rows.length} kamar
          </p>
        </div>

        <nav aria-label="Tanggal kamar housekeeping" className="flex flex-wrap gap-2">
          <Link
            href={dateHref({ ...queryParams, date: addDays(date, -1) })}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </Link>
          <Link
            href={dateHref({ ...queryParams, date: new Date() })}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Today
          </Link>
          <Link
            href={dateHref({ ...queryParams, date: addDays(date, 1) })}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={printHref(queryParams)}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print Daily List
          </Link>
        </nav>
      </div>

      <section className="mb-4 rounded-lg border border-border bg-card">
        <RoomFilterForm
          dateIso={formatISO(date, { representation: "date" })}
          defaultQ={q}
          defaultStatus={statusParam}
        />
      </section>

      <Card className="rounded-lg overflow-hidden p-0">
        <CardHeader className="border-b border-border rounded-none px-5 py-4">
          <CardTitle className="text-[16px] font-semibold tracking-tight">
            {formatISODate(date)} Supervisor Worksheet
          </CardTitle>
        </CardHeader>
        <CardContent className="max-w-full overflow-hidden p-0 desktop:overflow-auto">
          <table className="w-full border-collapse text-[12px] desktop:min-w-[1180px]">
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
                <th
                  className={`${headerCellClass} hidden desktop:table-cell`}
                  scope="col"
                >
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(([floor, floorRows]) => (
                <Fragment key={floor}>
                  <tr>
                    <th
                      colSpan={5}
                      scope="colgroup"
                      className="border-y border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[13px] font-medium tracking-tight text-slate-900 desktop:hidden"
                    >
                      Lantai {floor}
                      <span className="ml-2 font-normal text-slate-600">
                        · {floorRows.length} kamar
                      </span>
                    </th>
                    <th
                      colSpan={6}
                      scope="colgroup"
                      className="hidden border-y border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[13px] font-medium tracking-tight text-slate-900 desktop:table-cell"
                    >
                        Lantai {floor}
                        <span className="ml-2 font-normal text-slate-600">
                          · {floorRows.length} kamar
                        </span>
                    </th>
                  </tr>
                  {floorRows.map((row) => (
                    <Fragment key={row.room.id}>
                      <tr className="odd:bg-white even:bg-slate-50 hover:bg-status-vc-bg">
                        <td className={bodyCellClass}>
                          <Link
                            href={`/app/hk/rooms/${row.room.id}`}
                            className="num text-[16px] font-bold leading-none text-slate-900 hover:underline hover:text-blue-600"
                          >
                            {row.room.number}
                          </Link>
                          <div className="mt-1 text-[11px] text-slate-600">
                            {row.room.typeName}
                          </div>
                        </td>
                        <td className={bodyCellClass}>
                          <StatusPill status={row.room.status} />
                        </td>
                        <td className={`${bodyCellClass} min-w-[190px] desktop:min-w-[220px]`}>
                          <SupervisorRoomStatusSelect
                            key={`${row.room.id}-${row.room.status}`}
                            roomId={row.room.id}
                            roomNumber={row.room.number}
                            status={row.room.status}
                          />
                        </td>
                        <td className={`${bodyCellClass} min-w-[160px] desktop:min-w-[260px]`}>
                          <ReservationGuestCell row={row} />
                        </td>
                        <td className={`${bodyCellClass} min-w-[140px] desktop:min-w-[180px]`}>
                          <AssignmentCell row={row} />
                        </td>
                        <td className={`${bodyCellClass} hidden desktop:table-cell`}>
                          <NoteCell row={row} />
                        </td>
                      </tr>
                      <tr className="bg-slate-50 desktop:hidden">
                        <td colSpan={5} className="border-b border-slate-100 px-3 py-0">
                          <details className="group">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-slate-700 marker:content-none">
                              <MessageSquareText
                                className="h-4 w-4 text-slate-600"
                                aria-hidden="true"
                              />
                              Catatan reservasi
                              <span className="ml-auto text-xs font-normal text-slate-600 group-open:hidden">
                                Tampilkan
                              </span>
                              <span className="ml-auto hidden text-xs font-normal text-slate-600 group-open:inline">
                                Sembunyikan
                              </span>
                            </summary>
                            <div className="border-t border-slate-200 py-3">
                              <NoteCell row={row} />
                            </div>
                          </details>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
