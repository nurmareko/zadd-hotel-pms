import { ReservationStatus, RoomStatus } from "@prisma/client";

import { todayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

export type HousekeepingForecastReason =
  | "turnover"
  | "freshen-up"
  | "arrival-prep"
  | "dirty-now";

export type HousekeepingForecastHousekeeperLoad = {
  id: number;
  name: string;
  initials: string;
  assignedCount: number;
};

export type HousekeepingForecastRoomRow = {
  room: {
    id: number;
    number: string;
    floor: number;
    typeCode: string;
    typeName: string;
    status: RoomStatus;
  };
  needsAttention: boolean;
  reasons: HousekeepingForecastReason[];
  assignment: {
    id: number;
    housekeeperId: number;
    housekeeperName: string;
    housekeeperInitials: string;
  } | null;
};

export type HousekeepingForecastData = {
  date: Date;
  summary: {
    turnovers: number;
    freshenUps: number;
    arrivalsToPrep: number;
    dirtyNow: number;
    totalNeedingAttention: number;
    assignedNeedingAttention: number;
    unassignedNeedingAttention: number;
  };
  housekeepers: HousekeepingForecastHousekeeperLoad[];
  rooms: HousekeepingForecastRoomRow[];
};

type RoomShape = {
  id: number;
  number: string;
  floor: number;
  status: RoomStatus;
  roomType: { code: string; name: string };
};

const dirtyStatuses = [RoomStatus.VD, RoomStatus.OD] as const;

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

function countRoomsWithReason(
  reasonsByRoomId: Map<number, HousekeepingForecastReason>,
  reason: HousekeepingForecastReason,
) {
  let count = 0;

  for (const roomReason of reasonsByRoomId.values()) {
    if (roomReason === reason) {
      count += 1;
    }
  }

  return count;
}

function forecastReasonForRoom({
  date,
  reservations,
  room,
}: {
  date: Date;
  reservations: Array<{
    status: ReservationStatus;
    arrivalDate: Date;
    departureDate: Date;
  }>;
  room: RoomShape;
}): HousekeepingForecastReason | null {
  const hasDeparture = reservations.some(
    (reservation) =>
      reservation.status === ReservationStatus.CHECKED_IN &&
      reservation.departureDate.getTime() === date.getTime(),
  );

  if (hasDeparture) {
    return "turnover";
  }

  const hasStayover = reservations.some(
    (reservation) =>
      reservation.status === ReservationStatus.CHECKED_IN &&
      reservation.arrivalDate.getTime() <= date.getTime() &&
      reservation.departureDate.getTime() > date.getTime(),
  );

  if (hasStayover) {
    return "freshen-up";
  }

  if (dirtyStatuses.includes(room.status as (typeof dirtyStatuses)[number])) {
    return "dirty-now";
  }

  const hasArrival = reservations.some(
    (reservation) =>
      reservation.status === ReservationStatus.CONFIRMED &&
      reservation.arrivalDate.getTime() === date.getTime(),
  );

  if (hasArrival) {
    return "arrival-prep";
  }

  return null;
}

export async function getHousekeepingForecastData(
  date: Date = todayDateOnly().today,
): Promise<HousekeepingForecastData> {
  const [rooms, reservations, assignments, housekeepers] = await Promise.all([
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
            status: ReservationStatus.CHECKED_IN,
            arrivalDate: { lte: date },
            departureDate: { gt: date },
          },
          {
            status: ReservationStatus.CONFIRMED,
            arrivalDate: date,
          },
        ],
      },
      select: {
        roomId: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
      },
    }),
    prisma.housekeepingAssignment.findMany({
      where: { date },
      select: {
        id: true,
        roomId: true,
        housekeeperId: true,
        housekeeper: { select: { fullName: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        isSupervisor: false,
        roles: { some: { role: { code: "HK" } } },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const reservationsByRoomId = new Map<number, typeof reservations>();

  for (const reservation of reservations) {
    if (!reservation.roomId) {
      continue;
    }

    const roomReservations = reservationsByRoomId.get(reservation.roomId) ?? [];
    roomReservations.push(reservation);
    reservationsByRoomId.set(reservation.roomId, roomReservations);
  }

  const reasonsByRoomId = new Map<number, HousekeepingForecastReason>();

  for (const room of rooms) {
    const reason = forecastReasonForRoom({
      date,
      reservations: reservationsByRoomId.get(room.id) ?? [],
      room,
    });

    if (reason) {
      reasonsByRoomId.set(room.id, reason);
    }
  }

  const assignmentsByRoomId = new Map(
    assignments.map((assignment) => [assignment.roomId, assignment]),
  );
  const loadByHousekeeperId = new Map<number, number>();

  for (const assignment of assignments) {
    loadByHousekeeperId.set(
      assignment.housekeeperId,
      (loadByHousekeeperId.get(assignment.housekeeperId) ?? 0) + 1,
    );
  }

  const roomsByNumber = [...rooms].sort((first: RoomShape, second: RoomShape) =>
    roomNumberCollator.compare(first.number, second.number),
  );
  const needingAttentionRoomIds = new Set(reasonsByRoomId.keys());
  let assignedNeedingAttention = 0;

  const roomRows = roomsByNumber.map((room): HousekeepingForecastRoomRow => {
    const reason = reasonsByRoomId.get(room.id) ?? null;
    const reasons = reason ? [reason] : [];
    const assignment = assignmentsByRoomId.get(room.id) ?? null;

    if (reasons.length > 0 && assignment) {
      assignedNeedingAttention += 1;
    }

    return {
      room: {
        id: room.id,
        number: room.number,
        floor: room.floor,
        typeCode: room.roomType.code,
        typeName: room.roomType.name,
        status: room.status,
      },
      needsAttention: reasons.length > 0,
      reasons,
      assignment: assignment
        ? {
            id: assignment.id,
            housekeeperId: assignment.housekeeperId,
            housekeeperName: assignment.housekeeper.fullName,
            housekeeperInitials: initialsFromName(
              assignment.housekeeper.fullName,
            ),
          }
        : null,
    };
  });

  return {
    date,
    summary: {
      turnovers: countRoomsWithReason(reasonsByRoomId, "turnover"),
      freshenUps: countRoomsWithReason(reasonsByRoomId, "freshen-up"),
      arrivalsToPrep: countRoomsWithReason(reasonsByRoomId, "arrival-prep"),
      dirtyNow: countRoomsWithReason(reasonsByRoomId, "dirty-now"),
      totalNeedingAttention: needingAttentionRoomIds.size,
      assignedNeedingAttention,
      unassignedNeedingAttention:
        needingAttentionRoomIds.size - assignedNeedingAttention,
    },
    housekeepers: housekeepers.map((housekeeper) => ({
      id: housekeeper.id,
      name: housekeeper.fullName,
      initials: initialsFromName(housekeeper.fullName),
      assignedCount: loadByHousekeeperId.get(housekeeper.id) ?? 0,
    })),
    rooms: roomRows,
  };
}
