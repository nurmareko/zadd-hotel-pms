import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { auth } from "@/auth";
import { addDateOnlyDays, hotelTodayISO, parseISODateOnly } from "@/lib/date-only";
import { can } from "@/lib/permissions";
import { getRateVarianceReport, getRevenueReport, resolveRevenueReportRange } from "@/lib/revenue-reports";
import { ReportBreakdown, ReportDaily, ReportRateVariance, ReportSummary, reportDate } from "./report-content";

export const dynamic = "force-dynamic";

export default async function RevenueReportsPage({ searchParams }: {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "revenue:read")) redirect("/app/forbidden");

  const params = await searchParams;
  const today = hotelTodayISO();
  const range = resolveRevenueReportRange({
    from: Array.isArray(params.from) ? "" : params.from,
    to: Array.isArray(params.to) ? "" : params.to,
  }, today);
  const [report, varianceData] = await Promise.all([
    getRevenueReport(range),
    getRateVarianceReport(range),
  ]);
  const daysAgo = (days: number) => addDateOnlyDays(parseISODateOnly(today), -days).toISOString().slice(0, 10);
  const presets = [
    { label: "This Month", from: `${today.slice(0, 7)}-01` },
    { label: "Last 30 Days", from: daysAgo(29) },
    { label: "Last 7 Days", from: daysAgo(6) },
    { label: "Today", from: today },
  ];

  return (
    <main className="min-w-0 space-y-4 bg-slate-50 p-4 text-slate-900 sm:p-5 md:space-y-6 lg:p-6">
      <header>
        <div className="flex items-center gap-3">
          <BarChart3 aria-hidden="true" className="size-7 shrink-0 text-blue-600" />
          <h1 className="text-2xl font-bold md:text-3xl">Revenue Report</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">Hotel performance summary · {reportDate(report.from)} – {reportDate(report.to)}</p>
      </header>

      <section aria-label="Filter report period" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <form key={`${report.from}:${report.to}`} action="/app/revenue/reports" method="get" className="flex flex-col gap-4 sm:flex-row sm:items-end" aria-describedby="range-help">
          <div className="min-w-0 sm:flex-1">
            <label htmlFor="revenue-from" className="mb-2 block text-sm font-medium">Start Date</label>
            <input id="revenue-from" name="from" type="date" defaultValue={report.from} max={today} required className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600" />
          </div>
          <div className="min-w-0 sm:flex-1">
            <label htmlFor="revenue-to" className="mb-2 block text-sm font-medium">End Date</label>
            <input id="revenue-to" name="to" type="date" defaultValue={report.to} max={today} required className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600" />
          </div>
          <button type="submit" className="min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View Report</button>
        </form>
        <p id="range-help" className="mt-3 text-xs leading-relaxed text-slate-600">Dates use hotel time (WIB) and include both the start and end dates. The period is limited to the 366 days up to the end date. Future dates are capped at today; invalid or reversed ranges default to this month.</p>
        <nav aria-label="Quick date ranges" className="mt-4 flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = report.from === preset.from && report.to === today;
            return <Link key={preset.label} href={{ pathname: "/app/revenue/reports", query: { from: preset.from, to: today } }} prefetch={false} aria-current={active ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{preset.label}</Link>;
          })}
        </nav>
      </section>

      <ReportSummary report={report} />
      <aside aria-label="Report calculation basis" className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-slate-700">
        <h2 className="font-semibold text-slate-900">Calculation Basis</h2>
        <p className="mt-1">{"Revenue, room inventory and occupancy for closed dates use frozen night audit results. Open dates use current data. Booking source contributions and ARR always use current data, including for closed dates. As a result, source contributions plus unattributed revenue may differ from the report's total revenue."}</p>
      </aside>
      <ReportBreakdown report={report} />
      <ReportDaily report={report} />
      <ReportRateVariance varianceData={varianceData} />
    </main>
  );
}
