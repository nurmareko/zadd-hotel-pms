import { NightAuditStatus } from "@prisma/client";
import { History } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatCompactDateID,
  formatCompactDateTimeID,
  formatFixedPercent,
  formatIDR,
} from "@/lib/format";

export type AuditHistoryRow = {
  id: number;
  businessDate: Date;
  status: NightAuditStatus;
  runAt: Date;
  occupancyRate: string;
  roomRevenue: string;
  fbRevenue: string;
  totalRevenue: string;
};

type AuditHistoryProps = {
  rows: AuditHistoryRow[];
};

function StatusBadge({ status }: { status: NightAuditStatus }) {
  const statusConfig = {
    [NightAuditStatus.COMPLETED]: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusConfig[status as keyof typeof statusConfig] || "bg-slate-100 text-slate-800")}>
      {status}
    </span>
  );
}

const headerCellClass = "bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const headerRightClass = "bg-background border-b border-border px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const bodyCellClass = "border-b border-border/60 px-4 py-3 align-top";

export function AuditHistory({ rows }: AuditHistoryProps) {
  return (
    <Card className="rounded-lg overflow-hidden p-0 min-w-0 max-w-full border border-border">
      <CardHeader className="border-b border-border rounded-none px-5 py-4 bg-card">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">Riwayat Audit</CardTitle>
      </CardHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat night audit"
          description="Audit yang sudah dijalankan akan tersimpan sebagai riwayat dan laporan."
          action={
            <Link
              className={buttonVariants({ size: "lg" })}
              href="/app/acc/night-audit"
            >
              Jalankan Night Audit
            </Link>
          }
          className="m-3.5"
        />
      ) : (
        <CardContent className="p-0">
          <div className="max-w-full overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={headerCellClass}>
                    Business Date
                  </th>
                  <th className={headerCellClass}>
                    Status
                  </th>
                  <th className={headerCellClass}>
                    Dijalankan
                  </th>
                  <th className={headerRightClass}>
                    Okupansi %
                  </th>
                  <th className={headerRightClass}>
                    Pendapatan Kamar
                  </th>
                  <th className={headerRightClass}>
                    Pendapatan F&B
                  </th>
                  <th className={headerRightClass}>
                    Total Pendapatan
                  </th>
                  <th className={headerRightClass}>
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
              {rows.map((row) => (
                <tr
                  className="odd:bg-white even:bg-slate-50 hover:bg-accent/50"
                  key={row.id}
                >
                  <td className={cn(bodyCellClass, "font-semibold text-foreground")}>
                    {formatCompactDateID(row.businessDate)}
                  </td>
                  <td className={bodyCellClass}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className={cn(bodyCellClass, "text-muted-foreground")}>
                    {formatCompactDateTimeID(row.runAt)}
                  </td>
                  <td className={cn(bodyCellClass, "text-right text-muted-foreground")}>
                    {formatFixedPercent(row.occupancyRate)}
                  </td>
                  <td className={cn(bodyCellClass, "text-right text-muted-foreground")}>
                    {formatIDR(row.roomRevenue)}
                  </td>
                  <td className={cn(bodyCellClass, "text-right text-muted-foreground")}>
                    {formatIDR(row.fbRevenue)}
                  </td>
                  <td className={cn(bodyCellClass, "text-right font-semibold text-foreground")}>
                    {formatIDR(row.totalRevenue)}
                  </td>
                  <td className={cn(bodyCellClass, "text-right")}>
                    <Link
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      href={`/app/acc/reports/${row.id}`}
                    >
                      Lihat Laporan
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
