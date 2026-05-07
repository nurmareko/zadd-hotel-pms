import { ReservationStatus, RoomStatus, type Room } from "@prisma/client";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { notFound } from "next/navigation";

import { formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { CheckInForm } from "./check-in-form";

export const dynamic = "force-dynamic";

const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

type CheckInPageProps = {
  params: Promise<{ reservationId: string }>;
};

function dateLabel(date: Date) {
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
}

function ErrorState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Check-In
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">{title}</p>
      </div>

      <section className="border border-console-border bg-console-surface">
        <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          // Check-In Blocked
        </div>
        <div className="p-3.5 text-[12px] text-status-od-fg">{message}</div>
      </section>
    </main>
  );
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

function getArrivalDayAvailability(
  room: Room,
  occupiedRoomIds: Set<number>,
  reservationRoomId: number | null,
) {
  if (room.status === RoomStatus.OOO) {
    return false;
  }

  if (room.id === reservationRoomId) {
    return true;
  }

  return !occupiedRoomIds.has(room.id);
}

export default async function CheckInPage({ params }: CheckInPageProps) {
  const { reservationId } = await params;
  const parsedReservationId = Number(reservationId);

  if (!Number.isInteger(parsedReservationId) || parsedReservationId <= 0) {
    notFound();
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: parsedReservationId },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { id: true, number: true } },
      roomType: { select: { id: true, code: true, name: true } },
    },
  });

  if (!reservation) {
    notFound();
  }

  if (reservation.status !== ReservationStatus.CONFIRMED) {
    return (
      <ErrorState
        title={reservation.reservationNo}
        message="Reservation is not in confirmable state"
      />
    );
  }

  if (startOfDay(reservation.arrivalDate) > startOfDay(new Date())) {
    return (
      <ErrorState
        title={reservation.reservationNo}
        message="Arrival date is not eligible for check-in yet"
      />
    );
  }

  const arrivalDate = startOfDay(reservation.arrivalDate);
  const nextDate = new Date(arrivalDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const [roomsOfType, arrivalOverlaps] = await Promise.all([
    prisma.room.findMany({
      where: { roomTypeId: reservation.roomTypeId },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        id: { not: reservation.id },
        roomId: { not: null },
        status: { in: ACTIVE_RESERVATION_STATUSES },
        arrivalDate: { lt: nextDate },
        departureDate: { gt: arrivalDate },
      },
      select: { roomId: true },
    }),
  ]);

  const occupiedRoomIds = new Set(
    arrivalOverlaps
      .map((overlap) => overlap.roomId)
      .filter((roomId): roomId is number => roomId !== null),
  );
  const roomOptions = roomsOfType
    .filter((room) => reservation.roomId || getArrivalDayAvailability(room, occupiedRoomIds, null))
    .map((room) => ({
      id: room.id,
      number: room.number,
      floor: room.floor,
      status:
        room.status === RoomStatus.OOO
          ? "OOO"
          : occupiedRoomIds.has(room.id) && room.id !== reservation.roomId
            ? "Booked"
            : room.status,
      isAvailable: getArrivalDayAvailability(
        room,
        occupiedRoomIds,
        reservation.roomId,
      ),
    }));
  const availableRoomsCount = roomsOfType.filter((room) =>
    getArrivalDayAvailability(room, occupiedRoomIds, reservation.roomId),
  ).length;
  const nights = differenceInCalendarDays(
    reservation.departureDate,
    reservation.arrivalDate,
  );
  const rateAmount = reservation.rateAmount.toString();
  const totalStay = Number(rateAmount) * nights;

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Check-In
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Review reservation, assign a room, capture GRC, then open folio.
          </p>
        </div>
      </div>

      <div className="max-w-3xl space-y-3">
        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            // Reservation
          </div>
          <dl className="grid gap-3.5 p-3.5 sm:grid-cols-2">
            <DetailItem
              label="Reservation No"
              value={reservation.reservationNo}
            />
            <DetailItem label="Guest" value={reservation.guest.fullName} />
            <DetailItem
              label="Arrival"
              value={dateLabel(reservation.arrivalDate)}
            />
            <DetailItem
              label="Departure"
              value={dateLabel(reservation.departureDate)}
            />
            <DetailItem
              label="Room Type"
              value={`${reservation.roomType.code} - ${reservation.roomType.name}`}
            />
            <DetailItem label="Rate / Night" value={formatIDR(rateAmount)} />
            <DetailItem label="Total Nights" value={`${nights} night(s)`} />
            <DetailItem label="Room Total" value={formatIDR(totalStay)} />
            <DetailItem
              label="Adults / Children"
              value={`${reservation.adults} / ${reservation.children}`}
            />
            {reservation.notes ? (
              <div className="sm:col-span-2">
                <DetailItem label="Notes" value={reservation.notes} />
              </div>
            ) : null}
          </dl>
        </section>

        <CheckInForm
          reservationId={reservation.id}
          cancelHref={`/app/fo/reservations/${reservation.id}`}
          roomTypeName={reservation.roomType.name}
          arrivalLabel={dateLabel(reservation.arrivalDate)}
          assignedRoomId={reservation.roomId}
          existingDeposit={reservation.deposit.toString()}
          availableRoomsCount={availableRoomsCount}
          roomOptions={roomOptions}
        />
      </div>
    </main>
  );
}
