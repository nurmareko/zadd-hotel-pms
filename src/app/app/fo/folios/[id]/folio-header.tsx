import {
  ArrangementType,
  FolioStatus,
  ReservationStatus,
  ReservationType,
} from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

import { StatusBadge } from "@/components/status-badge";
import { formatDateID } from "@/lib/format";
import { hasSharedReservationStatusColor } from "@/lib/reservation-status-colors";

type FolioHeaderProps = {
  folio: {
    folioNo: string;
    status: FolioStatus;
    openedAt: Date;
    closedAt: Date | null;
    reservation: {
      reservationNo: string;
      arrangementType: ArrangementType;
      reservationType: ReservationType;
      arrivalDate: Date;
      departureDate: Date;
      status: ReservationStatus;
      guest: {
        fullName: string;
        phone: string | null;
      };
      room: {
        number: string;
      } | null;
      roomType: {
        code: string;
        name: string;
      };
    };
  };
};

const statusClassNames: Record<FolioStatus, string> = {
  [FolioStatus.OPEN]: "bg-status-oc-bg text-status-oc-fg border-status-oc-pip",
  [FolioStatus.CLOSED]:
    "bg-status-ooo-bg text-status-ooo-fg border-status-ooo-pip",
  [FolioStatus.VOIDED]: "bg-status-od-bg text-status-od-fg border-status-od-pip",
};

const reservationTypeLabels: Record<ReservationType, string> = {
  [ReservationType.INDIVIDUAL]: "Individual",
  [ReservationType.COMPANY]: "Company",
  [ReservationType.GOVERNMENT]: "Government",
  [ReservationType.OTA]: "Online Travel Agent",
  [ReservationType.WALK_IN]: "Walk-in",
};

const arrangementLabels: Record<ArrangementType, string> = {
  [ArrangementType.RO]: "RO",
  [ArrangementType.RB]: "RB (+ Breakfast)",
  [ArrangementType.FBM]: "FBM (+ Breakfast, Coffee Break, Lunch, Dinner)",
};

function dateLabel(date: Date) {
  return formatDateID(date);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function FolioStatusBadge({ status }: { status: FolioStatus }) {
  return (
    <StatusBadge label={status} className={statusClassNames[status]} />
  );
}

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  if (hasSharedReservationStatusColor(status)) {
    return (
      <StatusBadge
        label={status.replaceAll("_", " ")}
        reservationStatus={status}
      />
    );
  }

  return (
    <StatusBadge
      label={status.replaceAll("_", " ")}
      className="bg-status-vd-bg text-status-vd-fg border-status-vd-pip"
    />
  );
}

export function FolioHeader({ folio }: FolioHeaderProps) {
  const { reservation } = folio;
  const nights = differenceInCalendarDays(
    reservation.departureDate,
    reservation.arrivalDate,
  );

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
        {"Tamu"}
      </div>
      <div className="p-5 text-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold leading-tight text-slate-900">
            {reservation.guest.fullName}
          </h2>
          <FolioStatusBadge status={folio.status} />
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {reservation.room?.number ?? "-"} / {reservation.roomType.name}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded border border-slate-200 px-2 py-0.5 bg-slate-50">
            Tipe Reservasi: {reservationTypeLabels[reservation.reservationType]}
          </span>
          <span className="rounded border border-slate-200 px-2 py-0.5 bg-slate-50">
            Arrangement: {arrangementLabels[reservation.arrangementType]}
          </span>
        </div>

        <div className="my-4 border-t border-slate-100" />
        <InfoRow label="Reservasi" value={reservation.reservationNo} />
        <InfoRow label="Telepon" value={reservation.guest.phone ?? "-"} />
        <InfoRow
          label="Status"
          value={<ReservationStatusBadge status={reservation.status} />}
        />
        <InfoRow
          label="Periode"
          value={`${dateLabel(reservation.arrivalDate)} → ${dateLabel(
            reservation.departureDate,
          )}`}
        />
        <InfoRow label="Malam" value={String(nights)} />
      </div>
    </section>
  );
}
