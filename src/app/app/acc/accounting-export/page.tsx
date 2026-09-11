import { Download, FileSpreadsheet } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateID, formatIDR } from "@/lib/format";
import {
  getAccountingExportRange,
  getAccountingExportRows,
} from "@/lib/accounting-export";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numberLabel(value: number) {
  return formatIDR(value);
}

export default async function AccountingExportPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user.role !== "ACC") {
    redirect("/app/forbidden");
  }

  const params = (await searchParams) ?? {};
  let range;
  let rangeError: string | undefined;
  try {
    range = getAccountingExportRange(first(params.from), first(params.to));
  } catch {
    rangeError = "Rentang tanggal tidak valid. Tanggal akhir harus sama atau setelah tanggal awal.";
    range = getAccountingExportRange(undefined, undefined);
  }

  let rows = [] as Awaited<ReturnType<typeof getAccountingExportRows>>;
  let loadError = false;
  try {
    rows = await getAccountingExportRows(range);
  } catch (error) {
    console.error("Failed to load accounting export data", error);
    loadError = true;
  }

  const roomRevenue = rows.reduce((sum, row) => sum + row.roomRevenue, 0);
  const fbRevenue = rows.reduce((sum, row) => sum + row.fbRevenue, 0);
  const exportHref = `/app/acc/accounting-export/export?from=${range.from}&to=${range.to}`;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-foreground md:px-6 md:py-5">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Accounting</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Accounting Export</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ekspor data transaksi dan pendapatan untuk kebutuhan pencatatan dan pengolahan data.
        </p>
      </div>

      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <form method="get" className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Tanggal mulai
            <input className="h-10 rounded-md border border-input bg-white px-3 text-sm" type="date" name="from" defaultValue={range.from} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Tanggal akhir
            <input className="h-10 rounded-md border border-input bg-white px-3 text-sm" type="date" name="to" defaultValue={range.to} required />
          </label>
          <button className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800" type="submit">Terapkan</button>
          <div className="h-px bg-border lg:mx-2 lg:h-10 lg:w-px" />
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Format
            <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" defaultValue="CSV" disabled>
              <option value="CSV">CSV</option>
            </select>
          </label>
          <a className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800" href={exportHref} download>
            <Download aria-hidden="true" className="h-4 w-4" />
            Download CSV
          </a>
        </form>
        {rangeError ? <p className="mt-3 text-sm text-red-700">{rangeError}</p> : null}
      </section>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Data accounting gagal dimuat. Silakan coba lagi.</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="Tidak ada data transaksi" description="Tidak ada data transaksi pada periode yang dipilih." />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {rows.length} transaksi · Pendapatan Kamar {numberLabel(roomRevenue)} · Pendapatan F&B {numberLabel(fbRevenue)}
          </p>
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr>
                    {["ID Transaksi", "Tanggal", "Tipe Transaksi", "No. Reservasi", "Tamu", "Kamar", "Pendapatan Kamar", "Pendapatan F&B", "Pajak", "Total", "Metode Pembayaran", "Status"].map((heading) => (
                      <th key={heading} className="border-b border-border bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 odd:bg-white even:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.id}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateID(row.date)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.transactionType}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.reservationNo ?? "-"}</td>
                      <td className="px-4 py-3">{row.guestName ?? "-"}</td>
                      <td className="px-4 py-3">{row.roomNumber ?? "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{numberLabel(row.roomRevenue)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{numberLabel(row.fbRevenue)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{numberLabel(row.tax)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{numberLabel(row.total)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.paymentMethod ?? "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}