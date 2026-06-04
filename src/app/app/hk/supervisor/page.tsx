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

import { BulkAssignmentPanel } from "./bulk-assignment-panel";

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
  const forecast = await getHousekeepingForecastData(selectedDate);
  const { date, summary, housekeepers, rooms } = forecast;
  const dateISO = formatISODate(date);

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Supervisor dashboard
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatDateWithWeekday(date)} · revalidate on action
          </p>
        </div>

        <nav
          aria-label="Housekeeping supervisor date"
          className="flex flex-wrap gap-2"
        >
          <Link
            href={dateHref(addDays(date, -1))}
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Prev
          </Link>
          <Link
            href="/app/hk/supervisor"
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
          <Link
            href={printHref(date)}
            target="_blank"
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print daily list
          </Link>
        </nav>
      </div>

      <section className="mb-4">
        <div className="mb-2 border border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// "}
          {dateISO} workload forecast
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <ForecastCard
            label="Turnovers"
            value={summary.turnovers}
            sub="departures today"
          />
          <ForecastCard
            label="Freshen-ups"
            value={summary.freshenUps}
            sub="in-house stayovers"
          />
          <ForecastCard
            label="Arrivals"
            value={summary.arrivalsToPrep}
            sub="allocated prep"
          />
          <ForecastCard
            label="Dirty"
            value={summary.dirtyNow}
            sub="VD / OD now"
          />
          <ForecastCard
            label="Need attention"
            value={summary.totalNeedingAttention}
            sub="deduped rooms"
          />
          <ForecastCard
            label="Coverage"
            value={`${summary.assignedNeedingAttention}/${summary.totalNeedingAttention}`}
            sub={`${summary.unassignedNeedingAttention} unassigned`}
          />
        </div>
      </section>

      <section className="mb-4 border border-console-border bg-console-surface">
        <div className="border-b border-console-border bg-console-ink px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// "}Housekeeper load
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
              No active HK members available.
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
