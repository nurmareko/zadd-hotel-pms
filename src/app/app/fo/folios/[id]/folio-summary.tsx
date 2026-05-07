import { FolioStatus, ReservationStatus } from "@prisma/client";
import Link from "next/link";

import { formatIDR } from "@/lib/format";
import type { FolioTotals } from "@/lib/folio-totals";
import { RecordPaymentDialog } from "./record-payment-dialog";

type FolioSummaryProps = {
  folioId: number;
  status: FolioStatus;
  reservationStatus: ReservationStatus;
  totals: FolioTotals;
  serviceChargePercent: number;
  taxPercent: number;
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
    <div className="flex items-center justify-between gap-3 border-b border-console-border-soft py-2 last:border-b-0">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span
        className={`num text-right text-[12px] ${strong ? "font-bold text-console-ink" : "font-medium text-console-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

function BalanceLabel({ balance }: { balance: number }) {
  const roundedBalance = Math.round(balance);

  if (roundedBalance > 0) {
    return (
      <span className="num text-[13px] font-bold text-status-od-fg">
        Owes {formatIDR(balance)}
      </span>
    );
  }

  if (roundedBalance < 0) {
    return (
      <span className="num text-[13px] font-bold text-status-vd-fg">
        Credit {formatIDR(Math.abs(balance))}
      </span>
    );
  }

  return (
    <span className="num text-[13px] font-bold text-status-vc-fg">Settled</span>
  );
}

export function FolioSummary({
  folioId,
  status,
  reservationStatus,
  totals,
  serviceChargePercent,
  taxPercent,
}: FolioSummaryProps) {
  const isOpen = status === FolioStatus.OPEN;
  const canCheckOut = isOpen && reservationStatus === ReservationStatus.CHECKED_IN;

  return (
    <section className="min-w-0 border border-console-border bg-console-surface lg:sticky lg:top-4">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// SUMMARY"}
      </div>
      <div className="space-y-4 p-3.5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-600">
              [ Pendapatan ]
            </div>
            <SummaryRow label="Subtotal" value={formatIDR(totals.subtotal)} />
            <SummaryRow
              label={`Biaya Layanan (${serviceChargePercent}%)`}
              value={formatIDR(totals.serviceCharge)}
            />
            <SummaryRow
              label={`Pajak (${taxPercent}%)`}
              value={formatIDR(totals.tax)}
            />
            {Math.round(totals.taxableExtras) !== 0 ? (
              <SummaryRow
                label="Manual Tax/Service"
                value={formatIDR(totals.taxableExtras)}
              />
            ) : null}
            <SummaryRow
              label="Total Tagihan"
              value={formatIDR(totals.totalCharges)}
              strong
            />
          </div>

          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-600">
              [ Pembayaran ]
            </div>
            <SummaryRow
              label="Telah Dibayar"
              value={formatIDR(totals.totalPaid)}
            />
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-[11px] text-slate-600">Saldo</span>
              <BalanceLabel balance={totals.balance} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-console-border pt-3.5 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
          <RecordPaymentDialog
            folioId={folioId}
            balance={totals.balance}
            disabled={!isOpen}
          />
          {canCheckOut ? (
            <Link
              href={`/app/fo/check-out/${folioId}`}
              className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
            >
              Check Out
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
