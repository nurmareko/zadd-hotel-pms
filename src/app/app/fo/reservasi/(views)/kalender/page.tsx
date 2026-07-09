import { addDays } from "date-fns";

import { hotelTodayISO } from "@/lib/date-only";
import { formatISODate, formatMonthDayID } from "@/lib/format";
import { getTapeChartData } from "@/lib/tape-chart-data";

import { DAY_COUNT, parseStartDate } from "./date-window";
import { TapeChart, type TapeChartDay } from "./tape-chart";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type FoTapeChartPageProps = {
  searchParams: Promise<{ startDate?: string | string[] }>;
};

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
  const todayIso = hotelTodayISO();

  return (
    <div className="animate-in fade-in duration-300">
      <TapeChart data={chartData} days={days} todayIso={todayIso} />
    </div>
  );
}
