import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { formatIDR } from "@/lib/format";

import type { NightAuditRunSummary } from "./actions";

type ResultPanelProps = {
  summary: NightAuditRunSummary;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-status-vc-pip/40 py-1.5">
      <span className="text-status-vc-fg/80">{label}</span>
      <span className="num font-semibold text-console-ink">{value}</span>
    </div>
  );
}

export function ResultPanel({ summary }: ResultPanelProps) {
  return (
    <section className="border border-status-vc-pip bg-status-vc-bg">
      <div className="border-b border-status-vc-pip bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// NIGHT AUDIT SELESAI"}
      </div>
      <div className="grid gap-3 p-3.5 text-[12px] text-status-vc-fg lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-[15px] font-bold uppercase tracking-[0.04em]">
                Business date terkunci
              </div>
              <p className="mt-1 leading-5">
                Night audit {summary.businessDateLabel} selesai.{" "}
                <span className="num font-semibold">
                  {summary.roomsCharged}
                </span>{" "}
                reservasi in-house dikenakan charge, dengan{" "}
                <span className="num font-semibold">
                  {summary.lineItemsPosted}
                </span>{" "}
                line item diposting.
              </p>
            </div>
          </div>

          {summary.warnings.length > 0 ? (
            <div className="mt-3 border border-status-vd-pip bg-status-vd-bg px-3 py-2 text-[11px] leading-5 text-status-vd-fg">
              {summary.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
              href={`/app/acc/reports/${summary.auditId}`}
            >
              Lihat Laporan
            </Link>
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              href="/app/acc"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>

        <aside className="border border-status-vc-pip bg-white p-3 text-[12px]">
          <SummaryRow label="Room revenue" value={formatIDR(summary.roomRevenue)} />
          <SummaryRow label="F&B revenue" value={formatIDR(summary.fbRevenue)} />
          <SummaryRow label="Other revenue" value={formatIDR(summary.otherRevenue)} />
          <div className="flex items-center justify-between gap-3 pt-2 text-[13px] font-bold uppercase tracking-[0.04em]">
            <span>Total revenue</span>
            <span className="num">{formatIDR(summary.totalRevenue)}</span>
          </div>
          <div className="mt-2 border-t border-console-border-soft pt-2 text-[11px] leading-5 text-slate-500">
            Transaction writes: {summary.transactionWriteCount} batched operation
            {summary.transactionWriteCount === 1 ? "" : "s"}.
          </div>
        </aside>
      </div>
    </section>
  );
}
