"use client";

import { addDays } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  useRouter,
  useSearchParams,
  useSelectedLayoutSegment,
} from "next/navigation";
import { useEffect, useOptimistic, useTransition } from "react";

import {
  FO_RESERVASI_VIEW_COOKIE,
  FO_RESERVASI_VIEW_PATHS,
  type FoReservasiView,
} from "@/lib/nav-preferences";

import {
  buildRangeLabel,
  DAY_COUNT,
  getDateHref,
  getDefaultStartDate,
  parseStartDate,
} from "./kalender/date-window";

const views: Array<{
  value: FoReservasiView;
  label: string;
  title: string;
  icon: typeof CalendarDays;
}> = [
  { value: "kalender", label: "Kalender", title: "Kalender", icon: CalendarDays },
  { value: "list", label: "List", title: "Daftar Reservasi", icon: List },
];

function rememberView(view: FoReservasiView) {
  document.cookie = [
    `${FO_RESERVASI_VIEW_COOKIE}=${view}`,
    "path=/app/fo/reservasi",
    `max-age=${60 * 60 * 24 * 365}`,
    "samesite=lax",
  ].join("; ");
}

function DateNavButton({
  href,
  label,
  direction,
}: {
  href: string;
  label: string;
  direction: "previous" | "next";
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function KalenderDateNav() {
  const searchParams = useSearchParams();
  const visibleStartDate = parseStartDate(searchParams.get("startDate"));

  return (
    <div className="flex flex-wrap items-center gap-3 lg:justify-center">
      <div className="flex items-center gap-1">
        <DateNavButton
          href={getDateHref(addDays(visibleStartDate, -DAY_COUNT))}
          label="Tanggal sebelumnya"
          direction="previous"
        />
        <div className="flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm">
          <span>{buildRangeLabel(visibleStartDate)}</span>
        </div>
        <DateNavButton
          href={getDateHref(addDays(visibleStartDate, DAY_COUNT))}
          label="Tanggal berikutnya"
          direction="next"
        />
      </div>
      <Link
        href={getDateHref(getDefaultStartDate())}
        className="flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
      >
        Today
      </Link>
    </div>
  );
}

export function ReservationsViewHeader() {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const currentView: FoReservasiView = segment === "list" ? "list" : "kalender";
  // Optimistic view drives the toggle pill and title so they respond on click,
  // before the target page finishes rendering.
  const [view, setOptimisticView] = useOptimistic(currentView);
  const [, startTransition] = useTransition();

  useEffect(() => {
    for (const { value } of views) {
      router.prefetch(FO_RESERVASI_VIEW_PATHS[value]);
    }
  }, [router]);

  function selectView(next: FoReservasiView) {
    if (next === view) {
      return;
    }

    rememberView(next);
    startTransition(() => {
      setOptimisticView(next);
      router.push(FO_RESERVASI_VIEW_PATHS[next]);
    });
  }

  const activeTitle =
    views.find((candidate) => candidate.value === view)?.title ?? "Kalender";

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
      <h1
        key={view}
        className="animate-in fade-in text-2xl font-bold tracking-tight text-slate-900 duration-300"
      >
        {activeTitle}
      </h1>

      {view === "kalender" ? <KalenderDateNav /> : <div aria-hidden="true" />}

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <div
          aria-label="Tampilan reservasi"
          role="group"
          className="relative grid grid-cols-2 rounded-md border border-slate-300 bg-white p-1 shadow-sm"
        >
          <span
            aria-hidden="true"
            className={[
              "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded bg-emerald-600 shadow-sm",
              "transition-transform duration-200 ease-out motion-reduce:transition-none",
              view === "list" ? "translate-x-full" : "translate-x-0",
            ].join(" ")}
          />
          {views.map(({ value, label, icon: Icon }) => {
            const isActive = value === view;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => selectView(value)}
                className={[
                  "relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <Link
          href={`/app/fo/reservasi/new?from=${view}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Reservasi
        </Link>
      </div>
    </div>
  );
}
