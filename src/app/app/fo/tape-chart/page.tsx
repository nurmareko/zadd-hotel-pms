import { addDays, isValid, parseISO } from "date-fns";

import { dateOnlyBoundary } from "@/lib/date-only";
import { formatDateID, formatISODate, formatMonthDayID } from "@/lib/format";
import { getTapeChartData } from "@/lib/tape-chart-data";

import { TapeChart, type TapeChartDay } from "./tape-chart";

export const dynamic = "force-dynamic";

const DAY_COUNT = 14;
const DEFAULT_PAST_DAY_COUNT = 2;
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type FoTapeChartPageProps = {
  searchParams: Promise<{ startDate?: string | string[] }>;
};

function parseStartDate(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const defaultStartDate = getDefaultStartDate();

  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return defaultStartDate;
  }

  const parsed = parseISO(candidate);

  return isValid(parsed)
    ? dateOnlyBoundary(parsed)
    : defaultStartDate;
}

function getDefaultStartDate() {
  return addDays(dateOnlyBoundary(new Date()), -DEFAULT_PAST_DAY_COUNT);
}

function getDateHref(startDate: Date) {
  return `/app/fo/tape-chart?startDate=${formatISODate(startDate)}`;
}

function buildDays(startDate: Date): TapeChartDay[] {
  return Array.from({ length: DAY_COUNT }, (_, index) => {
    const date = addDays(startDate, index);

    return {
      iso: formatISODate(date),
      dayOfWeek: DAY_LABELS[date.getDay()],
      dayNumber: date.getDate().toString(),
      monthLabel: formatMonthDayID(date).replace(/^\d+\s*/, ""),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

export default async function FoTapeChartPage({
  searchParams,
}: FoTapeChartPageProps) {
  const { startDate } = await searchParams;
  const visibleStartDate = parseStartDate(startDate);
  const chartData = await getTapeChartData(visibleStartDate, DAY_COUNT);
  const days = buildDays(visibleStartDate);
  const previousStartDate = addDays(visibleStartDate, -DAY_COUNT);
  const nextStartDate = addDays(visibleStartDate, DAY_COUNT);
  const todayDate = dateOnlyBoundary(new Date());
  const todayStartDate = getDefaultStartDate();

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <TapeChart
        data={chartData}
        days={days}
        todayIso={formatISODate(todayDate)}
        previousHref={getDateHref(previousStartDate)}
        nextHref={getDateHref(nextStartDate)}
        todayHref={getDateHref(todayStartDate)}
        newReservationHref="/app/fo/reservations/new"
        rangeLabel={`${formatMonthDayID(visibleStartDate)} - ${formatDateID(
          addDays(visibleStartDate, DAY_COUNT - 1),
        )}`}
      />
    </main>
  );
}
