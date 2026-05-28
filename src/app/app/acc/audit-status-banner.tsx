import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactDateTimeID } from "@/lib/format";

export type TodayAuditStatus = {
  id: number;
  runAt: Date;
  runByName: string;
} | null;

type AuditStatusBannerProps = {
  businessDateLabel: string;
  todayAudit: TodayAuditStatus;
};

export function AuditStatusBanner({
  businessDateLabel,
  todayAudit,
}: AuditStatusBannerProps) {
  if (todayAudit) {
    return (
      <section className="border border-status-vc-pip bg-status-vc-bg p-3.5 text-status-vc-fg">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em]">
              Night audit selesai
            </div>
            <p className="mt-1 text-[12px]">
              {formatCompactDateTimeID(todayAudit.runAt)}{" "}
              oleh {todayAudit.runByName}
            </p>
          </div>
          <Link
            className="inline-flex h-8 items-center justify-center border border-status-vc-pip bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-status-vc-fg hover:border-console-ink"
            href={`/app/acc/reports/${todayAudit.id}`}
          >
            Lihat Laporan
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-console-border bg-console-surface p-3.5">
      <EmptyState
        icon={ClipboardCheck}
        title="Night audit belum dijalankan"
        description={`Night audit untuk ${businessDateLabel} belum dijalankan.`}
        action={
        <Link
          className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          href="/app/acc/night-audit"
        >
          Jalankan Night Audit
        </Link>
        }
        className="min-h-0 border-0 bg-console-bg py-4"
      />
    </section>
  );
}
