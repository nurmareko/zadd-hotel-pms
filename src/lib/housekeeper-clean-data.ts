import { ReservationStatus, RoomStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

import { todayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

// The housekeeper's own cleaning worklist is grouped by what the room needs:
//   ready    — vacant turnovers (VD): full clean before the next arrival
//   freshen  — occupied stayovers (OD): light in-house service
//   done     — anything already started/finished today, or already clean
export type CleanGroup = "ready" | "freshen" | "done";

export type CleanReservationContext =
  | {
      kind: "turnover";
      guestName: string;
      etaLabel: string | null;
      nightsLabel: string;
    }
  | {
      kind: "stayover";
      guestName: string;
      nightsLabel: string;
    };

export type CleanAddOn = {
  id: number;
  label: string;
  delivered: boolean;
};

export type CleanRoom = {
  id: number;
  number: string;
  floor: number;
  typeCode: string;
  typeName: string;
  status: RoomStatus;
  group: CleanGroup;
  inProgress: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  context: CleanReservationContext | null;
  housekeepingNote: string | null;
  addOns: CleanAddOn[];
};

export type HousekeeperCleanData = {
  date: Date;
  ready: CleanRoom[];
  freshen: CleanRoom[];
  done: CleanRoom[];
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
  addOns: Array<{ id: number; label: string; delivered: boolean }>;
};

const roomNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function nightsLabel(arrivalDate: Date, departureDate: Date) {
  const nights = Math.max(1, differenceInCalendarDays(departureDate, arrivalDate));

  return nights === 1 ? "1 malam" : `${nights} malam`;
}

function stayoverNightsLabel(date: Date, arrivalDate: Date, departureDate: Date) {
  const currentNight = Math.max(1, differenceInCalendarDays(date, arrivalDate) + 1);
  const totalNights = Math.max(1, differenceInCalendarDays(departureDate, arrivalDate));

  return `Malam ${Math.min(currentNight, totalNights)}/${totalNights}`;
}

function etaFromReservation(reservation: ReservationCandidate) {
  const candidate = reservation.notes ?? reservation.comment;
  const etaMatch = candidate?.match(/\bETA\s*:?\s*([0-2]?\d:[0-5]\d)\b/i);

  return etaMatch?.[1] ?? null;
}

function addOnsFrom(reservation: ReservationCandidate | undefined): CleanAddOn[] {
  return (
    reservation?.addOns.map((addOn) => ({
      id: addOn.id,
      label: addOn.label,
      delivered: addOn.delivered,
    })) ?? []
  );
}

/**
 * Build the cleaning worklist for a single housekeeper on the hotel's current
 * WIB day, scoped to the rooms assigned to them. Rooms are grouped by the work
 * they need (turnover / freshen-up / done) and decorated with the reservation
 * context, HK note, add-ons, and any cleaning session started today.
 */
export async function getHousekeeperCleanData(
  housekeeperId: number,
  date: Date = todayDateOnly().today,
): Promise<HousekeeperCleanData> {
  const assignments = await prisma.housekeepingAssignment.findMany({
    where: { housekeeperId, date },
    select: {
      room: {
        select: {
          id: true,
          number: true,
          floor: true,
          status: true,
          roomType: { select: { code: true, name: true } },
        },
      },
    },
  });

  const rooms = assignments.map((assignment) => assignment.room);
  const roomIds = rooms.map((room) => room.id);

  if (roomIds.length === 0) {
    return { date, ready: [], freshen: [], done: [] };
  }

  const [reservations, sessions] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        roomId: { in: roomIds },
        OR: [
          { status: ReservationStatus.CONFIRMED, arrivalDate: date },
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
          select: { id: true, label: true, delivered: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.cleaningSession.findMany({
      where: { housekeeperId, date, roomId: { in: roomIds } },
      orderBy: { createdAt: "desc" },
      select: { roomId: true, startedAt: true, finishedAt: true },
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

  const openSessionByRoomId = new Map<number, Date>();
  const lastFinishedByRoomId = new Map<number, Date>();

  // Sessions are newest-first; keep the first match of each kind per room.
  for (const session of sessions) {
    if (session.startedAt && !session.finishedAt) {
      if (!openSessionByRoomId.has(session.roomId)) {
        openSessionByRoomId.set(session.roomId, session.startedAt);
      }
    } else if (session.finishedAt) {
      if (!lastFinishedByRoomId.has(session.roomId)) {
        lastFinishedByRoomId.set(session.roomId, session.finishedAt);
      }
    }
  }

  const cleanRooms = rooms
    .sort((first, second) => roomNumberCollator.compare(first.number, second.number))
    .map((room): CleanRoom => {
      const roomReservations = reservationsByRoomId.get(room.id) ?? [];
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

      const startedAt = openSessionByRoomId.get(room.id) ?? null;
      const finishedAt = lastFinishedByRoomId.get(room.id) ?? null;
      const inProgress = startedAt !== null;

      // Open session always wins (a VD room being cleaned is "in progress", not
      // "ready"); otherwise the room status decides what work it still needs.
      let group: CleanGroup;
      if (inProgress) {
        group = "done";
      } else if (room.status === RoomStatus.VD) {
        group = "ready";
      } else if (room.status === RoomStatus.OD) {
        group = "freshen";
      } else {
        group = "done";
      }

      // The reservation that drives the note/add-ons: for a turnover it is the
      // incoming arrival; for a stayover it is the in-house guest.
      const isTurnover = room.status === RoomStatus.VD || group === "ready";
      const noteReservation = isTurnover ? arrival ?? stayover : stayover ?? arrival;

      let context: CleanReservationContext | null = null;
      if (room.status === RoomStatus.OD && stayover) {
        context = {
          kind: "stayover",
          guestName: stayover.guest.fullName,
          nightsLabel: stayoverNightsLabel(
            date,
            stayover.arrivalDate,
            stayover.departureDate,
          ),
        };
      } else if (arrival) {
        context = {
          kind: "turnover",
          guestName: arrival.guest.fullName,
          etaLabel: etaFromReservation(arrival),
          nightsLabel: nightsLabel(arrival.arrivalDate, arrival.departureDate),
        };
      }

      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        typeCode: room.roomType.code,
        typeName: room.roomType.name,
        status: room.status,
        group,
        inProgress,
        startedAt,
        finishedAt,
        context,
        housekeepingNote: noteReservation?.housekeepingNote ?? null,
        addOns: addOnsFrom(noteReservation),
      };
    });

  return {
    date,
    ready: cleanRooms.filter((room) => room.group === "ready"),
    freshen: cleanRooms.filter((room) => room.group === "freshen"),
    done: cleanRooms.filter((room) => room.group === "done"),
  };
}
