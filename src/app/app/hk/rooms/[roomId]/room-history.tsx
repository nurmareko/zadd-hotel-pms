import type { HousekeepingLog, RoomStatus, User } from "@prisma/client";
import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactMonthDayTimeID } from "@/lib/format";

type HistoryLog = HousekeepingLog & {
  updatedBy: Pick<User, "fullName">;
};

function transitionLabel(oldStatus: RoomStatus, newStatus: RoomStatus) {
  return `${oldStatus} → ${newStatus}`;
}

function logDescription(log: HistoryLog) {
  if (log.oldStatus === "VCU" && log.newStatus === "VC") {
    return `${transitionLabel(log.oldStatus, log.newStatus)} (lulus inspeksi)`;
  }

  if (log.oldStatus === "VCU" && log.newStatus === "VD") {
    return `${transitionLabel(log.oldStatus, log.newStatus)} (gagal inspeksi)`;
  }

  if ((log.oldStatus === "OOO" || log.newStatus === "OOO") && log.note) {
    return `${transitionLabel(log.oldStatus, log.newStatus)} (${log.note})`;
  }

  return transitionLabel(log.oldStatus, log.newStatus);
}

function logSecondaryLine(log: HistoryLog) {
  return log.note ? `"${log.note}"` : null;
}

export function RoomHistory({ logs }: { logs: HistoryLog[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/50 rounded-t-2xl px-5 py-4">
        <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">
          {"Riwayat"}
        </h2>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat kamar"
          description="Perubahan status dan aktivitas pembersihan kamar akan muncul di sini."
          className="m-3.5"
        />
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          {logs.map((log) => (
            <HistoryRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryRow({ log }: { log: HistoryLog }) {
  const secondaryLine = logSecondaryLine(log);

  return (
    <div className="grid gap-1 border-t border-slate-100 px-3.5 py-3 text-[12px] first:border-t-0 sm:grid-cols-[108px_110px_minmax(0,1fr)] sm:items-start">
      <div className="num text-[11px] text-slate-500">
        {formatCompactMonthDayTimeID(log.updatedAt)}
      </div>
      <div className="truncate font-medium text-slate-900">
        {log.updatedBy.fullName}
      </div>
      <div className="min-w-0 text-slate-600">
        <span>{logDescription(log)}</span>
        {secondaryLine ? (
          <span className="block pt-0.5 text-[11px] text-slate-500">
            {secondaryLine}
          </span>
        ) : null}
        {log.linenChanged || log.towelChanged ? (
          <div className="mt-1 text-[11px] text-slate-400">
            <span className="block font-semibold">Amenities diganti:</span>
            <ul className="list-inside list-disc pl-1 mt-0.5 space-y-0.5 font-inter italic">
              {log.linenChanged && <li>Linen / Seprei</li>}
              {log.towelChanged && <li>Handuk</li>}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
