import { FolioStatus, ReservationStatus } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";

type FolioHeaderProps = {
  folio: {
    folioNo: string;
    status: FolioStatus;
    openedAt: Date;
    closedAt: Date | null;
    reservation: {
      reservationNo: string;
      arrivalDate: Date;
      departureDate: Date;
      status: ReservationStatus;
      guest: {
        fullName: string;
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

function dateLabel(date: Date) {
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
}

function dateTimeLabel(date: Date) {
  return format(date, "dd MMM yyyy HH:mm", { locale: indonesianLocale });
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-[12px] font-medium text-console-ink">{value}</dd>
    </div>
  );
}

function FolioStatusBadge({ status }: { status: FolioStatus }) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusClassNames[status]}`}
    >
      <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

export function FolioHeader({ folio }: FolioHeaderProps) {
  const { reservation } = folio;
  const nights = differenceInCalendarDays(
    reservation.departureDate,
    reservation.arrivalDate,
  );
  const stayHint =
    reservation.status === ReservationStatus.CHECKED_IN
      ? `In-house since ${dateTimeLabel(folio.openedAt)}`
      : reservation.status === ReservationStatus.CHECKED_OUT && folio.closedAt
        ? `Checked out ${dateTimeLabel(folio.closedAt)}`
        : null;

  return (
    <section className="min-w-0 border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        // GUEST
      </div>
      <div className="space-y-3.5 p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[22px] font-bold leading-tight text-console-ink">
              {reservation.guest.fullName}
            </h2>
            {stayHint ? (
              <p className="mt-1 text-[11px] text-slate-500">{stayHint}</p>
            ) : null}
          </div>
          <FolioStatusBadge status={folio.status} />
        </div>

        <dl className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Reservation No" value={reservation.reservationNo} />
          <DetailItem label="Folio No" value={folio.folioNo} />
          <DetailItem
            label="Room"
            value={`${reservation.room?.number ?? "-"} / ${reservation.roomType.code} - ${reservation.roomType.name}`}
          />
          <DetailItem label="Nights" value={`${nights} night(s)`} />
          <DetailItem
            label="Arrival"
            value={dateLabel(reservation.arrivalDate)}
          />
          <DetailItem
            label="Departure"
            value={dateLabel(reservation.departureDate)}
          />
        </dl>
      </div>
    </section>
  );
}
