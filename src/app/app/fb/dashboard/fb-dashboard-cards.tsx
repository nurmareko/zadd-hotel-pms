import type { ReactNode } from "react";
import { Banknote, ChefHat, Clock3, Gift, ReceiptText, Users, type LucideIcon } from "lucide-react";

import type { FBDashboardMetrics } from "@/lib/fb/dashboard-metrics";
import { formatDecimalID, formatIDR } from "@/lib/format";

export function FBDashboardCards({ metrics }: { metrics: FBDashboardMetrics }) {
  const cards = [
    { label: "Penjualan Kotor", value: formatIDR(metrics.grossSales), detail: `${formatDecimalID(metrics.settledCount, 0)} tagihan lunas`, icon: Banknote },
    { label: "Rata-rata Tagihan", value: formatIDR(metrics.averageBill), detail: "Per tagihan lunas", icon: ReceiptText },
    { label: "Tamu", value: formatDecimalID(metrics.covers, 0), detail: "Pada tagihan lunas", icon: Users },
    { label: "Tagihan Terbuka", value: formatDecimalID(metrics.openBillCount, 0), detail: `${formatIDR(metrics.openBillTotal)} belum lunas`, icon: Clock3 },
    { label: "Tagihan Cuma-Cuma", value: formatDecimalID(metrics.complimentaryCount, 0), detail: `${formatIDR(metrics.complimentaryTotal)} · Belum didukung skema data`, icon: Gift },
    { label: "Waktu Masak Dapur", value: metrics.kitchenAverageMinutes === null ? "—" : `${formatDecimalID(metrics.kitchenAverageMinutes, 1)} menit`, detail: metrics.kitchenAverageMinutes === null ? "Belum ada durasi dapur yang dapat dihitung" : `${formatDecimalID(metrics.kitchenCompletedCount, 0)} pesanan selesai`, icon: ChefHat },
  ];

  return (
    <section aria-label="Ringkasan operasional" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, detail, icon: Icon }) => (
        <div key={label} className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            {label}
          </h2>
          <p className="num mt-2 break-words text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
      ))}
    </section>
  );
}

export function DashboardPanel({
  title, children, tone = "neutral", icon: Icon,
}: {
  title: string;
  children: ReactNode;
  tone?: "neutral" | "amber" | "red";
  icon?: LucideIcon;
}) {
  const tones = {
    neutral: "border-gray-200 text-slate-900",
    amber: "border-amber-200 text-amber-800",
    red: "border-red-200 text-red-700",
  };
  return (
    <section className={`min-w-0 rounded-lg border bg-white p-4 shadow-sm sm:p-5 ${tones[tone]}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DashboardTable({ caption, headers, children }: {
  caption: string;
  headers: { label: string; numeric?: boolean }[];
  children: ReactNode;
}) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="max-w-full overflow-x-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <table className="w-full text-left text-sm text-slate-700">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-gray-200 bg-slate-50 text-xs text-slate-600">
          <tr>{headers.map(({ label, numeric }) => <th key={label} scope="col" className={`whitespace-nowrap px-3 py-2 font-semibold ${numeric ? "text-right" : ""}`}>{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium">{children}</tbody>
      </table>
    </div>
  );
}

export function DashboardNote({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-slate-500">{children}</p>;
}
