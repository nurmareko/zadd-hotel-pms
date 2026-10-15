import type { RoomStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactDateID } from "@/lib/format";

const statusDescriptions: Record<RoomStatus, string> = {
  VC: "VC — Vacant Clean, ready for sale",
  OC: "OC — Occupied Clean, guest in-house and room cleaned",
  VD: "VD — Vacant Dirty, requires cleaning",
  OD: "OD — Occupied Dirty, requires cleaning",
  VCU: "VCU — Vacant Clean Unchecked, awaiting inspection",
  OOO: "OOO — Out of Order, currently unavailable",
};

function relativeDurationLabel(from: Date | null, to = new Date()) {
  if (!from) {
    return "—";
  }

  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));

  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hours ago`;
  }

  return `${Math.floor(hours / 24)} days ago`;
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
        <CardTitle className="text-base font-semibold">Current Status</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <dl className="px-5 py-2">
          <InfoRow label="Status" value={statusDescriptions[status]} />
          <InfoRow label="Since" value={relativeDurationLabel(statusSince)} />
          <InfoRow
            label="Current Guest"
            value={
              currentGuest
                ? `${currentGuest.guestName}${currentGuest.notes ? ` · ${currentGuest.notes}` : ""}`
                : "—"
            }
          />
          <InfoRow
            label="Last Guest"
            value={
              recentGuest
                ? `${recentGuest.guestName} · check-out ${dateLabel(recentGuest.departureDate)}`
                : "—"
            }
          />
          <InfoRow
            label="Next Reservation"
            value={
              upcomingReservation
                ? `${upcomingReservation.guestName} · arriving ${dateLabel(upcomingReservation.arrivalDate)}${upcomingReservation.notes ? ` · ${upcomingReservation.notes}` : ""}`
                : "—"
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}
