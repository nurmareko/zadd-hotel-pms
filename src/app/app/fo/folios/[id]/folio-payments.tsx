import { PaymentMethod } from "@prisma/client";
import { WalletCards } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatIDR, formatMonthDayTimeID } from "@/lib/format";

type FolioPayment = {
  id: number;
  amount: { toString(): string };
  method: PaymentMethod;
  reference: string | null;
  receivedAt: Date;
  receivedBy?: {
    fullName: string;
  } | null;
};

type FolioPaymentsProps = {
  payments: FolioPayment[];
};

const paymentClassNames: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "bg-status-vc-bg text-status-vc-fg border-status-vc-pip",
  [PaymentMethod.TRANSFER]:
    "bg-status-oc-bg text-status-oc-fg border-status-oc-pip",
  [PaymentMethod.CARD]: "bg-status-vd-bg text-status-vd-fg border-status-vd-pip",
  [PaymentMethod.CHARGE_TO_ROOM]:
    "bg-status-ooo-bg text-status-ooo-fg border-status-ooo-pip",
};

function receivedAtLabel(date: Date) {
  return formatMonthDayTimeID(date);
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  return (
    <StatusBadge label={method} className={paymentClassNames[method]} />
  );
}

export function FolioPayments({ payments }: FolioPaymentsProps) {
  return (
    <section className="min-w-0 border border-console-border bg-console-surface">
      <div className="flex items-center justify-between gap-3 bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        <h2>Payments</h2>
        <span className="num text-[10px] text-slate-400">
          {payments.length} pembayaran
        </span>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={WalletCards}
          title="Belum ada pembayaran"
          description="Pembayaran folio akan tercatat di sini setelah diterima."
          className="m-3.5"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full border-collapse text-[12px]">
            <thead className="bg-console-ink text-console-accent">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Tanggal
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Metode
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Referensi
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Diterima oleh
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-console-border-soft odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                >
                  <td className="num whitespace-nowrap px-3 py-2.5 text-slate-600">
                    {receivedAtLabel(payment.receivedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <PaymentBadge method={payment.method} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-console-ink">
                    {payment.reference ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                    {payment.receivedBy?.fullName ?? "-"}
                  </td>
                  <td className="num whitespace-nowrap px-3 py-2.5 text-right font-bold">
                    {formatIDR(payment.amount.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
