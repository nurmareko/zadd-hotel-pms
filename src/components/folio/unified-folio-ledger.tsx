"use client";

import { useId, useState } from "react";
import { ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatIDR } from "@/lib/format";
import { TransferChargeDialog, type TransferFolioOption } from "./transfer-charge-dialog";

export type FolioLedgerRow = {
  key: string;
  kind: "charges" | "payments";
  date: string;
  description: string;
  detail: string;
  article: string;
  category: string;
  tender: string;
  reference: string;
  operator: string;
  debit: number;
  credit: number;
  balance: number;
  transferLineItemId: number | null;
};

type LedgerFilter = "all" | "charges" | "payments";

export function UnifiedFolioLedger({
  rows,
  initialFilter = "all",
  transferFolios,
  folioId,
  balance,
}: {
  rows: FolioLedgerRow[];
  initialFilter?: LedgerFilter;
  transferFolios: TransferFolioOption[];
  folioId: number;
  balance: number;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const noteId = useId();
  const visibleRows = rows.filter((row) => filter === "all" || row.kind === filter);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Folio ledger</h2>
        <div role="group" aria-label="Filter folio entries" className="flex flex-wrap gap-2">
          {(["all", "charges", "payments"] as const).map((value) => (
            <Button key={value} type="button" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {{ all: "All", charges: "Charges", payments: "Payments" }[value]}
            </Button>
          ))}
        </div>
      </div>
      <p id={noteId} className="px-5 py-3 text-xs text-slate-500">
        Oldest first. Debits and credits include applicable service charge, tax, and whole-IDR rounding. Running balances include all entries, even when filtered. Negative balances indicate guest credit. Linked F&B charges cannot be transferred until accounting export supports transfer reversals.
      </p>
      <p role="status" className="sr-only">Showing {visibleRows.length} of {rows.length} entries.</p>
      {visibleRows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No folio entries" description="No transactions match this filter. Recorded charges and payments will appear here." className="m-5" />
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Folio transactions" aria-describedby={noteId}>
          <table className="w-full min-w-300 border-collapse text-sm">
            <caption className="sr-only">Chronological charges and payments with full-folio running balances</caption>
            <thead>
              <tr>
                {["Date", "Description", "Article", "Category", "Tender", "Reference", "Debit", "Credit", "Running balance", "Actions"].map((label, index) => (
                  <th key={label} scope="col" className={`bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 ${index >= 6 && index <= 8 ? "text-right" : "text-left"}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 even:bg-slate-50/50 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{row.date}</td>
                  <td className="min-w-64 px-4 py-3 text-slate-900">
                    <div className="font-medium">{row.description}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.detail}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.kind === "charges" ? "Posted" : "Received"} by {row.operator}</div>
                  </td>
                  <td className="px-4 py-3">{row.article}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.tender}</td>
                  <td className="max-w-64 break-words px-4 py-3">{row.reference}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{row.debit ? formatIDR(row.debit) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{row.credit ? formatIDR(row.credit) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatIDR(row.balance)}</td>
                  <td className="px-4 py-3">
                    {row.transferLineItemId !== null ? (
                      <TransferChargeDialog folioId={folioId} lineItemId={row.transferLineItemId} description={row.description} destinations={transferFolios} />
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 text-sm font-semibold">
        <span>Full folio balance</span>
        <span className="tabular-nums">{formatIDR(balance)}</span>
      </div>
    </section>
  );
}
