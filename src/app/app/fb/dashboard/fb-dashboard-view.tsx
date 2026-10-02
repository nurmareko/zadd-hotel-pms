import type { ReactNode } from "react";
import { Ban, Gift, Trash2, TrendingUp, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { FBDashboardMetrics } from "@/lib/fb/dashboard-metrics";
import { formatDecimalID, formatIDR } from "@/lib/format";

import { DashboardNote, DashboardPanel, DashboardTable, FBDashboardCards } from "./fb-dashboard-cards";
import { FBDatePicker } from "./fb-date-picker";

const serviceLabels: Record<string, string> = { DINE_IN: "Dine In", ROOM_SERVICE: "Room Service" };
const tenderLabels: Record<string, string> = {
  CASH: "Tunai", TRANSFER: "Transfer", CARD: "Kartu", CHARGE_TO_ROOM: "Tagih ke Kamar", UNKNOWN: "Belum tercatat",
};
const wibTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function BillTime({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{wibTime.format(date)} WIB</time>;
}

export function FBDashboardView({ metrics, children }: {
  metrics: FBDashboardMetrics;
  children?: ReactNode;
}) {
  return (
    <main className="min-w-0 w-full space-y-4 bg-slate-50 p-4 text-slate-900 sm:p-5 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <TrendingUp aria-hidden="true" className="size-6 shrink-0 text-emerald-700" />
          Dasbor F&B
        </h1>
        <div className="flex flex-wrap items-end gap-3">
          <FBDatePicker date={metrics.date} />
          <Link href="/app/fb/pos" className={buttonVariants()}>
            <UtensilsCrossed aria-hidden="true" className="size-4" />
            Buka POS
          </Link>
        </div>
      </header>

      {children}

      <FBDashboardCards metrics={metrics} />

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <DashboardPanel title="Penjualan per Tipe Layanan">
          {metrics.settledCount === 0 ? <DashboardNote>Belum ada penjualan dari tagihan lunas pada tanggal ini.</DashboardNote> : (
            <DashboardTable caption="Penjualan per layanan" headers={[{ label: "Layanan" }, { label: "Tagihan", numeric: true }, { label: "Total", numeric: true }]}>
              {metrics.salesByService.map((row) => (
                <tr key={row.serviceType}>
                  <th scope="row">{serviceLabels[row.serviceType] ?? "Layanan lainnya"}</th>
                  <td className="num text-right">{formatDecimalID(row.count, 0)}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(row.total)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
        <DashboardPanel title="Penjualan per Metode Pembayaran">
          {metrics.settledCount === 0 ? <DashboardNote>Belum ada pembayaran dari tagihan lunas pada tanggal ini.</DashboardNote> : (
            <DashboardTable caption="Penjualan per metode pembayaran" headers={[{ label: "Metode" }, { label: "Tagihan", numeric: true }, { label: "Total", numeric: true }]}>
              {metrics.salesByTender.map((row) => (
                <tr key={row.paymentMethod}>
                  <th scope="row">{tenderLabels[row.paymentMethod] ?? "Metode lainnya"}</th>
                  <td className="num text-right">{formatDecimalID(row.count, 0)}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(row.total)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
        <DashboardPanel title={`Tagihan Terbuka Aktif (${formatDecimalID(metrics.openBillCount, 0)})`}>
          <p className="mb-3 text-xs leading-5 text-slate-500">Dibuka pada tanggal terpilih dan masih aktif saat ini; bukan rekaman status pada tanggal tersebut. Durasi dihitung hingga saat ini.</p>
          {metrics.openBills.length === 0 ? <DashboardNote>Tidak ada tagihan yang dibuka pada tanggal ini dan masih aktif saat ini.</DashboardNote> : (
            <DashboardTable caption="Tagihan yang masih aktif" headers={[{ label: "Tagihan" }, { label: "Lokasi" }, { label: "Tamu", numeric: true }, { label: "Dibuka" }, { label: "Durasi", numeric: true }, { label: "Total", numeric: true }]}>
              {metrics.openBills.map((bill) => (
                <tr key={bill.id}>
                  <th scope="row" className="whitespace-nowrap">{bill.orderNo}</th>
                  <td>{bill.location}</td>
                  <td className="num text-right">{formatDecimalID(bill.guestCount, 0)}</td>
                  <td className="num whitespace-nowrap"><BillTime date={bill.openedAt} /></td>
                  <td className="num whitespace-nowrap text-right">{formatDecimalID(bill.elapsedMinutes, 0)} menit</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(bill.total)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
        <DashboardPanel title="Menu Terlaris">
          {metrics.topItems.length === 0 ? <DashboardNote>Belum ada menu terjual dari tagihan lunas pada tanggal ini.</DashboardNote> : (
            <DashboardTable caption="Menu terlaris dari tagihan lunas" headers={[{ label: "Menu" }, { label: "Jumlah", numeric: true }, { label: "Penjualan", numeric: true }]}>
              {metrics.topItems.map((item) => (
                <tr key={item.menuItemId}>
                  <th scope="row" className="min-w-32 break-words">{item.name}</th>
                  <td className="num text-right">{formatDecimalID(item.quantity, 0)}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(item.revenue)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <DashboardPanel title={`Tagihan Cuma-Cuma (${formatDecimalID(metrics.complimentaryCount, 0)} · ${formatIDR(metrics.complimentaryTotal)})`} tone="amber" icon={Gift}>
          <DashboardNote>Skema data belum mendukung tagihan cuma-cuma. Nilai 0 bukan konfirmasi bahwa tidak ada tagihan cuma-cuma.</DashboardNote>
        </DashboardPanel>
        <DashboardPanel title="Item Dibatalkan (0)" tone="red" icon={Trash2}>
          <DashboardNote>Item dihapus secara permanen; riwayat pembatalannya tidak disimpan. Nilai 0 bukan konfirmasi bahwa tidak ada penghapusan.</DashboardNote>
        </DashboardPanel>
        <DashboardPanel title={`Pesanan Dibatalkan (${formatDecimalID(metrics.voidedBills.length, 0)})`} tone="red" icon={Ban}>
          {metrics.voidedBills.length === 0 ? <DashboardNote>Belum ada pesanan Void tercatat pada tanggal ini.</DashboardNote> : (
            <DashboardTable caption="Pesanan Void pada tanggal terpilih" headers={[{ label: "Tagihan" }, { label: "Lokasi" }, { label: "Total", numeric: true }, { label: "Dibatalkan" }]}>
              {metrics.voidedBills.map((bill) => (
                <tr key={bill.id}>
                  <th scope="row" className="whitespace-nowrap">{bill.orderNo}</th>
                  <td>{bill.location}</td>
                  <td className="num whitespace-nowrap text-right">{formatIDR(bill.total)}</td>
                  <td className="num whitespace-nowrap">{bill.closedAt ? <BillTime date={bill.closedAt} /> : "Waktu tidak tersedia"}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </DashboardPanel>
      </div>
    </main>
  );
}
