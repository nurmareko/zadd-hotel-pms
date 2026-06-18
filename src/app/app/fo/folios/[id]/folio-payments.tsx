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
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-700">
        <h2 className="text-sm font-semibold">Pembayaran</h2>
        <span className="text-xs font-medium text-slate-500">
          {payments.length} pembayaran
        </span>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={WalletCards}
          title="Belum ada pembayaran"
          description="Pembayaran folio akan tercatat di sini setelah diterima."
          className="m-5"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Tanggal
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Metode
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Referensi
                </th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Diterima oleh
                </th>
                <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-slate-100 hover:bg-slate-50 even:bg-slate-50/50 last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {receivedAtLabel(payment.receivedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PaymentBadge method={payment.method} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-900">
                    {payment.reference ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {payment.receivedBy?.fullName ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">
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
