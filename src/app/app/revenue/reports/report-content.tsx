import type { ArrStatus } from "@/lib/arr";
import { parseISODateOnly } from "@/lib/date-only";
import { formatDecimalID, formatIDR } from "@/lib/format";
import type { RateVarianceSummary, RevenueReportData } from "@/lib/revenue-reports";

const arrExplanations: Record<Exclude<ArrStatus, "AUTHORITATIVE">, string> = {
  UNAVAILABLE: "ARR is unavailable for periods before ARR recording began.",
  NO_RECOGNIZED_NIGHTS: "There are no recognised paid room nights to calculate ARR.",
  INTEGRITY_ERROR: "ARR cannot be displayed because posting data is inconsistent. Contact an administrator.",
};

export function reportDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(parseISODateOnly(date));
}

const percent = (value: number) => `${formatDecimalID(value)}%`;
const surface = "rounded-lg border border-slate-200 bg-white shadow-sm";

function ArrValue({ value, status }: { value: number; status: ArrStatus }) {
  if (status === "AUTHORITATIVE") return <span className="whitespace-nowrap">{formatIDR(value)}</span>;
  return (
    <div>
      <span aria-label="ARR unavailable">—</span>
      <p className="mt-1 min-w-48 text-xs font-normal leading-relaxed text-slate-600">{arrExplanations[status]}</p>
    </div>
  );
}

export function ReportRateVariance({ varianceData }: { varianceData: RateVarianceSummary }) {
  const metrics = [
    { label: "Rate Overrides Count", value: varianceData.totalOverrides },
    { label: "Total Rate Discounts Granted", value: formatIDR(varianceData.totalDiscountAmount) },
    { label: "Average Discount %", value: percent(varianceData.averageDiscountPct) },
  ];
  return (
    <section aria-labelledby="variance-heading" className="min-w-0 space-y-4">
      <div>
        <h2 id="variance-heading" className="text-lg font-semibold">Rate Variance</h2>
        <p id="variance-note" className="mt-1 text-sm leading-relaxed text-slate-600">Overrides recorded during the selected hotel dates, not posted revenue. Stay variance sums all logged nights; the standard rate shown is the first-night rate. Discounts are netted within each stay. Average discount is the mean percentage for discounted stays with a positive standard total.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className={`${surface} min-w-0 p-4 md:p-5`}>
            <dt className="text-sm font-medium text-slate-600">{metric.label}</dt>
            <dd className="mt-3 break-words text-2xl font-bold tabular-nums">{metric.value}</dd>
          </div>
        ))}
      </dl>
      <div className={`${surface} min-w-0`}>
        <p className="p-4 text-xs text-slate-600">Authorized By identifies the operator who recorded the override, not verified supervisor approval. Approval details must be documented in the reason.</p>
        <div role="region" aria-label="Rate variance audit table" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
          <table className="w-full text-sm" aria-describedby="variance-note">
            <thead className="bg-slate-50 text-slate-600">
              <tr>{["Reservation #", "Guest", "Room Type", "Stay Dates", "Standard Rate", "Custom Rate", "Total Variance", "Reason", "Authorized By"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {varianceData.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium">{item.reservationNo ?? "Deleted reservation"}</th>
                  <td className="px-4 py-3">{item.guestName ?? "—"}</td>
                  <td className="px-4 py-3">{item.roomTypeName ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{item.arrivalDate && item.departureDate ? `${reportDate(item.arrivalDate)} – ${reportDate(item.departureDate)}` : "—"}<div className="text-xs text-slate-500">{item.nightsCount} logged nights</div></td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{item.standardRate === null ? "—" : formatIDR(item.standardRate)}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{item.customRate === null ? "—" : formatIDR(item.customRate)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 tabular-nums ${item.totalVariance < 0 ? "text-amber-800" : "text-slate-700"}`}>{formatIDR(item.totalVariance)}</td>
                  <td className="min-w-48 max-w-sm break-words px-4 py-3">{item.reason || "Not provided"}</td>
                  <td className="px-4 py-3">{item.operatorName}</td>
                </tr>
              ))}
              {varianceData.items.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No rate overrides were recorded in this date range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function ReportSummary({ report }: { report: RevenueReportData }) {
  const { summary } = report;
  const metrics = [
    { label: "Total Revenue", value: formatIDR(summary.totalRevenue), hint: "Room, food & beverage and other revenue." },
    { label: "Occupancy", value: percent(summary.occupancyRate), hint: `${formatDecimalID(summary.occupiedRooms)} of ${formatDecimalID(summary.totalRooms)} available room nights.` },
    { label: "ARR", value: <ArrValue value={summary.arr} status={summary.arrStatus} />, hint: "Average revenue per recognised paid room night." },
    { label: "RevPAR", value: formatIDR(summary.revPar), hint: "Room revenue per available room night." },
  ];
  return (
    <section aria-label="Revenue summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className={`${surface} min-w-0 p-4 md:p-5`}>
          <h2 className="text-sm font-medium text-slate-600">{metric.label}</h2>
          <div className="mt-3 break-words text-2xl font-bold tabular-nums text-slate-900">{metric.value}</div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{metric.hint}</p>
        </div>
      ))}
    </section>
  );
}

export function ReportBreakdown({ report }: { report: RevenueReportData }) {
  const { summary, sources } = report;
  const categories = [
    { label: "Room", amount: summary.roomRevenue },
    { label: "Food & Beverage", amount: summary.fbRevenue },
    { label: "Other", amount: summary.otherRevenue },
  ];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <section aria-labelledby="breakdown-heading" className={`${surface} p-4 md:p-5`}>
        <h2 id="breakdown-heading" className="text-lg font-semibold">Revenue Summary</h2>
        <p className="mt-1 text-sm text-slate-600">Percentage of total revenue for this period.</p>
        <dl className="mt-4 divide-y divide-slate-100">
          {categories.map(({ label, amount }) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-2 py-4">
              <dt className="text-sm text-slate-600">{label}</dt>
              <dd className="text-right tabular-nums">
                <div className="font-semibold">{formatIDR(amount)}</div>
                <div className="text-xs text-slate-600">{percent(summary.totalRevenue > 0 ? amount / summary.totalRevenue * 100 : 0)}</div>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="sources-heading" className={`${surface} min-w-0 xl:col-span-2`}>
        <div className="p-4 md:p-5">
          <h2 id="sources-heading" className="text-lg font-semibold">Booking Source Contributions</h2>
          <p id="sources-note" className="mt-1 text-sm leading-relaxed text-slate-600">Percentages are based only on revenue linked to reservations, not total report revenue. Room nights include complimentary nights; cancelled and no-show reservations are excluded from both reservation and room night counts.</p>
        </div>
        <div role="region" aria-label="Booking source table" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
          <table className="w-full text-sm" aria-describedby="sources-note">
            <thead className="bg-slate-50 text-slate-600">
              <tr>{["Source", "Reservations", "Room Nights", "Revenue", "Contribution"].map((label, index) => <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 font-medium ${index === 0 ? "text-left" : "text-right"}`}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((source) => (
                <tr key={source.type}>
                  <th scope="row" className="px-4 py-3 text-left font-medium">{source.label}</th>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDecimalID(source.reservationCount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDecimalID(source.roomNights)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatIDR(source.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{percent(source.percentage)}</td>
                </tr>
              ))}
              {sources.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">No booking source contributions for this period. Select another period to view data.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="m-4 rounded-md bg-slate-50 p-4 md:m-5">
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold"><span>Unattributed Revenue</span><span className="tabular-nums">{formatIDR(report.unattributedRevenue)}</span></div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">Completed food & beverage orders without a linked folio. Excluded from the Walk-in source and the contribution percentage denominator.</p>
        </div>
      </section>
    </div>
  );
}

export function ReportDaily({ report }: { report: RevenueReportData }) {
  const columns = ["Date", "Available Rooms", "Rooms Sold", "Occupancy", "Room Revenue", "F&B Revenue", "Other Revenue", "Total Revenue", "ARR", "RevPAR"];
  return (
    <section aria-labelledby="daily-heading" className={`${surface} min-w-0`}>
      <div className="p-4 md:p-5">
        <h2 id="daily-heading" className="text-lg font-semibold">Daily Breakdown</h2>
        <p className="mt-1 text-sm text-slate-600">{report.dailyRows.length} days · {reportDate(report.from)} – {reportDate(report.to)}. Scroll the table to view all metrics.</p>
      </div>
      <div role="region" aria-label="Daily revenue table" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>{columns.map((label, index) => <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 font-medium ${index === 0 ? "text-left" : "text-right"}`}>{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {report.dailyRows.map((row) => (
              <tr key={row.date} className="align-top">
                <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium"><time dateTime={row.date}>{reportDate(row.date)}</time></th>
                {[formatDecimalID(row.totalRooms), formatDecimalID(row.roomsOccupied), percent(row.occupancyRate), formatIDR(row.roomRevenue), formatIDR(row.fbRevenue), formatIDR(row.otherRevenue), formatIDR(row.totalRevenue)].map((value, index) => <td key={index} className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{value}</td>)}
                <td className="px-4 py-3 text-right tabular-nums"><ArrValue value={row.arr} status={row.arrStatus} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatIDR(row.revPar)}</td>
              </tr>
            ))}
            {report.dailyRows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-600">No daily data yet. Select another period to view the report.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
