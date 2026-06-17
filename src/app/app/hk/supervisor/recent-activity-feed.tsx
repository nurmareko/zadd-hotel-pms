import type { HousekeepingLog, RoomStatus, User, Room } from "@prisma/client";
import { History } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactMonthDayTimeID } from "@/lib/format";

type FeedLog = HousekeepingLog & {
  updatedBy: Pick<User, "fullName">;
  room: Pick<Room, "number">;
};

function transitionLabel(oldStatus: RoomStatus, newStatus: RoomStatus) {
  return `${oldStatus} → ${newStatus}`;
}

function logDescription(log: FeedLog) {
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

function logSecondaryLine(log: FeedLog) {
  return log.note ? `"${log.note}"` : null;
}

export function RecentActivityFeed({ logs }: { logs: FeedLog[] }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/50 rounded-t-2xl px-5 py-4 text-base font-semibold text-slate-900">
        Aktivitas Terkini (Global)
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada aktivitas"
          description="Perubahan status dan aktivitas pembersihan kamar di seluruh hotel akan muncul di sini."
          className="m-3.5"
        />
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          {logs.map((log) => (
            <ActivityRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityRow({ log }: { log: FeedLog }) {
  const secondaryLine = logSecondaryLine(log);

  return (
    <div className="grid gap-2 border-b border-slate-100 px-3 py-2.5 text-[12px] last:border-b-0 sm:grid-cols-[90px_60px_100px_minmax(0,1fr)] sm:items-start">
      <div className="num text-[11px] text-slate-500">
        {formatCompactMonthDayTimeID(log.updatedAt)}
      </div>
      <div>
        <Link
          href={`/app/hk/rooms/${log.roomId}`}
          className="inline-flex h-6 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {log.room.number}
        </Link>
      </div>
      <div className="truncate font-medium text-slate-900">
        {log.updatedBy.fullName}
      </div>
      <div className="min-w-0 text-slate-600">
        <span className="block font-semibold">{logDescription(log)}</span>
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
