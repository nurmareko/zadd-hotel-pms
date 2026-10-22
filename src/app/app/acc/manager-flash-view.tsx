import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactDateID, formatFixedPercent, formatIDR } from "@/lib/format";
import type {
  BookingSourceContribution,
  ManagerFlashDay,
} from "@/lib/manager-flash";
import Link from "next/link";

import { KpiCard } from "./kpi-card";
import { ManagerFlashActions } from "./manager-flash-actions";
import { ManagerFlashDatePicker } from "./manager-flash-date-picker";

function dateLabel(value: string) {
  return formatCompactDateID(new Date(`${value}T00:00:00.000Z`));
}

function money(value: number) {
  return formatIDR(value);
}

function metricSubline(day: ManagerFlashDay) {
  return `Room ${money(day.roomRevenue)} · F&B ${money(day.fbRevenue)} · HK ${money(day.hkRevenue)} · Other ${money(day.miscRevenue)}`;
}

const bookingSourceLabels: Record<BookingSourceContribution["source"], string> = {
  INDIVIDUAL: "Individual",
  COMPANY: "Corporate",
  GOVERNMENT: "Government",
  OTA: "Online Travel Agent",
  WALK_IN: "Walk-in",
  UNKNOWN: "Other",
};

function BookingSourceRows({ rows }: { rows: BookingSourceContribution[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No revenue by booking source yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {rows.map((row) => (
        <div className="flex items-start justify-between gap-3" key={row.source}>
          <div>
            <p className="font-medium text-foreground">{bookingSourceLabels[row.source]}</p>
            <p className="text-xs text-muted-foreground">
              {row.reservationCount} reservations · {row.roomNights} room nights
            </p>
          </div>
          <span className="whitespace-nowrap font-semibold text-foreground">
            {money(row.revenue)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ManagerFlashView({
  report,
}: {
  report: { selectedDate: string; selected: ManagerFlashDay; history: ManagerFlashDay[] };
}) {
  const day = report.selected;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between print:mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Accounting
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Night Report
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Hotel performance summary for {dateLabel(report.selectedDate)}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end print:hidden">
          <Link className={buttonVariants({ variant: "outline" })} href="/app/acc/night-audit">
            Night Audit
          </Link>
          <ManagerFlashDatePicker selectedDate={report.selectedDate} />
          <ManagerFlashActions />
        </div>
      </div>

      <section aria-label="Performance metrics" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          className="border-slate-200 bg-slate-50 [&_div:first-child]:text-slate-600 [&_div:nth-child(2)]:text-slate-900"
          label="OCCUPANCY"
          sub={`${day.roomsOccupied} of ${day.totalRooms} rooms`}
          value={formatFixedPercent(day.occupancyRate, 1)}
        />
        <KpiCard
          className="border-amber-100 bg-amber-50/50 [&_div:first-child]:text-amber-600 [&_div:nth-child(2)]:text-amber-900"
          label="ARR / ADR"
          sub={`${day.soldRoomNights} room nights sold`}
          value={money(day.adr)}
        />
        <KpiCard
          className="border-violet-100 bg-violet-50/50 [&_div:first-child]:text-violet-600 [&_div:nth-child(2)]:text-violet-900"
          label="REVPAR"
          sub={`${money(day.roomRevenue)} / ${day.totalRooms} rooms`}
          value={money(day.revPar)}
        />
        <KpiCard
          className="border-orange-100 bg-orange-50/50 [&_div:first-child]:text-orange-600 [&_div:nth-child(2)]:text-orange-900"
          label="REVPAX"
          sub={`${day.inHouseCount} in-house guests`}
          value={money(day.revPax)}
        />
        <KpiCard
          className="border-emerald-100 bg-emerald-50/50 [&_div:first-child]:text-emerald-600 [&_div:nth-child(2)]:text-emerald-900"
          label="DAILY REVENUE"
          sub={metricSubline(day)}
          value={money(day.totalRevenue)}
        />
      </section>

      <div className="mt-3 text-sm">
        <p className="font-medium text-foreground">
          Rate Discounts {money(day.rateDiscountsTotal)} ({day.rateOverrideCount} overrides)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stay discounts logged on the reservation creation day; not posted revenue.
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-lg border border-border p-0">
          <CardHeader className="rounded-none border-b border-border bg-card px-5 py-4">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Daily Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            {[
              ["Room Revenue", day.roomRevenue],
              ["F&B Revenue", day.fbRevenue],
              ["Housekeeping Revenue", day.hkRevenue],
              ["Spa & Other Revenue", day.miscRevenue],
              ["Total Revenue", day.totalRevenue],
            ].map(([label, value], index) => (
              <div
                className={`flex items-center justify-between gap-3 ${
                  index === 4 ? "border-t border-border pt-3 font-bold" : ""
                }`}
                key={label}
              >
                <span className={index === 4 ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
                <span className="whitespace-nowrap text-foreground">{money(Number(value))}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border p-0">
          <CardHeader className="rounded-none border-b border-border bg-card px-5 py-4">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Booking Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <BookingSourceRows rows={day.bookingSources} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0 overflow-hidden rounded-lg border border-border p-0">
          <CardHeader className="rounded-none border-b border-border bg-card px-5 py-4">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Last 14 Days
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Through {dateLabel(report.selectedDate)} · ARR/ADR is calculated from actual room nights for each date.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr>
                    {['Date', 'Occupancy %', 'ARR / ADR', 'RevPAR', 'Total Revenue'].map((heading) => (
                      <th key={heading} className="border-b border-border bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.history.map((historyDay) => (
                    <tr className="border-b border-border/60 odd:bg-white even:bg-slate-50/60" key={historyDay.date}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{dateLabel(historyDay.date)}</td>
                      <td className="px-4 py-3">{formatFixedPercent(historyDay.occupancyRate, 1)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{money(historyDay.adr)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{money(historyDay.revPar)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{money(historyDay.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit rounded-lg border border-border p-0">
          <CardHeader className="rounded-none border-b border-border bg-card px-5 py-4">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">Guest Movements</CardTitle>
            <p className="text-xs text-muted-foreground">{dateLabel(report.selectedDate)}</p>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            {[
              ['Check-in', day.checkInCount],
              ['Check-out', day.checkOutCount],
              ['In-house Guests', day.inHouseCount],
              ['No-show', day.noShowCount],
            ].map(([label, value]) => (
              <div className="flex items-center justify-between gap-3" key={label}>
                <span className="text-muted-foreground">{label}</span>
                <span className="num font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}