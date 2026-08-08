import { formatIDR } from "@/lib/format";
import type { FolioTotals } from "@/lib/folio-totals";

type FolioSummaryProps = {
  totals: FolioTotals;
};

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={strong ? "text-slate-900 font-semibold" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`text-right ${strong ? "text-base font-semibold text-slate-900" : "font-medium text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}

function balanceClassName(balance: number) {
  const roundedBalance = Math.round(balance);

  if (roundedBalance > 0) {
    return "text-red-600";
  }

  if (roundedBalance < 0) {
    return "text-amber-600";
  }

  return "text-emerald-600";
}

export function FolioSummary({ totals }: FolioSummaryProps) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
        {"Saldo"}
      </div>
      <div className="p-5 text-sm">
        <SummaryRow
          label="Total charges"
          value={formatIDR(totals.totalCharges)}
        />
        <SummaryRow
          label="Total payments"
          value={`-${formatIDR(totals.totalPaid)}`}
        />
        <div className="my-3 border-t border-slate-100" />
        <div className="flex items-center justify-between gap-3 py-1.5 text-base font-semibold text-slate-900">
          <span>Saldo terhutang</span>
          <span className={balanceClassName(totals.balance)}>
            {formatIDR(totals.balance)}
          </span>
        </div>
      </div>
    </section>
  );
}
