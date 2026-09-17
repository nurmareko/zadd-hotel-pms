import { ReservationStatus, RoomStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";

import { addDateOnlyDays, hotelTimestampBoundaryForDate, todayDateOnly } from "@/lib/date-only";
import {
  housekeepingTaskCode,
  resolveRoomPriority,
  sortHousekeepingRows,
  type HousekeepingListFilterOptions,
  type HousekeepingPriority,
  type HousekeepingPriorityReservation,
} from "@/lib/housekeeping-priority";

export * from "@/lib/housekeeping-priority";
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

export type HousekeepingListRow = {
  taskCode: string;
  priority: HousekeepingPriority;
  taskNote: string | null;
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
    notes: string | null;
  } | null;
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

type ReservationCandidate = HousekeepingPriorityReservation & {
  id: number;
  reservationNo: string;
  arrivalDate: Date;
  departureDate: Date;
  status: ReservationStatus;
  roomId: number | null;
  notes: string | null;
  guest: { fullName: string };
};


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

  return nights === 1 ? "1 malam" : `${nights} malam`;
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

  return `Malam ${Math.min(currentNight, totalNights)}/${totalNights}`;
}

function etaFromReservation(reservation: ReservationCandidate) {
  const etaMatch = reservation.notes?.match(/\bETA\s*:?\s*([0-2]?\d:[0-5]\d)\b/i);

  return etaMatch?.[1] ?? null;
}

function contextForReservation(
  kind: HousekeepingReservationContextKind,
  reservation: ReservationCandidate,
  date: Date,
): HousekeepingReservationContext {
  const labels: Record<HousekeepingReservationContextKind, string> = {
    arrival: "Kedatangan",
    departure: "Keberangkatan",
    stayover: "Menginap",
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
    return "Pembersihan pergantian tamu + persiapan kedatangan";
  }

  if (departure) {
    return "Pembersihan pergantian tamu";
  }

  if (arrival) {
    return "Persiapan kedatangan";
  }

  if (stayover) {
    return "Pembersihan kamar terisi";
  }

  return "Kamar kosong / tidak aktif";
}

export function getHousekeepingListData(
  options?: HousekeepingListFilterOptions,
): Promise<HousekeepingListData>;
export function getHousekeepingListData(
  date?: Date,
  q?: string,
  status?: RoomStatus,
): Promise<HousekeepingListData>;
export async function getHousekeepingListData(
  dateOrOptions?: Date | HousekeepingListFilterOptions,
  q?: string,
  status?: RoomStatus,
): Promise<HousekeepingListData> {
  const options: HousekeepingListFilterOptions = dateOrOptions instanceof Date || dateOrOptions === undefined
    ? { date: dateOrOptions, q, status }
    : dateOrOptions;
  // Dates are UTC-midnight date-only values, matching the existing positional API.
  const date = options.date ?? todayDateOnly().today;
  const taskDayStart = hotelTimestampBoundaryForDate(date.toISOString().slice(0, 10));
  const taskDayEnd = hotelTimestampBoundaryForDate(addDateOnlyDays(date, 1).toISOString().slice(0, 10));
  const [rooms, reservations, assignments, openCleaningSessions, taskLogs] =
    await Promise.all([
      prisma.room.findMany({
        where: {
          status: options.status,
        },
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
              status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT] },
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
          guest: { select: { fullName: true } },
          stayFees: {
            where: { kind: "EARLY_CHECK_IN", status: { not: "CANCELLED" } },
            select: { kind: true, status: true },
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
      prisma.housekeepingLog.findMany({
        where: {
          note: { startsWith: "[TUGAS:" },
          updatedAt: { gte: taskDayStart, lt: taskDayEnd },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { roomId: true, note: true },
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

  const taskNotesByRoomId = new Map<number, string | null>();
  for (const log of taskLogs) {
    if (!taskNotesByRoomId.has(log.roomId)) taskNotesByRoomId.set(log.roomId, log.note);
  }

  const rows = rooms.map((room): HousekeepingListRow => {
      const roomReservations = reservationsByRoomId.get(room.id) ?? [];
      const departure = roomReservations.find(
        (reservation) =>
          (reservation.status === ReservationStatus.CHECKED_IN ||
            reservation.status === ReservationStatus.CHECKED_OUT) &&
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
        taskCode: housekeepingTaskCode(room.number),
        priority: resolveRoomPriority({ status: room.status, date, reservations: roomReservations }),
        taskNote: taskNotesByRoomId.get(room.id) ?? null,
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
              notes: noteReservation.notes,
            }
          : null,
        assignedHousekeeper: housekeeper
          ? {
              id: housekeeper.id,
              name: housekeeper.fullName,
              initials: initialsFromName(housekeeper.fullName),
            }
          : null,
      };
    });

  const query = options.q?.trim().toLocaleLowerCase("id");
  const filteredRows = rows.filter((row) => {
    if (options.priority && row.priority !== options.priority) return false;
    if (!query) return true;
    return [
      row.room.number,
      row.taskCode,
      row.room.typeName,
      row.room.typeCode,
      row.serviceLabel,
      row.assignedHousekeeper?.name,
      ...row.reservationContexts.flatMap((context) => [context.reservationNo, context.guestName]),
    ].some((value) => value?.toLocaleLowerCase("id").includes(query));
  });

  return { date, rows: sortHousekeepingRows(filteredRows, options.sortBy, options.sortOrder) };
}
