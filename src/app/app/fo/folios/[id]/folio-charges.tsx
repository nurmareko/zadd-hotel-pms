import { FolioStatus, type ArticleType } from "@prisma/client";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";

import { formatIDR } from "@/lib/format";
import {
  AddChargeDialog,
  type ChargeArticleOption,
} from "./add-charge-dialog";

type FolioChargeLineItem = {
  id: number;
  description: string;
  quantity: { toString(): string };
  unitPrice: { toString(): string };
  amount: { toString(): string };
  postedAt: Date;
  article: {
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
  folioId: number;
  status: FolioStatus;
  lineItems: FolioChargeLineItem[];
  articles: ChargeArticleOption[];
};

const qtyFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

function postedAtLabel(date: Date) {
  return format(date, "dd MMM HH:mm", { locale: indonesianLocale });
}

function descriptionLabel(lineItem: FolioChargeLineItem) {
  const base = lineItem.description || lineItem.article.name;

  return lineItem.fbOrder ? `${base} - Order ${lineItem.fbOrder.orderNo}` : base;
}

export function FolioCharges({
  folioId,
  status,
  lineItems,
  articles,
}: FolioChargesProps) {
  return (
    <section className="min-w-0 border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        // CHARGES
      </div>
      <div className="space-y-3.5 p-3.5">
        <div className="flex justify-end">
          <AddChargeDialog
            folioId={folioId}
            articles={articles}
            disabled={status !== FolioStatus.OPEN}
          />
        </div>

        {lineItems.length === 0 ? (
          <div className="border border-dashed border-console-border bg-console-bg px-3 py-8 text-center text-[12px] text-slate-500">
            No charges posted yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-console-border">
            <table className="min-w-[720px] w-full border-collapse text-[12px]">
              <thead className="bg-console-ink text-console-accent">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Date
                  </th>
                  <th className="min-w-64 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Description
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Posted by
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
                    <td className="px-3 py-2.5 font-medium text-console-ink">
                      {descriptionLabel(lineItem)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {lineItem.postedBy.fullName}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                      {qtyFormatter.format(Number(lineItem.quantity))}
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
