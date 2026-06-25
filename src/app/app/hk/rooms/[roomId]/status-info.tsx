import type { RoomStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactDateID } from "@/lib/format";

const statusDescriptions: Record<RoomStatus, string> = {
  VC: "VC — Vacant Clean, siap dijual",
  OC: "OC — Occupied Clean, tamu in-house dan bersih",
  VD: "VD — Vacant Dirty, perlu dibersihkan",
  OD: "OD — Occupied Dirty, perlu dibersihkan",
  VCU: "VCU — Vacant Clean Unchecked, menunggu inspeksi",
  OOO: "OOO — Out of Order, sedang tidak dapat digunakan",
};

function relativeDurationLabel(from: Date | null, to = new Date()) {
  if (!from) {
    return "—";
  }

  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));

  if (minutes < 60) {
    return `${minutes} menit yang lalu`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} jam yang lalu`;
  }

  return `${Math.floor(hours / 24)} hari yang lalu`;
}

function dateLabel(date: Date) {
  return formatCompactDateID(date);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-t border-border/60 py-2.5 first:border-t-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{value}</dd>
    </div>
  );
}

type StatusInfoProps = {
  status: RoomStatus;
  statusSince: Date | null;
  currentGuest: { guestName: string; notes: string | null } | null;
  recentGuest: { guestName: string; departureDate: Date } | null;
  upcomingReservation: {
    guestName: string;
    arrivalDate: Date;
    notes: string | null;
  } | null;
};

export function StatusInfo({
  status,
  statusSince,
  currentGuest,
  recentGuest,
  upcomingReservation,
}: StatusInfoProps) {
  return (
    <Card className="rounded-lg p-0">
      <CardHeader className="border-b border-border px-5 py-4 rounded-t-lg">
        <CardTitle className="text-base font-semibold">Status Saat Ini</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <dl className="px-5 py-2">
          <InfoRow label="Status" value={statusDescriptions[status]} />
          <InfoRow label="Sejak" value={relativeDurationLabel(statusSince)} />
          <InfoRow
            label="Tamu Saat Ini"
            value={
              currentGuest
                ? `${currentGuest.guestName}${currentGuest.notes ? ` · ${currentGuest.notes}` : ""}`
                : "—"
            }
          />
          <InfoRow
            label="Tamu Terakhir"
            value={
              recentGuest
                ? `${recentGuest.guestName} · check-out ${dateLabel(recentGuest.departureDate)}`
                : "—"
            }
          />
          <InfoRow
            label="Reservasi Berikutnya"
            value={
              upcomingReservation
                ? `${upcomingReservation.guestName} · tiba ${dateLabel(upcomingReservation.arrivalDate)}${upcomingReservation.notes ? ` · ${upcomingReservation.notes}` : ""}`
                : "—"
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}
