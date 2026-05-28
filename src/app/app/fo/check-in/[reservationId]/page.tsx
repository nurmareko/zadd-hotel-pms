import { ReservationStatus, RoomStatus, type Room } from "@prisma/client";
import { addDays, differenceInCalendarDays } from "date-fns";
import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { formatDateID } from "@/lib/format";
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
  return formatDateID(date);
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
          {"// Check-In Blocked"}
        </div>
        <div className="p-3.5 text-[12px] text-status-od-fg">{message}</div>
      </section>
    </main>
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
      guest: {
        select: {
          fullName: true,
          idNumber: true,
          phone: true,
          email: true,
          nationality: true,
        },
      },
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

  const arrivalDate = dateOnlyBoundary(reservation.arrivalDate);
  const { today } = todayDateOnly();

  if (arrivalDate > today) {
    return (
      <ErrorState
        title={reservation.reservationNo}
        message="Arrival date is not eligible for check-in yet"
      />
    );
  }

  const nextDate = addDays(arrivalDate, 1);

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
    .filter(
      (room) =>
        reservation.roomId ||
        getArrivalDayAvailability(room, occupiedRoomIds, null),
    )
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
  const arrivalLabel = dateLabel(reservation.arrivalDate);
  const departureLabel = dateLabel(reservation.departureDate);

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Check-In · {reservation.guest.fullName}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {reservation.reservationNo} · {reservation.roomType.name} ·{" "}
            {arrivalLabel} → {departureLabel} ({nights} malam)
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
            href={`/app/fo/reservations/${reservation.id}`}
            className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Batal
          </Link>
          <a
            href={`/api/reservations/${reservation.id}/grc`}
            download
            className="inline-flex h-8 items-center justify-center gap-2 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Cetak GRC
          </a>
        </div>
      </div>

      <div className="max-w-6xl">
        <CheckInForm
          reservationId={reservation.id}
          reservationNo={reservation.reservationNo}
          guest={{
            fullName: reservation.guest.fullName,
            idNumber: reservation.guest.idNumber,
            phone: reservation.guest.phone,
            email: reservation.guest.email,
            nationality: reservation.guest.nationality,
          }}
          roomTypeName={reservation.roomType.name}
          arrivalLabel={arrivalLabel}
          departureLabel={departureLabel}
          nights={nights}
          totalStay={totalStay}
          assignedRoomId={reservation.roomId}
          assignedRoomNumber={reservation.room?.number ?? null}
          existingDeposit={reservation.deposit.toString()}
          availableRoomsCount={availableRoomsCount}
          roomOptions={roomOptions}
        />
      </div>
    </main>
  );
}
