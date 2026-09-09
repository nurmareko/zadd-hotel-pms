"use client";

import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { indonesianLocale } from "@/lib/format";
import type { FoReservasiView } from "@/lib/nav-preferences";
import { cn } from "@/lib/utils";

import { getDateHref } from "../date-navigation";
import {
  buildCalendarDays,
  formatCalendarMonthTitle,
  isDateInVisibleWindow,
  WEEKDAY_LABELS,
} from "./date-range-picker";
import { buildRangeLabel, getDefaultStartDate } from "./date-window";

type DateRangePickerPopoverProps = {
  view: FoReservasiView;
  visibleStartDate: Date;
  searchParams: { toString(): string };
};

export function DateRangePickerPopover({
  view,
  visibleStartDate,
  searchParams,
}: DateRangePickerPopoverProps) {
  const router = useRouter();
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(visibleStartDate);
  const calendarDays = buildCalendarDays(displayMonth);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDisplayMonth(visibleStartDate);
    }
    setOpen(nextOpen);
  }

  function selectDate(date: Date) {
    router.push(getDateHref(view, date, searchParams));
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      triggerId={open ? triggerId : null}
      onOpenChange={handleOpenChange}
    >
      <PopoverTrigger
        id={triggerId}
        type="button"
        aria-label="Pilih tanggal mulai reservasi"
        className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <CalendarDays
          className="h-4 w-4 text-slate-500"
          aria-hidden="true"
        />
        <span>{buildRangeLabel(visibleStartDate)}</span>
      </PopoverTrigger>

      <PopoverContent aria-label="Pilih tanggal mulai reservasi">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            onClick={() =>
              setDisplayMonth((month) => startOfMonth(addMonths(month, -1)))
            }
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <h2 className="text-sm font-semibold text-slate-900" aria-live="polite">
            {formatCalendarMonthTitle(displayMonth)}
          </h2>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() =>
              setDisplayMonth((month) => startOfMonth(addMonths(month, 1)))
            }
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-7" aria-hidden="true">
          {WEEKDAY_LABELS.map((weekday) => (
            <span
              key={weekday}
              className="flex h-7 w-9 items-center justify-center text-xs font-medium text-slate-500"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7" role="grid">
          {calendarDays.map((date) => {
            const isSelected = isSameDay(date, visibleStartDate);
            const isInVisibleWindow = isDateInVisibleWindow(
              date,
              visibleStartDate,
            );
            const isOutsideMonth = !isSameMonth(date, displayMonth);
            const isTodayDate = isToday(date);

            return (
              <button
                key={date.toISOString()}
                type="button"
                role="gridcell"
                aria-label={format(date, "EEEE, d MMMM yyyy", {
                  locale: indonesianLocale,
                })}
                aria-current={isTodayDate ? "date" : undefined}
                aria-selected={isSelected}
                onClick={() => selectDate(date)}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600",
                  isSelected
                    ? "bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700"
                    : isInVisibleWindow
                      ? "bg-emerald-50 font-medium text-emerald-950 hover:bg-emerald-100"
                      : isOutsideMonth
                        ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {format(date, "d")}
                {isTodayDate ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-1 h-1 w-1 rounded-full",
                      isSelected ? "bg-white" : "bg-emerald-600",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => selectDate(getDefaultStartDate())}
            className="flex h-9 w-full items-center justify-center rounded-md text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Hari ini
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
