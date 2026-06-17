import type { RoomStatus } from "@prisma/client";

import { formatCompactDateID } from "@/lib/format";

const statusDescriptions: Record<RoomStatus, string> = {
  VC: "VC - Vacant Clean, siap dijual",
  OC: "OC - Occupied Clean, tamu in-house dan bersih",
  VD: "VD - Vacant Dirty, perlu dibersihkan",
  OD: "OD - Occupied Dirty, perlu dibersihkan",
  VCU: "VCU - Vacant Clean Unchecked, menunggu inspeksi",
  OOO: "OOO - Out of Order, sedang tidak dapat digunakan",
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
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-t border-slate-100 py-2 first:border-t-0">
      <dt className="text-[10px] font-semibold font-medium tracking-tight text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 text-[12px] text-slate-900">{value}</dd>
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
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 px-3.5 py-3">
        <h2 className="text-[11px] font-bold font-medium tracking-tight text-blue-600">
          {"Status Saat Ini"}
        </h2>
      </div>
      <dl className="p-3.5">
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
    </section>
  );
}
