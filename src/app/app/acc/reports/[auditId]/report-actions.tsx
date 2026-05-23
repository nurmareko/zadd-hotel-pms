"use client";

import { Printer } from "lucide-react";

type ReportActionsProps = {
  auditId: number;
};

export function ReportActions({ auditId }: ReportActionsProps) {
  return (
    <button
      className="inline-flex h-8 items-center justify-center gap-2 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
      onClick={() => {
        window.location.href = `/api/night-audits/${auditId}/report`;
      }}
      type="button"
    >
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      Cetak Laporan
    </button>
  );
}
