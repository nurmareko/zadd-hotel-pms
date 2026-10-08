import { Shirt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getLaundrySummary, getLinenBatches } from "@/lib/laundry/data";
import { LaundryFiltersSchema } from "@/lib/laundry/logic";
import { StartWashingButton } from "./batch-action-buttons";
import { CreateBatchDialog } from "./create-batch-dialog";
import { LaundryFilters, type LaundryFilterValues } from "./laundry-filters";
import { ITEM_LABELS, STATUS_CLASSES, STATUS_LABELS } from "./laundry-labels";
import { LaundrySummaryCards } from "./laundry-summary-cards";
import { ReceiveBatchDialog } from "./receive-batch-dialog";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const headerClass = "border-b border-border px-4 py-3 text-left text-xs font-medium text-muted-foreground";
const cellClass = "border-b border-border/60 px-4 py-3 align-top";
const hotelDateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export default async function LaundryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const filters: LaundryFilterValues = {
    q: first("q"), status: first("status"), itemType: first("itemType"),
    startDate: first("startDate"), endDate: first("endDate"),
  };
  const parsed = LaundryFiltersSchema.safeParse({
    q: filters.q, status: filters.status, itemType: filters.itemType,
    dateFrom: filters.startDate, dateTo: filters.endDate,
  });
  const [summary, batches] = await Promise.all([
    getLaundrySummary(),
    parsed.success ? getLinenBatches(parsed.data) : Promise.resolve([]),
  ]);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <main className="min-w-0 max-w-full space-y-4 p-4 md:space-y-6 md:p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Manajemen Binatu / Laundry</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Pantau pengiriman, pencucian, dan penerimaan linen hotel.</p>
      </header>
      <LaundrySummaryCards summary={summary} />
      <Card className="min-w-0 max-w-full gap-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Daftar Batch Linen</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kirim linen, mulai pencucian, lalu cocokkan hasil penerimaan.</p>
          </div>
          <CreateBatchDialog />
        </div>
        <LaundryFilters key={JSON.stringify(filters)} filters={filters} />
      </Card>
      {!parsed.success ? (
        <Card className="min-w-0 max-w-full p-4" role="alert">
          <h2 className="font-semibold">Filter belum dapat diterapkan</h2>
          <p className="text-sm text-destructive">{parsed.error.issues[0]?.message} Perbaiki filter atau pilih Reset Filter.</p>
        </Card>
      ) : batches.length === 0 ? (
        <Card className="min-w-0 max-w-full items-center gap-3 px-4 py-12 text-center">
          <Shirt className="size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">{hasFilters ? "Tidak ada batch yang sesuai" : "Belum ada pengiriman linen"}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{hasFilters ? "Ubah pencarian atau reset filter untuk melihat batch lainnya." : "Pilih + Catat Batch Cucian untuk mencatat pengiriman pertama dan memantau proses pencuciannya."}</p>
        </Card>
      ) : (
        <Card className="min-w-0 max-w-full gap-0 overflow-hidden py-0">
          <div className="border-b px-4 py-3 text-sm text-muted-foreground"><span className="num font-semibold text-foreground">{batches.length.toLocaleString("id-ID")}</span> batch ditampilkan · Waktu dalam WIB</div>
          
          {/* Tampilan Desktop: Tabel Lengkap */}
          <div className="hidden overflow-x-auto focus-visible:outline-ring desktop:block relative w-full min-w-0 max-w-full" tabIndex={0} role="region" aria-label="Tabel batch linen, geser untuk melihat seluruh kolom">
            <table className="w-full min-w-[1050px] text-sm">
              <caption className="sr-only">Pengiriman dan hasil penerimaan batch linen</caption>
              <thead><tr>{["Kode Batch", "Tipe Linen", "Jumlah Dikirim", "Status", "Hasil Penerimaan", "Vendor", "Petugas", "Aksi"].map((label) => <th key={label} scope="col" className={headerClass}>{label}</th>)}</tr></thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-muted/30">
                    <th scope="row" className={`${cellClass} text-left font-normal`}>
                      <span className="font-semibold">{batch.batchCode}</span>
                      <p className="num mt-1 whitespace-nowrap text-xs text-muted-foreground">{hotelDateTime.format(new Date(batch.sentAt))}</p>
                      {batch.notes && <details className="mt-2 max-w-56 text-xs text-muted-foreground"><summary className="cursor-pointer">Catatan</summary><p className="mt-1 whitespace-pre-wrap break-words">{batch.notes}</p></details>}
                    </th>
                    <td className={cellClass}>{ITEM_LABELS[batch.itemType]}</td>
                    <td className={`${cellClass} num whitespace-nowrap`}>{batch.sentQuantity.toLocaleString("id-ID")} unit</td>
                    <td className={cellClass}><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[batch.status]}`}>{STATUS_LABELS[batch.status]}</span></td>
                    <td className={cellClass}>
                      {batch.receivedQuantity === null ? <span className="text-xs text-muted-foreground">Belum diterima</span> : (
                        <div className="num space-y-1 whitespace-nowrap text-xs">
                          <p className="font-medium text-emerald-700">Bersih: {batch.receivedQuantity.toLocaleString("id-ID")} unit</p>
                          <p className={batch.damagedQuantity > 0 ? "text-rose-700" : "text-muted-foreground"}>Rusak: {batch.damagedQuantity.toLocaleString("id-ID")} unit</p>
                          <p className={(batch.lostQuantity ?? 0) > 0 ? "text-amber-800" : "text-muted-foreground"}>Hilang: {(batch.lostQuantity ?? 0).toLocaleString("id-ID")} unit</p>
                          {batch.completedAt && <p className="text-muted-foreground">{hotelDateTime.format(new Date(batch.completedAt))}</p>}
                        </div>
                      )}
                    </td>
                    <td className={cellClass}>{batch.vendor ?? "—"}</td>
                    <td className={cellClass}>
                      <p className="text-xs"><span className="text-muted-foreground">Kirim: </span>{batch.recordedBy.fullName}</p>
                      {batch.receivedBy && <p className="mt-1 text-xs"><span className="text-muted-foreground">Terima: </span>{batch.receivedBy.fullName}</p>}
                    </td>
                    <td className={cellClass}>
                      {batch.status === "SENT" || batch.status === "WASHING" ? (
                        <div className="flex flex-col items-start gap-2">
                          {batch.status === "SENT" && <StartWashingButton id={batch.id} batchCode={batch.batchCode} />}
                          <ReceiveBatchDialog batch={{ id: batch.id, batchCode: batch.batchCode, itemType: batch.itemType, sentQuantity: batch.sentQuantity }} />
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Selesai</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tampilan Seluler / Layar Sentuh: Daftar Kartu Batch */}
          <div className="divide-y divide-border desktop:hidden">
            {batches.map((batch) => (
              <article key={batch.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{batch.batchCode}</h3>
                    <p className="num mt-0.5 text-xs text-muted-foreground">
                      {hotelDateTime.format(new Date(batch.sentAt))}
                    </p>
                  </div>
                  <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[batch.status]}`}>
                    {STATUS_LABELS[batch.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Tipe Linen</p>
                    <p className="font-medium text-foreground">{ITEM_LABELS[batch.itemType]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Jumlah Dikirim</p>
                    <p className="num font-medium text-foreground">{batch.sentQuantity.toLocaleString("id-ID")} unit</p>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/30 p-2.5 text-xs">
                  <p className="font-semibold text-foreground">Hasil Penerimaan</p>
                  {batch.receivedQuantity === null ? (
                    <p className="mt-1 text-muted-foreground">Belum diterima</p>
                  ) : (
                    <div className="num mt-1 space-y-0.5">
                      <p className="font-medium text-emerald-700">Bersih: {batch.receivedQuantity.toLocaleString("id-ID")} unit</p>
                      <p className={batch.damagedQuantity > 0 ? "text-rose-700" : "text-muted-foreground"}>
                        Rusak: {batch.damagedQuantity.toLocaleString("id-ID")} unit
                      </p>
                      <p className={(batch.lostQuantity ?? 0) > 0 ? "text-amber-800" : "text-muted-foreground"}>
                        Hilang: {(batch.lostQuantity ?? 0).toLocaleString("id-ID")} unit
                      </p>
                      {batch.completedAt && (
                        <p className="text-muted-foreground">{hotelDateTime.format(new Date(batch.completedAt))}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div>
                    <span>Vendor: </span>
                    <span className="font-medium text-foreground">{batch.vendor ?? "—"}</span>
                  </div>
                  <div>
                    <span>Kirim: </span>
                    <span className="font-medium text-foreground">{batch.recordedBy.fullName}</span>
                    {batch.receivedBy && (
                      <>
                        <span> · Terima: </span>
                        <span className="font-medium text-foreground">{batch.receivedBy.fullName}</span>
                      </>
                    )}
                  </div>
                </div>

                {batch.notes && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium hover:text-foreground">Catatan</summary>
                    <p className="mt-1 whitespace-pre-wrap break-words rounded bg-muted/20 p-2">{batch.notes}</p>
                  </details>
                )}

                {batch.status === "SENT" || batch.status === "WASHING" ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {batch.status === "SENT" && <StartWashingButton id={batch.id} batchCode={batch.batchCode} />}
                    <ReceiveBatchDialog batch={{ id: batch.id, batchCode: batch.batchCode, itemType: batch.itemType, sentQuantity: batch.sentQuantity }} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Proses cuci dan penerimaan selesai</p>
                )}
              </article>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
