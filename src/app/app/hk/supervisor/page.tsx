import { RoomStatus } from "@prisma/client";
import { addDays, formatISO } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { formatDateWithWeekday, formatISODate } from "@/lib/format";
import { getHousekeepingForecastData } from "@/lib/housekeeping-forecast-data";
import { prisma } from "@/lib/prisma";

import { BulkAssignmentPanel } from "./bulk-assignment-panel";
import { InspectionInbox, type InspectionInboxRow } from "./inspection-inbox";
import { RecentActivityFeed } from "./recent-activity-feed";

export const dynamic = "force-dynamic";

type SearchParams = {
  date?: string | string[];
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

function dateHref(date: Date) {
  return `/app/hk/supervisor?date=${formatISO(date, {
    representation: "date",
  })}`;
}

function printHref(date: Date) {
  return `/api/hk/daily-list?date=${formatISO(date, {
    representation: "date",
  })}`;
}

function ForecastCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <section className="border border-console-border bg-console-surface p-3.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.10em] text-slate-600">
        [ {label} ]
      </div>
      <div className="num mt-2 text-[22px] font-bold leading-tight text-console-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </section>
  );
}

export default async function HkSupervisorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !isHkSupervisor(session))
  ) {
    redirect("/app/forbidden");
  }

  const params = await searchParams;
  const selectedDate = parseDateParam(firstParam(params.date));
  const [forecast, cleaningNowCount, readyCount, vcuRooms, recentLogs] = await Promise.all([
    getHousekeepingForecastData(selectedDate),
    prisma.cleaningSession.count({
      where: { startedAt: { not: null }, finishedAt: null },
    }),
    prisma.room.count({ where: { status: RoomStatus.VC } }),
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
          where: { newStatus: RoomStatus.VCU },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    }),
    prisma.housekeepingLog.findMany({
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: {
        updatedBy: { select: { fullName: true } },
        room: { select: { number: true } },
      },
    }),
  ]);
  const { date, summary, housekeepers, rooms } = forecast;
  const dateISO = formatISODate(date);

  const inspectionRooms: InspectionInboxRow[] = vcuRooms.map((room) => {
    const lastSession = room.cleaningSessions[0] ?? null;
    const lastLog = room.housekeepingLogs[0] ?? null;

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

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Dashboard Supervisor
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatDateWithWeekday(date)} · refresh setelah aksi
          </p>
        </div>

        <nav
          aria-label="Tanggal supervisor housekeeping"
          className="flex flex-wrap gap-2"
        >
          <Link
            href={dateHref(addDays(date, -1))}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Sebelumnya
          </Link>
          <Link
            href="/app/hk/supervisor"
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Hari Ini
          </Link>
          <Link
            href={dateHref(addDays(date, 1))}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Berikutnya
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            href={printHref(date)}
            target="_blank"
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Cetak Daily List
          </Link>
        </nav>
      </div>

      <section className="mb-4">
        <div className="mb-2 border border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          Status Live
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ForecastCard
            label="Pembersihan berjalan"
            value={cleaningNowCount}
            sub="sesi berjalan"
          />
          <ForecastCard
            label="Menunggu inspeksi"
            value={inspectionRooms.length}
            sub="kamar VCU"
          />
          <ForecastCard
            label="Siap"
            value={readyCount}
            sub="VC - Vacant Clean"
          />
        </div>
      </section>

      <InspectionInbox rooms={inspectionRooms} />

      <RecentActivityFeed logs={recentLogs} />

      <section className="mb-4">
        <div className="mb-2 border border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {dateISO} forecast beban kerja
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <ForecastCard
            label="Turnover"
            value={summary.turnovers}
            sub="departure hari ini"
          />
          <ForecastCard
            label="Freshen-up"
            value={summary.freshenUps}
            sub="stayover in-house"
          />
          <ForecastCard
            label="Arrival"
            value={summary.arrivalsToPrep}
            sub="prep dialokasikan"
          />
          <ForecastCard
            label="Dirty"
            value={summary.dirtyNow}
            sub="VD / OD saat ini"
          />
          <ForecastCard
            label="Perlu perhatian"
            value={summary.totalNeedingAttention}
            sub="kamar unik"
          />
          <ForecastCard
            label="Cakupan"
            value={`${summary.assignedNeedingAttention}/${summary.totalNeedingAttention}`}
            sub={`${summary.unassignedNeedingAttention} belum ditugaskan`}
          />
        </div>
      </section>

      <section className="mb-4 border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          Beban housekeeper
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-3">
          {housekeepers.map((housekeeper) => (
            <div
              key={housekeeper.id}
              className="flex items-center justify-between gap-3 border border-console-border bg-console-bg px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-console-border bg-console-surface text-[10px] font-bold text-console-ink">
                  {housekeeper.initials}
                </span>
                <span className="truncate text-[12px] font-semibold text-console-ink">
                  {housekeeper.name}
                </span>
              </div>
              <span className="num shrink-0 text-[16px] font-bold text-console-ink">
                {housekeeper.assignedCount}
              </span>
            </div>
          ))}
          {housekeepers.length === 0 ? (
            <div className="border border-console-border bg-console-bg px-3 py-2 text-[12px] text-slate-500">
              Tidak ada member HK aktif.
            </div>
          ) : null}
        </div>
      </section>

      <BulkAssignmentPanel
        dateISO={dateISO}
        housekeepers={housekeepers}
        rooms={rooms}
      />
    </main>
  );
}
