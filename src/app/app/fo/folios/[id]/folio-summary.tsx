import { FolioStatus, ReservationStatus } from "@prisma/client";
import Link from "next/link";

import { formatIDR } from "@/lib/format";
import type { FolioTotals } from "@/lib/folio-totals";

type FolioSummaryProps = {
  folioId: number;
  status: FolioStatus;
  reservationStatus: ReservationStatus;
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

export function FolioSummary({
  folioId,
  status,
  reservationStatus,
  totals,
}: FolioSummaryProps) {
  const isOpen = status === FolioStatus.OPEN;
  const canCheckOut = isOpen && reservationStatus === ReservationStatus.CHECKED_IN;

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
      <div className="border-t border-slate-200 bg-slate-50 p-5">
        {canCheckOut ? (
          <Link
            href={`/app/fo/check-out/${folioId}`}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors"
          >
            Lanjut ke Check-Out
          </Link>
        ) : (
          <span className="block text-xs text-slate-500">
            Check-out tersedia saat folio open dan reservasi checked-in.
          </span>
        )}
      </div>
    </section>
  );
}
