import {
  ArrangementType,
  FolioStatus,
  ReservationStatus,
  ReservationType,
} from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

import { StatusBadge } from "@/components/status-badge";
import { formatDateID } from "@/lib/format";

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

const reservationStatusClassNames: Record<ReservationStatus, string> = {
  [ReservationStatus.CONFIRMED]:
    "bg-status-oc-bg text-status-oc-fg border-status-oc-pip",
  [ReservationStatus.CHECKED_IN]:
    "bg-status-vc-bg text-status-vc-fg border-status-vc-pip",
  [ReservationStatus.CHECKED_OUT]:
    "bg-status-ooo-bg text-status-ooo-fg border-status-ooo-pip",
  [ReservationStatus.CANCELLED]:
    "bg-status-od-bg text-status-od-fg border-status-od-pip",
  [ReservationStatus.NO_SHOW]:
    "bg-status-vd-bg text-status-vd-fg border-status-vd-pip",
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
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="num text-right font-medium text-console-ink">{value}</span>
    </div>
  );
}

function FolioStatusBadge({ status }: { status: FolioStatus }) {
  return (
    <StatusBadge label={status} className={statusClassNames[status]} />
  );
}

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <StatusBadge
      label={status.replace("_", " ")}
      className={reservationStatusClassNames[status]}
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
    <section className="min-w-0 border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// Tamu"}
      </div>
      <div className="p-3.5 text-[13px]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[14px] font-semibold leading-tight text-console-ink">
            {reservation.guest.fullName}
          </h2>
          <FolioStatusBadge status={folio.status} />
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          {reservation.room?.number ?? "-"} / {reservation.roomType.name}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
          <span className="border border-console-border-soft px-1.5 py-0.5">
            Tipe Reservasi: {reservationTypeLabels[reservation.reservationType]}
          </span>
          <span className="border border-console-border-soft px-1.5 py-0.5">
            Arrangement: {arrangementLabels[reservation.arrangementType]}
          </span>
        </div>

        <div className="my-3 border-t border-console-border-soft" />
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
