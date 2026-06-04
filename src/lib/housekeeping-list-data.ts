import { ReservationStatus, RoomStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

import { todayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

export type HousekeepingCleaningState = RoomStatus | "IN_PROGRESS";

export type HousekeepingReservationContextKind =
  | "arrival"
  | "departure"
  | "stayover";

export type HousekeepingReservationContext = {
  kind: HousekeepingReservationContextKind;
  label: string;
  reservationNo: string;
  guestName: string;
  nightsLabel: string;
  etaLabel: string | null;
};

export type HousekeepingAddOn = {
  label: string;
  delivered: boolean;
};

export type HousekeepingListRow = {
  room: {
    id: number;
    number: string;
    floor: number;
    typeName: string;
    typeCode: string;
    status: RoomStatus;
  };
  cleaningState: HousekeepingCleaningState;
  serviceLabel: string;
  reservationContexts: HousekeepingReservationContext[];
  note: {
    reservationNo: string;
    etaLabel: string | null;
    housekeepingNote: string | null;
  } | null;
  addOns: HousekeepingAddOn[];
  assignedHousekeeper: {
    id: number;
    name: string;
    initials: string;
  } | null;
};

export type HousekeepingListData = {
  date: Date;
  rows: HousekeepingListRow[];
};

type ReservationCandidate = {
  id: number;
  reservationNo: string;
  arrivalDate: Date;
  departureDate: Date;
  status: ReservationStatus;
  roomId: number | null;
  notes: string | null;
  comment: string | null;
  housekeepingNote: string | null;
  guest: { fullName: string };
  addOns: Array<{ label: string; delivered: boolean }>;
};

const roomNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function initialsFromName(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || name.slice(0, 2).toUpperCase();
}

function nightsLabel(arrivalDate: Date, departureDate: Date) {
  const nights = Math.max(
    1,
    differenceInCalendarDays(departureDate, arrivalDate),
  );

  return nights === 1 ? "1 night" : `${nights} nights`;
}

function stayoverNightsLabel(
  date: Date,
  arrivalDate: Date,
  departureDate: Date,
) {
  const currentNight = Math.max(
    1,
    differenceInCalendarDays(date, arrivalDate) + 1,
  );
  const totalNights = Math.max(
    1,
    differenceInCalendarDays(departureDate, arrivalDate),
  );

  return `Night ${Math.min(currentNight, totalNights)}/${totalNights}`;
}

function etaFromReservation(reservation: ReservationCandidate) {
  const candidate = reservation.notes ?? reservation.comment;
  const etaMatch = candidate?.match(/\bETA\s*:?\s*([0-2]?\d:[0-5]\d)\b/i);

  return etaMatch?.[1] ?? null;
}

function contextForReservation(
  kind: HousekeepingReservationContextKind,
  reservation: ReservationCandidate,
  date: Date,
): HousekeepingReservationContext {
  const labels: Record<HousekeepingReservationContextKind, string> = {
    arrival: "Arrival",
    departure: "Departure",
    stayover: "Stayover",
  };

  return {
    kind,
    label: labels[kind],
    reservationNo: reservation.reservationNo,
    guestName: reservation.guest.fullName,
    nightsLabel:
      kind === "stayover"
        ? stayoverNightsLabel(
            date,
            reservation.arrivalDate,
            reservation.departureDate,
          )
        : nightsLabel(reservation.arrivalDate, reservation.departureDate),
    etaLabel: kind === "arrival" ? etaFromReservation(reservation) : null,
  };
}

function serviceLabel({
  arrival,
  departure,
  stayover,
}: {
  arrival: ReservationCandidate | undefined;
  departure: ReservationCandidate | undefined;
  stayover: ReservationCandidate | undefined;
}) {
  if (arrival && departure) {
    return "Turnover + arrival prep";
  }

  if (departure) {
    return "Turnover";
  }

  if (arrival) {
    return "Arrival prep";
  }

  if (stayover) {
    return "Freshen-up";
  }

  return "Vacant / idle";
}

export async function getHousekeepingListData(
  date: Date = todayDateOnly().today,
): Promise<HousekeepingListData> {
  const [rooms, reservations, assignments, openCleaningSessions] =
    await Promise.all([
      prisma.room.findMany({
        select: {
          id: true,
          number: true,
          floor: true,
          status: true,
          roomType: { select: { code: true, name: true } },
        },
      }),
      prisma.reservation.findMany({
        where: {
          roomId: { not: null },
          OR: [
            {
              status: ReservationStatus.CHECKED_IN,
              departureDate: date,
            },
            {
              status: ReservationStatus.CONFIRMED,
              arrivalDate: date,
            },
            {
              status: ReservationStatus.CHECKED_IN,
              arrivalDate: { lte: date },
              departureDate: { gt: date },
            },
          ],
        },
        select: {
          id: true,
          reservationNo: true,
          arrivalDate: true,
          departureDate: true,
          status: true,
          roomId: true,
          notes: true,
          comment: true,
          housekeepingNote: true,
          guest: { select: { fullName: true } },
          addOns: {
            select: { label: true, delivered: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.housekeepingAssignment.findMany({
        where: { date },
        select: {
          roomId: true,
          housekeeper: { select: { id: true, fullName: true } },
        },
      }),
      prisma.cleaningSession.findMany({
        where: {
          date,
          startedAt: { not: null },
          finishedAt: null,
        },
        select: { roomId: true },
      }),
    ]);

  const reservationsByRoomId = new Map<number, ReservationCandidate[]>();

  for (const reservation of reservations) {
    if (!reservation.roomId) {
      continue;
    }

    const roomReservations = reservationsByRoomId.get(reservation.roomId) ?? [];
    roomReservations.push(reservation);
    reservationsByRoomId.set(reservation.roomId, roomReservations);
  }

  const assignmentsByRoomId = new Map(
    assignments.map((assignment) => [assignment.roomId, assignment.housekeeper]),
  );
  const openCleaningRoomIds = new Set(
    openCleaningSessions.map((session) => session.roomId),
  );

  const rows = rooms
    .sort((first, second) =>
      roomNumberCollator.compare(first.number, second.number),
    )
    .map((room): HousekeepingListRow => {
      const roomReservations = reservationsByRoomId.get(room.id) ?? [];
      const departure = roomReservations.find(
        (reservation) =>
          reservation.status === ReservationStatus.CHECKED_IN &&
          reservation.departureDate.getTime() === date.getTime(),
      );
      const arrival = roomReservations.find(
        (reservation) =>
          reservation.status === ReservationStatus.CONFIRMED &&
          reservation.arrivalDate.getTime() === date.getTime(),
      );
      const stayover = roomReservations.find(
        (reservation) =>
          reservation.status === ReservationStatus.CHECKED_IN &&
          reservation.arrivalDate.getTime() <= date.getTime() &&
          reservation.departureDate.getTime() > date.getTime(),
      );
      const contexts = [
        departure
          ? contextForReservation("departure", departure, date)
          : null,
        arrival ? contextForReservation("arrival", arrival, date) : null,
        stayover ? contextForReservation("stayover", stayover, date) : null,
      ].filter(
        (context): context is HousekeepingReservationContext =>
          context !== null,
      );
      const noteReservation = arrival ?? stayover ?? departure ?? null;
      const housekeeper = assignmentsByRoomId.get(room.id) ?? null;

      return {
        room: {
          id: room.id,
          number: room.number,
          floor: room.floor,
          typeName: room.roomType.name,
          typeCode: room.roomType.code,
          status: room.status,
        },
        cleaningState: openCleaningRoomIds.has(room.id)
          ? "IN_PROGRESS"
          : room.status,
        serviceLabel: serviceLabel({ arrival, departure, stayover }),
        reservationContexts: contexts,
        note: noteReservation
          ? {
              reservationNo: noteReservation.reservationNo,
              etaLabel:
                noteReservation.status === ReservationStatus.CONFIRMED
                  ? etaFromReservation(noteReservation)
                  : null,
              housekeepingNote: noteReservation.housekeepingNote,
            }
          : null,
        addOns: noteReservation?.addOns ?? [],
        assignedHousekeeper: housekeeper
          ? {
              id: housekeeper.id,
              name: housekeeper.fullName,
              initials: initialsFromName(housekeeper.fullName),
            }
          : null,
      };
    });

  return { date, rows };
}
