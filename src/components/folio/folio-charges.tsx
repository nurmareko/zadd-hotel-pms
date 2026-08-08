import { FolioStatus, type ArticleType } from "@prisma/client";
import { ReceiptText } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatIDR, formatMonthDayTimeID, formatDecimalID } from "@/lib/format";

type FolioChargeLineItem = {
  id: number;
  description: string;
  quantity: { toString(): string };
  unitPrice: { toString(): string };
  amount: { toString(): string };
  postedAt: Date;
  article: {
    code: string;
    name: string;
    type: ArticleType;
  };
  postedBy: {
    fullName: string;
  };
  fbOrder: {
    orderNo: string;
  } | null;
};

type FolioChargesProps = {
  status: FolioStatus;
  lineItems: FolioChargeLineItem[];
};

function postedAtLabel(date: Date) {
  return formatMonthDayTimeID(date);
}

function descriptionLabel(lineItem: FolioChargeLineItem) {
  const base = lineItem.description || lineItem.article.name;

  return lineItem.fbOrder ? `${base} - Order ${lineItem.fbOrder.orderNo}` : base;
}

const statusClassNames: Record<FolioStatus, string> = {
  [FolioStatus.OPEN]: "bg-status-oc-bg text-status-oc-fg border-status-oc-pip",
  [FolioStatus.CLOSED]:
    "bg-status-ooo-bg text-status-ooo-fg border-status-ooo-pip",
  [FolioStatus.VOIDED]: "bg-status-od-bg text-status-od-fg border-status-od-pip",
};

function FolioStatusBadge({ status }: { status: FolioStatus }) {
  return (
    <StatusBadge label={status} className={statusClassNames[status]} />
  );
}

export function FolioCharges({ status, lineItems }: FolioChargesProps) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-700">
        <h2 className="text-sm font-semibold">Tagihan</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {lineItems.length} baris
          </span>
          <FolioStatusBadge status={status} />
        </div>
      </div>
      <div className="p-0">

        {lineItems.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Belum ada tagihan"
            description="Baris folio akan muncul setelah tagihan dicatat."
            className="m-5"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Tanggal
                  </th>
                  <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Artikel
                  </th>
                  <th className="min-w-64 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Deskripsi
                  </th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                    Jumlah
                  </th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                    Harga satuan
                  </th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">
                    Nilai
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((lineItem) => (
                  <tr
                    key={lineItem.id}
                    className="border-b border-slate-100 hover:bg-slate-50 even:bg-slate-50/50 last:border-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {postedAtLabel(lineItem.postedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {lineItem.article.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {descriptionLabel(lineItem)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatDecimalID(lineItem.quantity.toString())}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatIDR(lineItem.unitPrice.toString())}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">
                      {formatIDR(lineItem.amount.toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
