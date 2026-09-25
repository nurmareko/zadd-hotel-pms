import type { ActivityAction, Prisma } from "@prisma/client";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { activityLabels, activitySummary, activityTime } from "./activity-log-display";

type ActivityRow = {
  id: number;
  action: ActivityAction;
  createdAt: Date;
  metadata: Prisma.JsonValue;
  user: { id: number; fullName: string; username: string };
  reservation: { id: number; reservationNo: string; guest: { fullName: string } } | null;
  room: { id: number; number: string } | null;
  folio: { id: number; folioNo: string; reservationId: number } | null;
};

const actionColors = {
  RESERVATION_CREATED: "bg-blue-50 text-blue-700 ring-blue-200",
  RESERVATION_UPDATED: "bg-amber-50 text-amber-800 ring-amber-200",
  RESERVATION_CANCELLED: "bg-red-50 text-red-700 ring-red-200",
  CHECK_IN_COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CHECK_OUT_COMPLETED: "bg-slate-100 text-slate-700 ring-slate-200",
  PAYMENT_RECORDED: "bg-green-50 text-green-700 ring-green-200",
  FOLIO_CHARGE_POSTED: "bg-orange-50 text-orange-800 ring-orange-200",
} satisfies Record<ActivityAction, string>;

function ActionBadge({ action }: { action: ActivityAction }) {
  return <Badge className={cn("rounded-full", actionColors[action])}>{activityLabels[action]}</Badge>;
}

function RelatedRecords({ activity }: { activity: ActivityRow }) {
  const linkClass = cn(badgeVariants({ variant: "outline" }), "max-w-full rounded-full whitespace-normal break-words hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {activity.reservation && <Link className={linkClass} href={`/app/fo/reservasi/${activity.reservation.id}`}>Reservasi {activity.reservation.reservationNo}</Link>}
        {activity.room && <Link className={linkClass} href={`/app/hk/rooms/${activity.room.id}`}>Kamar {activity.room.number}</Link>}
        {activity.folio && <Link className={linkClass} href={`/app/fo/reservasi/${activity.folio.reservationId}?tab=tagihan`}>Folio {activity.folio.folioNo}</Link>}
        {!activity.reservation && !activity.room && !activity.folio && <span className="text-muted-foreground">—</span>}
      </div>
      {activity.reservation && <p className="break-words text-xs text-muted-foreground">Tamu: {activity.reservation.guest.fullName}</p>}
    </div>
  );
}

export function ActivityLogTable({ activities, filtered }: { activities: ActivityRow[]; filtered: boolean }) {
  if (activities.length === 0) {
    return (
      <div role="status" className="space-y-2 px-4 py-12 text-center">
        <ClipboardList aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <h2 className="font-semibold">{filtered ? "Tidak ada aktivitas yang sesuai" : "Belum ada aktivitas"}</h2>
        <p className="text-sm text-muted-foreground">{filtered ? "Ubah atau reset filter untuk melihat aktivitas lainnya." : "Aktivitas yang tercatat akan ditampilkan di sini."}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto desktop:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Log aktivitas pengguna, terbaru terlebih dahulu</caption>
          <thead className="border-b bg-slate-50 text-xs text-muted-foreground">
            <tr>{["Waktu", "Pengguna", "Aksi", "Terkait", "Ringkasan"].map((label) => <th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id} className="border-b align-top last:border-0 hover:bg-slate-50/70">
                <td className="px-4 py-3 tabular-nums"><time dateTime={activity.createdAt.toISOString()}>{activityTime(activity.createdAt)}</time></td>
                <td className="px-4 py-3"><p className="break-words font-medium">{activity.user.fullName}</p><p className="mt-1 break-words text-xs text-muted-foreground">@{activity.user.username}</p></td>
                <td className="px-4 py-3"><ActionBadge action={activity.action} /></td>
                <td className="px-4 py-3"><RelatedRecords activity={activity} /></td>
                <td className="max-w-sm break-words px-4 py-3 text-muted-foreground">{activitySummary(activity.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y desktop:hidden">
        {activities.map((activity) => (
          <article key={activity.id} className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm"><ActionBadge action={activity.action} /></h2>
              <time dateTime={activity.createdAt.toISOString()} className="text-xs tabular-nums text-muted-foreground">{activityTime(activity.createdAt)}</time>
            </div>
            <p className="break-words font-medium">{activity.user.fullName} <span className="font-normal text-muted-foreground">(@{activity.user.username})</span></p>
            <RelatedRecords activity={activity} />
            <p className="break-words text-muted-foreground">{activitySummary(activity.metadata)}</p>
          </article>
        ))}
      </div>
    </>
  );
}
