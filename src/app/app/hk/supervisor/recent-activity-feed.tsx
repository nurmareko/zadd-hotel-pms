import type { HousekeepingLog, RoomStatus, User, Room } from "@prisma/client";
import { History } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
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
    <Card className="mb-4 rounded-2xl overflow-hidden p-0">
      <CardHeader className="border-b border-border rounded-none px-5 py-4">
        <CardTitle className="text-base font-semibold">
          Aktivitas Terkini (Global)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <EmptyState
            icon={History}
            title="Belum ada aktivitas"
            description="Perubahan status dan aktivitas pembersihan kamar di seluruh hotel akan muncul di sini."
            className="m-4"
          />
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {logs.map((log) => (
              <ActivityRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ log }: { log: FeedLog }) {
  const secondaryLine = logSecondaryLine(log);

  return (
    <div className="grid gap-2 border-b border-border/60 px-5 py-3 text-sm last:border-b-0 sm:grid-cols-[90px_60px_100px_minmax(0,1fr)] sm:items-start">
      <div className="text-xs text-muted-foreground">
        {formatCompactMonthDayTimeID(log.updatedAt)}
      </div>
      <div>
        <Link
          href={`/app/hk/rooms/${log.roomId}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "xs" }),
            "rounded-lg font-semibold"
          )}
        >
          {log.room.number}
        </Link>
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
