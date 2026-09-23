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

function dateLabel(value: string) {
  return formatCompactDateID(new Date(`${value}T00:00:00.000Z`));
}

function money(value: number) {
  return formatIDR(value);
}

function metricSubline(day: ManagerFlashDay) {
  return `Kamar ${money(day.roomRevenue)} · F&B ${money(day.fbRevenue)} · Lain ${money(day.otherRevenue)}`;
}

const bookingSourceLabels: Record<BookingSourceContribution["source"], string> = {
  INDIVIDUAL: "Individual",
  COMPANY: "Perusahaan",
  GOVERNMENT: "Pemerintah",
  OTA: "Online Travel Agent",
  WALK_IN: "Walk-in",
  UNKNOWN: "Lainnya",
};

function BookingSourceRows({ rows }: { rows: BookingSourceContribution[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada pendapatan berdasarkan sumber pemesanan.
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
              {row.reservationCount} reservasi · {row.roomNights} room night
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
            Ringkasan kinerja hotel untuk {dateLabel(report.selectedDate)}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end print:hidden">
          <Link className={buttonVariants({ variant: "outline" })} href="/app/acc/night-audit">
            Night Audit
          </Link>
          <form className="grid gap-1.5" method="get">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="manager-flash-date">
              Tanggal bisnis
            </label>
            <input
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              defaultValue={report.selectedDate}
              id="manager-flash-date"
              name="date"
              type="date"
            />
          </form>
          <ManagerFlashActions />
        </div>
      </div>

      <section aria-label="Metrik kinerja" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          className="border-blue-100 bg-blue-50/50 [&_div:first-child]:text-blue-600 [&_div:nth-child(2)]:text-blue-900"
          label="OKUPANSI"
          sub={`${day.roomsOccupied} dari ${day.totalRooms} kamar`}
          value={formatFixedPercent(day.occupancyRate, 1)}
        />
        <KpiCard
          className="border-indigo-100 bg-indigo-50/50 [&_div:first-child]:text-indigo-600 [&_div:nth-child(2)]:text-indigo-900"
          label="ARR / ADR"
          sub={`${day.soldRoomNights} sold room night`}
          value={money(day.adr)}
        />
        <KpiCard
          className="border-violet-100 bg-violet-50/50 [&_div:first-child]:text-violet-600 [&_div:nth-child(2)]:text-violet-900"
          label="REVPAR"
          sub={`${money(day.roomRevenue)} / ${day.totalRooms} kamar`}
          value={money(day.revPar)}
        />
        <KpiCard
          className="border-orange-100 bg-orange-50/50 [&_div:first-child]:text-orange-600 [&_div:nth-child(2)]:text-orange-900"
          label="REVPAX"
          sub={`${day.inHouseCount} tamu menginap`}
          value={money(day.revPax)}
        />
        <KpiCard
          className="border-emerald-100 bg-emerald-50/50 [&_div:first-child]:text-emerald-600 [&_div:nth-child(2)]:text-emerald-900"
          label="PENDAPATAN HARI INI"
          sub={metricSubline(day)}
          value={money(day.totalRevenue)}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-lg border border-border p-0">
          <CardHeader className="rounded-none border-b border-border bg-card px-5 py-4">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              Pendapatan Harian
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            {[
              ["Pendapatan Kamar", day.roomRevenue],
              ["Pendapatan F&B", day.fbRevenue],
              ["Pendapatan Lain", day.otherRevenue],
              ["Total Pendapatan", day.totalRevenue],
            ].map(([label, value], index) => (
              <div
                className={`flex items-center justify-between gap-3 ${
                  index === 3 ? "border-t border-border pt-3 font-bold" : ""
                }`}
                key={label}
              >
                <span className={index === 3 ? "text-foreground" : "text-muted-foreground"}>
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
              Sumber Pemesanan
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
              14 Hari Terakhir
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Sampai {dateLabel(report.selectedDate)} · ARR/ADR dihitung dari room night aktual setiap tanggal.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr>
                    {['Tanggal', 'Okupansi %', 'ARR / ADR', 'RevPAR', 'Pendapatan'].map((heading) => (
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
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">Pergerakan</CardTitle>
            <p className="text-xs text-muted-foreground">{dateLabel(report.selectedDate)}</p>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            {[
              ['Check-in', day.checkInCount],
              ['Check-out', day.checkOutCount],
              ['Tamu Menginap', day.inHouseCount],
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