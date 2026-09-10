import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { formatCompactDateTimeID } from "@/lib/format";

export type TodayAuditStatus = {
  id: number;
  runAt: Date;
  runByName: string;
};

type AuditStatusBannerProps = {
  todayAudit: TodayAuditStatus;
};

export function AuditStatusBanner({
  todayAudit,
}: AuditStatusBannerProps) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-5 text-emerald-900">
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
          className={buttonVariants({ variant: "outline" })}
          href={`/app/acc/reports/${todayAudit.id}`}
        >
          Lihat Laporan
        </Link>
      </div>
    </section>
  );
}
