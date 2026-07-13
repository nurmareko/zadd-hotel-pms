"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

type ReportActionsProps = {
  auditId: number;
};

export function ReportActions({ auditId }: ReportActionsProps) {
  return (
    <Button
      onClick={() => {
        window.location.href = `/api/night-audits/${auditId}/report`;
      }}
      type="button"
      variant="outline"
    >
      <Printer aria-hidden="true" />
      Cetak Laporan
    </Button>
  );
}
