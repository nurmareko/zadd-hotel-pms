import type { HousekeepingLog, RoomStatus, User } from "@prisma/client";
import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactMonthDayTimeID } from "@/lib/format";

type HistoryLog = HousekeepingLog & {
  updatedBy: Pick<User, "fullName">;
};

function durationLabel(startedAt: Date, completedAt: Date) {
  const minutes = Math.max(
    1,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000),
  );

  return `${minutes} menit`;
}

function transitionLabel(oldStatus: RoomStatus, newStatus: RoomStatus) {
  return `${oldStatus} → ${newStatus}`;
}

function logDescription(log: HistoryLog) {
  if (log.cleaningStartedAt && log.cleaningCompletedAt) {
    return `${transitionLabel(log.oldStatus, log.newStatus)} (${durationLabel(
      log.cleaningStartedAt,
      log.cleaningCompletedAt,
    )})`;
  }

  if (log.cleaningStartedAt && !log.cleaningCompletedAt) {
    return `${transitionLabel(log.oldStatus, log.newStatus)} (sedang berjalan)`;
  }

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
  if (log.oldStatus === "VCU" && log.newStatus === "VD" && log.note) {
    return `"${log.note}"`;
  }

  if (!log.cleaningStartedAt || !log.cleaningCompletedAt) {
    return null;
  }

  const changeFlags = [
    log.linenChanged ? "sprei diganti" : null,
    log.towelChanged ? "handuk diganti" : null,
  ].filter(Boolean);
  const flags = changeFlags.length > 0 ? changeFlags.join(", ") : null;
  const note = log.note ? `"${log.note}"` : null;
  const details = [flags, note].filter(Boolean);

  return details.length > 0 ? details.join(" — ") : null;
}

export function RoomHistory({ logs }: { logs: HistoryLog[] }) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// Riwayat"}
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
    <div className="grid gap-1 border-t border-console-border-soft px-3.5 py-3 text-[12px] first:border-t-0 sm:grid-cols-[108px_110px_minmax(0,1fr)] sm:items-start">
      <div className="num text-[11px] text-slate-500">
        {formatCompactMonthDayTimeID(log.updatedAt)}
      </div>
      <div className="truncate font-medium text-console-ink">
        {log.updatedBy.fullName}
      </div>
      <div className="min-w-0 text-slate-600">
        <span>{logDescription(log)}</span>
        {secondaryLine ? (
          <span className="block pt-0.5 text-[11px] text-slate-500">
            {secondaryLine}
          </span>
        ) : null}
      </div>
    </div>
  );
}
