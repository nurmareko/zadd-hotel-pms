import type { HousekeepingLog, RoomStatus, User } from "@prisma/client";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";

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

export function RoomHistory({ logs }: { logs: HistoryLog[] }) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// Riwayat"}
        </h2>
      </div>

      {logs.length === 0 ? (
        <div className="p-3.5 text-[12px] text-slate-500">
          Belum ada riwayat untuk kamar ini.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="grid gap-1 border-t border-console-border-soft px-3.5 py-3 text-[12px] first:border-t-0 sm:grid-cols-[108px_110px_minmax(0,1fr)] sm:items-start"
            >
              <div className="num text-[11px] text-slate-500">
                {format(log.updatedAt, "d MMM, HH:mm", {
                  locale: indonesianLocale,
                })}
              </div>
              <div className="truncate font-medium text-console-ink">
                {log.updatedBy.fullName}
              </div>
              <div className="min-w-0 text-slate-600">
                <span>{logDescription(log)}</span>
                {log.note &&
                !(log.oldStatus === "OOO" || log.newStatus === "OOO") ? (
                  <span className="block pt-0.5 text-[11px] text-slate-500">
                    {log.note}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
