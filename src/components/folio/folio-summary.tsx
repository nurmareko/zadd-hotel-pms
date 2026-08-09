import {
  billBalanceAmountLabel,
  billBalanceLabel,
} from "@/lib/folio-balance-display";
import { formatIDR } from "@/lib/format";
import type { FolioTotals } from "@/lib/folio-totals";

type FolioSummaryProps = {
  totals: FolioTotals;
  variant?: "standard" | "payment" | "detailed";
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

export function FolioSummary({
  totals,
  variant = "standard",
}: FolioSummaryProps) {
  const isDetailed = variant === "detailed";
  const isPayment = variant === "payment";
  const isStandard = variant === "standard";

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
        {isPayment
          ? "Ringkasan pembayaran"
          : isDetailed
            ? "Ringkasan tagihan"
            : "Saldo"}
      </div>
      <div className="p-5 text-sm">
        {isDetailed ? (
          <>
            <SummaryRow label="Subtotal" value={formatIDR(totals.subtotal)} />
            <SummaryRow
              label="Service charge"
              value={formatIDR(totals.serviceCharge)}
            />
            <SummaryRow label="Pajak" value={formatIDR(totals.tax)} />
          </>
        ) : null}
        {!isPayment ? (
          <SummaryRow
            label={isStandard ? "Total charges" : "Total tagihan"}
            value={formatIDR(totals.totalCharges)}
          />
        ) : null}
        <SummaryRow
          label={isStandard ? "Total payments" : "Total pembayaran"}
          value={
            isPayment
              ? formatIDR(totals.totalPaid)
              : `-${formatIDR(totals.totalPaid)}`
          }
        />
        <div className="my-3 border-t border-slate-100" />
        <div className="flex items-center justify-between gap-3 py-1.5 text-base font-semibold text-slate-900">
          <span>
            {isStandard ? "Saldo terhutang" : billBalanceLabel(totals.balance)}
          </span>
          <span className={balanceClassName(totals.balance)}>
            {isStandard
              ? formatIDR(totals.balance)
              : billBalanceAmountLabel(totals.balance)}
          </span>
        </div>
      </div>
    </section>
  );
}
