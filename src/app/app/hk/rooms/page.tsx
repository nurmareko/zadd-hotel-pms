import { RoomStatus } from "@prisma/client";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Smartphone,
} from "lucide-react";
import Link from "next/link";


import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDateOnlyDays, todayDateOnly } from "@/lib/date-only";
import { formatDateWithWeekday, formatISODate } from "@/lib/format";
import { getHousekeepingForecastData } from "@/lib/housekeeping-forecast-data";
import { getHousekeepingListData } from "@/lib/housekeeping-list-data";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";


import { BulkAssignmentPanel } from "./bulk-assignment-panel";
import { InspectionInbox } from "./inspection-inbox";
import { RoomFilterForm } from "./room-filter-form";
import { RoomBoardTable, type BoardSortBy } from "./room-board-table";
import { RoomTaskNoteDialog } from "./room-task-note-dialog";

export const dynamic = "force-dynamic";

type SearchParams = {
  date?: string | string[];
  q?: string | string[];
  status?: string | string[];
  priority?: string | string[];
  sortBy?: string | string[];
  sortOrder?: string | string[];
};

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

type BoardQuery = {
  date: Date;
  q: string;
  status: string;
  priority: string;
  sortBy: BoardSortBy;
  sortOrder: "asc" | "desc";
};

function buildQuery(params: BoardQuery) {
  const query = new URLSearchParams({
    date: params.date.toISOString().slice(0, 10),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  return `?${query}`;
}

function dateHref(params: BoardQuery) {
  return `/app/hk/rooms${buildQuery(params)}`;
}

function printHref(params: BoardQuery) {
  return `/api/hk/daily-list${buildQuery(params)}`;
}

export default async function HkRoomsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = todayDateOnly().today;
  const todayIso = today.toISOString().slice(0, 10);
  const selectedDate = parseDateParam(firstParam(params.date)) ?? today;
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

  const priorityParam = firstParam(params.priority);
  const priority =
    priorityParam && Object.hasOwn(PRIORITY_CONFIG, priorityParam)
      ? (priorityParam as keyof typeof PRIORITY_CONFIG)
      : undefined;
  const sortParam = firstParam(params.sortBy);
  const sortBy: BoardSortBy =
    sortParam === "room" ||
    sortParam === "floor" ||
    sortParam === "status" ||
    sortParam === "assignee"
      ? sortParam
      : "priority";
  const sortOrder = firstParam(params.sortOrder) === "desc" ? "desc" : "asc";

  const [list, forecast, todayList, vcuRooms] = await Promise.all([
    getHousekeepingListData({
      date: selectedDate,
      q,
      status,
      priority,
      sortBy,
      sortOrder,
    }),
    getHousekeepingForecastData(selectedDate),
    getHousekeepingListData({ date: today }),
    prisma.room.findMany({
      where: { status: RoomStatus.VCU },
      include: {
        roomType: { select: { name: true } },
        cleaningSessions: {
          where: { finishedAt: { not: null } },
          orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          include: { housekeeper: { select: { fullName: true } } },
        },
        housekeepingLogs: {
          where: {
            newStatus: RoomStatus.VCU,
            oldStatus: { not: RoomStatus.VCU },
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    }),
  ]);
  const { date, rows } = list;
  const dateIso = date.toISOString().slice(0, 10);
  const { housekeepers } = forecast;
  const todayPriorities = new Map(
    todayList.rows.map((row) => [row.room.id, row.priority]),
  );
  const taskRooms = forecast.rooms.map(({ room }) => ({
    id: room.id,
    number: room.number,
    typeName: room.typeName,
    priority: todayPriorities.get(room.id) ?? null,
  }));
  const inspectionRooms = vcuRooms.map((room) => {
    const lastSession = room.cleaningSessions[0];
    const lastLog = room.housekeepingLogs[0];
    return {
      id: room.id,
      number: room.number,
      roomTypeName: room.roomType.name,
      cleanedByName: lastSession?.housekeeper.fullName ?? null,
      cleanedAt: lastSession?.finishedAt ?? null,
      href: `/app/hk/rooms/${room.id}`,
      linenChanged: lastLog?.linenChanged ?? false,
      towelChanged: lastLog?.towelChanged ?? false,
    };
  });

  const queryParams: BoardQuery = {
    date,
    q,
    status: status ?? "",
    priority: priority ?? "",
    sortBy,
    sortOrder,
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-6 text-slate-900">
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Papan Kamar
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatDateWithWeekday(date)} · {rows.length} kamar
          </p>
        </div>

        <nav
          aria-label="Navigasi papan kamar"
          className="flex flex-wrap items-center gap-2"
        >
          <RoomTaskNoteDialog
            rooms={taskRooms}
            housekeepers={housekeepers}
            todayIso={todayIso}
          />
          <a
            href={`/app/hk/rooms/export${buildQuery(queryParams)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-md",
            )}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Ekspor CSV
          </a>
          <Link
            href="/app/hk/mobile"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Mode Ponsel
          </Link>
          <Link
            href={dateHref({ ...queryParams, date: addDateOnlyDays(date, -1) })}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Sebelumnya
          </Link>
          <Link
            href={dateHref({ ...queryParams, date: todayDateOnly().today })}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Hari Ini
          </Link>
          <Link
            href={dateHref({ ...queryParams, date: addDateOnlyDays(date, 1) })}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={printHref(queryParams)}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Cetak Daftar Harian
          </Link>
        </nav>
      </div>

      <InspectionInbox rooms={inspectionRooms} />

      <Tabs defaultValue="worksheet" className="min-w-0">
        <TabsList aria-label="Tampilan papan kamar" className="max-w-full">
          <TabsTrigger value="worksheet">Lembar Kerja</TabsTrigger>
          <TabsTrigger value="assignment">Penugasan Massal</TabsTrigger>
        </TabsList>
        <TabsContent value="worksheet" className="min-w-0">
          <section className="mb-4 rounded-lg border border-border bg-card">
            <RoomFilterForm
              dateIso={dateIso}
              defaultQ={q}
              defaultStatus={status ?? ""}
              defaultPriority={priority ?? ""}
            />
          </section>

          <Card className="rounded-lg overflow-hidden p-0">
            <CardHeader className="border-b border-border rounded-none px-5 py-4">
              <CardTitle className="text-[16px] font-semibold tracking-tight">
                Lembar Kerja · {formatISODate(date)}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
              <RoomBoardTable
                rows={rows}
                dateIso={dateIso}
                query={buildQuery(queryParams)}
                sortBy={sortBy}
                sortOrder={sortOrder}
                rooms={taskRooms}
                housekeepers={housekeepers}
                todayIso={todayIso}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="assignment" className="min-w-0 space-y-4">
          <Card className="overflow-hidden rounded-lg p-0">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-base font-semibold">
                Distribusi Beban Kerja
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Jumlah kamar yang ditugaskan pada {formatISODate(date)}.
              </p>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 md:grid-cols-3">
              {housekeepers.map((housekeeper) => (
                <div
                  key={housekeeper.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
                    >
                      {housekeeper.initials}
                    </span>
                    <span className="break-words text-sm font-medium">
                      {housekeeper.name}
                    </span>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold">
                    {housekeeper.assignedCount} kamar
                  </span>
                </div>
              ))}
              {housekeepers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada petugas HK aktif.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <BulkAssignmentPanel
            key={formatISODate(date)}
            dateISO={formatISODate(date)}
            housekeepers={housekeepers}
            rooms={forecast.rooms}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
