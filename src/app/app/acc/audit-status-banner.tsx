import { ClipboardCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactDateTimeID } from "@/lib/format";
import { cn } from "@/lib/utils";

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
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 text-emerald-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold tracking-wide uppercase text-emerald-800">
                Night audit selesai
              </div>
              <p className="mt-1 text-sm text-emerald-700">
                {formatCompactDateTimeID(todayAudit.runAt)}{" "}
                oleh {todayAudit.runByName}
              </p>
            </div>
          </div>
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-white/50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-900")}
            href={`/app/acc/reports/${todayAudit.id}`}
          >
            Lihat Laporan
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-2">
      <EmptyState
        icon={ClipboardCheck}
        title="Night audit belum dijalankan"
        description={`Night audit untuk ${businessDateLabel} belum dijalankan.`}
        action={
          <Link
            className={buttonVariants({ size: "lg" })}
            href="/app/acc/night-audit"
          >
            Jalankan Night Audit
          </Link>
        }
        className="border-0 bg-transparent py-6"
      />
    </section>
  );
}
