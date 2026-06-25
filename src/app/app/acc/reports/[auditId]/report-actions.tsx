"use client";

import { Printer } from "lucide-react";

type ReportActionsProps = {
  auditId: number;
};

export function ReportActions({ auditId }: ReportActionsProps) {
  return (
    <button
      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      onClick={() => {
        window.location.href = `/api/night-audits/${auditId}/report`;
      }}
      type="button"
    >
      <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
      Cetak Laporan
    </button>
  );
}
