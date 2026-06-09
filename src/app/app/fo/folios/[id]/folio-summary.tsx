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
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={strong ? "text-console-ink" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`num text-right ${strong ? "text-[15px] font-semibold" : "font-medium text-console-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

function balanceClassName(balance: number) {
  const roundedBalance = Math.round(balance);

  if (roundedBalance > 0) {
    return "text-status-od-fg";
  }

  if (roundedBalance < 0) {
    return "text-status-vd-fg";
  }

  return "text-status-vc-fg";
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
    <section className="min-w-0 border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"Saldo"}
      </div>
      <div className="p-3.5 text-[13px]">
        <SummaryRow
          label="Total charges"
          value={formatIDR(totals.totalCharges)}
        />
        <SummaryRow
          label="Total payments"
          value={`-${formatIDR(totals.totalPaid)}`}
        />
        <div className="my-2 border-t border-console-border-soft" />
        <div className="flex items-center justify-between gap-3 py-1 text-[15px] font-semibold">
          <span>Saldo terhutang</span>
          <span className={`num ${balanceClassName(totals.balance)}`}>
            {formatIDR(totals.balance)}
          </span>
        </div>
      </div>
      <div className="border-t border-console-border bg-console-bg p-3.5">
        {canCheckOut ? (
          <Link
            href={`/app/fo/check-out/${folioId}`}
            className="inline-flex h-8 w-full items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            Lanjut ke Check-Out
          </Link>
        ) : (
          <span className="block text-[11px] text-slate-500">
            Check-out tersedia saat folio open dan reservasi checked-in.
          </span>
        )}
      </div>
    </section>
  );
}
