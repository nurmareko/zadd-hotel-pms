import { NightAuditStatus } from "@prisma/client";
import { History } from "lucide-react";
import Link from "next/link";

import { StatusBadge as SharedStatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
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
  return (
    <SharedStatusBadge
      label={status}
      className="border-status-vc-pip bg-status-vc-bg text-status-vc-fg"
      pipClassName="bg-status-vc-pip"
    />
  );
}

export function AuditHistory({ rows }: AuditHistoryProps) {
  return (
    <section className="min-w-0 max-w-full border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"RIWAYAT AUDIT"}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat night audit"
          description="Audit yang sudah dijalankan akan tersimpan sebagai riwayat dan laporan."
          action={
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
              href="/app/acc/night-audit"
            >
              Jalankan Night Audit
            </Link>
          }
          className="m-3.5"
        />
      ) : (
        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Business Date
                </th>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Status
                </th>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Dijalankan
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Okupansi %
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Pendapatan Kamar
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Pendapatan F&B
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Total Pendapatan
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  className="border-b border-console-border-soft odd:bg-white even:bg-console-bg hover:bg-status-vc-bg"
                  key={row.id}
                >
                  <td className="num px-3 py-[9px] font-semibold text-console-ink">
                    {formatCompactDateID(row.businessDate)}
                  </td>
                  <td className="px-3 py-[9px]">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="num px-3 py-[9px] text-slate-700">
                    {formatCompactDateTimeID(row.runAt)}
                  </td>
                  <td className="num px-3 py-[9px] text-right text-slate-700">
                    {formatFixedPercent(row.occupancyRate)}
                  </td>
                  <td className="num px-3 py-[9px] text-right text-slate-700">
                    {formatIDR(row.roomRevenue)}
                  </td>
                  <td className="num px-3 py-[9px] text-right text-slate-700">
                    {formatIDR(row.fbRevenue)}
                  </td>
                  <td className="num px-3 py-[9px] text-right font-semibold text-console-ink">
                    {formatIDR(row.totalRevenue)}
                  </td>
                  <td className="px-3 py-[9px] text-right">
                    <Link
                      className="inline-flex h-7 items-center border border-console-border bg-white px-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
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
      )}
    </section>
  );
}
