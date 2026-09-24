import type { ArrStatus } from "@/lib/arr";
import { parseISODateOnly } from "@/lib/date-only";
import { formatDecimalID, formatIDR } from "@/lib/format";
import type { RevenueReportData } from "@/lib/revenue-reports";

const arrExplanations: Record<Exclude<ArrStatus, "AUTHORITATIVE">, string> = {
  UNAVAILABLE: "ARR belum tersedia untuk periode sebelum tanggal mulai pencatatan ARR.",
  NO_RECOGNIZED_NIGHTS: "Belum ada malam kamar berbayar yang diakui untuk menghitung ARR.",
  INTEGRITY_ERROR: "ARR tidak dapat ditampilkan karena data pencatatan tidak konsisten. Hubungi administrator.",
};

export function reportDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(parseISODateOnly(date));
}

const percent = (value: number) => `${formatDecimalID(value)}%`;
const surface = "rounded-lg border border-slate-200 bg-white shadow-sm";

function ArrValue({ value, status }: { value: number; status: ArrStatus }) {
  if (status === "AUTHORITATIVE") return <span className="whitespace-nowrap">{formatIDR(value)}</span>;
  return (
    <div>
      <span aria-label="ARR tidak tersedia">—</span>
      <p className="mt-1 min-w-48 text-xs font-normal leading-relaxed text-slate-600">{arrExplanations[status]}</p>
    </div>
  );
}

export function ReportSummary({ report }: { report: RevenueReportData }) {
  const { summary } = report;
  const metrics = [
    { label: "Total Pendapatan", value: formatIDR(summary.totalRevenue), hint: "Pendapatan kamar, makanan & minuman, serta lainnya." },
    { label: "Okupansi", value: percent(summary.occupancyRate), hint: `${formatDecimalID(summary.occupiedRooms)} dari ${formatDecimalID(summary.totalRooms)} malam kamar tersedia.` },
    { label: "ARR", value: <ArrValue value={summary.arr} status={summary.arrStatus} />, hint: "Rata-rata pendapatan per malam kamar berbayar yang diakui." },
    { label: "RevPAR", value: formatIDR(summary.revPar), hint: "Pendapatan kamar per malam kamar tersedia." },
  ];
  return (
    <section aria-label="Ringkasan pendapatan" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
    { label: "Kamar", amount: summary.roomRevenue },
    { label: "Makanan & Minuman", amount: summary.fbRevenue },
    { label: "Lainnya", amount: summary.otherRevenue },
  ];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <section aria-labelledby="breakdown-heading" className={`${surface} p-4 md:p-5`}>
        <h2 id="breakdown-heading" className="text-lg font-semibold">Ringkasan Pendapatan</h2>
        <p className="mt-1 text-sm text-slate-600">Persentase terhadap total pendapatan periode ini.</p>
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
          <h2 id="sources-heading" className="text-lg font-semibold">Kontribusi Sumber Pemesanan</h2>
          <p id="sources-note" className="mt-1 text-sm leading-relaxed text-slate-600">Persentase hanya dihitung dari pendapatan yang terhubung ke reservasi, bukan total pendapatan laporan. Malam kamar mencakup malam gratis; reservasi dibatalkan dan no-show tidak masuk hitungan reservasi maupun malam kamar.</p>
        </div>
        <div role="region" aria-label="Tabel sumber reservasi" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
          <table className="w-full text-sm" aria-describedby="sources-note">
            <thead className="bg-slate-50 text-slate-600">
              <tr>{["Sumber", "Reservasi", "Malam Kamar", "Pendapatan", "Kontribusi"].map((label, index) => <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 font-medium ${index === 0 ? "text-left" : "text-right"}`}>{label}</th>)}</tr>
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
              {sources.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">Belum ada kontribusi sumber reservasi pada periode ini. Pilih periode lain untuk melihat data.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="m-4 rounded-md bg-slate-50 p-4 md:m-5">
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold"><span>Pendapatan Tanpa Atribusi</span><span className="tabular-nums">{formatIDR(report.unattributedRevenue)}</span></div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">Pesanan makanan & minuman selesai tanpa folio tertaut. Tidak dimasukkan ke sumber Tamu Datang Langsung atau penyebut persentase kontribusi.</p>
        </div>
      </section>
    </div>
  );
}

export function ReportDaily({ report }: { report: RevenueReportData }) {
  const columns = ["Tanggal", "Kamar Tersedia", "Kamar Terjual", "Okupansi", "Pendapatan Kamar", "Pendapatan F&B", "Pendapatan Lain", "Total Pendapatan", "ARR", "RevPAR"];
  return (
    <section aria-labelledby="daily-heading" className={`${surface} min-w-0`}>
      <div className="p-4 md:p-5">
        <h2 id="daily-heading" className="text-lg font-semibold">Rincian Harian</h2>
        <p className="mt-1 text-sm text-slate-600">{report.dailyRows.length} hari · {reportDate(report.from)} – {reportDate(report.to)}. Geser tabel untuk melihat seluruh metrik.</p>
      </div>
      <div role="region" aria-label="Tabel pendapatan harian" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
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
            {report.dailyRows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-600">Belum ada data harian. Pilih periode lain untuk melihat laporan.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
