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
    <section className="min-w-0 border border-console-border bg-console-surface">
      <div className="flex items-center justify-between gap-3 bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        <h2>Charges</h2>
        <div className="flex items-center gap-2">
          <span className="num text-[10px] text-slate-400">
            {lineItems.length} line items
          </span>
          <FolioStatusBadge status={status} />
        </div>
      </div>
      <div className="p-0">

        {lineItems.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Belum ada tagihan"
            description="Line item folio akan muncul setelah charge diposting."
            className="m-3.5"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-[12px]">
              <thead className="bg-console-ink text-console-accent">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Code
                  </th>
                  <th className="min-w-64 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Description
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Unit Price
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((lineItem) => (
                  <tr
                    key={lineItem.id}
                    className="border-b border-console-border-soft odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {postedAtLabel(lineItem.postedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-console-ink">
                      {lineItem.article.code}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-console-ink">
                      {descriptionLabel(lineItem)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                      {formatDecimalID(lineItem.quantity.toString())}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                      {formatIDR(lineItem.unitPrice.toString())}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right font-bold">
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
