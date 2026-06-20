import type { HousekeepingLog, RoomStatus, User } from "@prisma/client";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="rounded-2xl p-0">
      <CardHeader className="border-b border-border px-5 py-4 rounded-t-2xl">
        <CardTitle className="text-base font-semibold">Riwayat</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <EmptyState
            icon={History}
            title="Belum ada riwayat kamar"
            description="Perubahan status dan aktivitas pembersihan kamar akan muncul di sini."
            className="m-4"
          />
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {logs.map((log) => (
              <HistoryRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryRow({ log }: { log: HistoryLog }) {
  const secondaryLine = logSecondaryLine(log);

  return (
    <div className="grid gap-1 border-t border-border/60 px-5 py-3 text-sm first:border-t-0 sm:grid-cols-[108px_110px_minmax(0,1fr)] sm:items-start">
      <div className="text-xs text-muted-foreground">
        {formatCompactMonthDayTimeID(log.updatedAt)}
      </div>
      <div className="truncate text-sm font-medium text-foreground">
        {log.updatedBy.fullName}
      </div>
      <div className="min-w-0 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{logDescription(log)}</span>
        {secondaryLine ? (
          <span className="block pt-0.5 text-xs text-muted-foreground">
            {secondaryLine}
          </span>
        ) : null}
        {log.linenChanged || log.towelChanged ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {log.linenChanged && (
              <Badge variant="secondary" className="text-xs rounded-full">Linen</Badge>
            )}
            {log.towelChanged && (
              <Badge variant="secondary" className="text-xs rounded-full">Handuk</Badge>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
