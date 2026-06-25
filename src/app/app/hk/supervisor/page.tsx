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

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

type ForecastVariant = "default" | "blue" | "emerald" | "amber" | "violet" | "rose" | "orange";

const forecastVariantStyles: Record<ForecastVariant, { card: string; label: string; value: string; sub: string }> = {
  default: { card: "bg-card border-border", label: "text-muted-foreground", value: "text-foreground", sub: "text-muted-foreground" },
  blue: { card: "bg-blue-50/50 border-blue-200", label: "text-blue-600", value: "text-blue-950", sub: "text-blue-600" },
  emerald: { card: "bg-emerald-50/50 border-emerald-200", label: "text-emerald-600", value: "text-emerald-950", sub: "text-emerald-600" },
  amber: { card: "bg-amber-50/50 border-amber-200", label: "text-amber-600", value: "text-amber-950", sub: "text-amber-600" },
  violet: { card: "bg-violet-50/50 border-violet-200", label: "text-violet-600", value: "text-violet-950", sub: "text-violet-600" },
  rose: { card: "bg-rose-50/50 border-rose-200", label: "text-rose-600", value: "text-rose-950", sub: "text-rose-600" },
  orange: { card: "bg-orange-50/50 border-orange-200", label: "text-orange-600", value: "text-orange-950", sub: "text-orange-600" },
};

function ForecastCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: number | string;
  sub: string;
  variant?: ForecastVariant;
}) {
  const styles = forecastVariantStyles[variant];
  return (
    <Card className={cn("rounded-lg p-5 gap-2 transition-colors", styles.card)}>
      <div className={cn("text-xs font-semibold tracking-tight uppercase", styles.label)}>
        {label}
      </div>
      <div className={cn("num text-3xl font-bold leading-none mt-1.5 mb-1", styles.value)}>
        {value}
      </div>
      <div className={cn("text-xs font-medium", styles.sub)}>{sub}</div>
    </Card>
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 md:py-6 text-foreground">
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Supervisor Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatDateWithWeekday(date)}
          </p>
        </div>

        <nav
          aria-label="Tanggal supervisor housekeeping"
          className="flex flex-wrap gap-2"
        >
          <Link
            href={dateHref(addDays(date, -1))}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </Link>
          <Link
            href="/app/hk/supervisor"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-md")}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Today
          </Link>
          <Link
            href={dateHref(addDays(date, 1))}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={printHref(date)}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-md")}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print Daily List
          </Link>
        </nav>
      </div>

      <section className="mb-8">
        <h3 className="mb-3 text-xl font-semibold tracking-tight text-foreground">
          Live Status
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <ForecastCard
            label="Pembersihan berjalan"
            value={cleaningNowCount}
            sub="sesi berjalan"
            variant="blue"
          />
          <ForecastCard
            label="Menunggu inspeksi"
            value={inspectionRooms.length}
            sub="kamar VCU"
            variant="amber"
          />
          <ForecastCard
            label="Siap"
            value={readyCount}
            sub="VC - Vacant Clean"
            variant="emerald"
          />
        </div>
      </section>

      <InspectionInbox rooms={inspectionRooms} />

      <RecentActivityFeed logs={recentLogs} />

      <section className="mb-8">
        <h3 className="mb-3 text-xl font-semibold tracking-tight text-foreground">
          Workload Forecast
        </h3>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <ForecastCard
            label="Turnover"
            value={summary.turnovers}
            sub="departure hari ini"
            variant="violet"
          />
          <ForecastCard
            label="Freshen-up"
            value={summary.freshenUps}
            sub="stayover in-house"
            variant="blue"
          />
          <ForecastCard
            label="Arrival"
            value={summary.arrivalsToPrep}
            sub="prep dialokasikan"
            variant="rose"
          />
          <ForecastCard
            label="Dirty"
            value={summary.dirtyNow}
            sub="VD / OD saat ini"
            variant="orange"
          />
          <ForecastCard
            label="Perlu perhatian"
            value={summary.totalNeedingAttention}
            sub="kamar unik"
            variant="rose"
          />
          <ForecastCard
            label="Cakupan"
            value={`${summary.assignedNeedingAttention}/${summary.totalNeedingAttention}`}
            sub={`${summary.unassignedNeedingAttention} belum ditugaskan`}
            variant="emerald"
          />
        </div>
      </section>

      <Card className="mb-8 rounded-lg overflow-hidden p-0">
        <CardHeader className="border-b border-border rounded-none px-5 py-4">
          <CardTitle className="text-base font-semibold tracking-tight">
            Housekeeper Workload
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 p-4 md:grid-cols-3">
          {housekeepers.map((housekeeper) => (
            <Card
              key={housekeeper.id}
              className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  {housekeeper.initials}
                </span>
                <span className="truncate text-sm font-medium text-foreground">
                  {housekeeper.name}
                </span>
              </div>
              <span className="num shrink-0 text-lg font-semibold text-foreground">
                {housekeeper.assignedCount}
              </span>
            </Card>
          ))}
          {housekeepers.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Tidak ada member HK aktif.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <BulkAssignmentPanel
        dateISO={dateISO}
        housekeepers={housekeepers}
        rooms={rooms}
      />
    </main>
  );
}
