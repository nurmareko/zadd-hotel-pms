import type { RoomStatus } from "@prisma/client";

import { isMobilePoolEligible, mobileServiceKind } from "@/lib/housekeeper-mobile-eligibility";
import {
  getHousekeepingListData,
  type HousekeepingReservationContext,
} from "@/lib/housekeeping-list-data";
import { sortHousekeepingRows, type HousekeepingPriority } from "@/lib/housekeeping-priority";
import { prisma } from "@/lib/prisma";

export type MobileCleaningRoom = {
  id: number;
  number: string;
  floor: number;
  typeName: string;
  status: RoomStatus;
  priority: HousekeepingPriority;
  taskCode: string;
  serviceKind: "turnover" | "stayover" | "inspection" | "routine";
  reservationContexts: HousekeepingReservationContext[];
  notes: string | null;
  taskNote: string | null;
  startedAt: Date | null;
  inProgress: boolean;
  activeHousekeeperId: number | null;
};

export type MobileAvailableRoom = MobileCleaningRoom;

export type HousekeeperMobileData = {
  date: Date;
  myRooms: MobileCleaningRoom[];
  availablePoolRooms: MobileAvailableRoom[];
  allHotelRooms: Array<{ id: number; number: string }>;
};

export async function getHousekeeperMobileData(
  userId: number,
  date?: Date,
): Promise<HousekeeperMobileData> {
  const list = await getHousekeepingListData(date);
  // A previous operating day's unfinished session still owns the room today.
  const sessions = await prisma.cleaningSession.findMany({
    where: {
      roomId: { in: list.rows.map((row) => row.room.id) },
      startedAt: { not: null },
      finishedAt: null,
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    select: { roomId: true, housekeeperId: true, startedAt: true },
  });
  const activeByRoom = new Map<number, (typeof sessions)[number]>();
  // Newest start, then ID, deterministically wins if legacy data has duplicates.
  for (const session of sessions) {
    if (!activeByRoom.has(session.roomId)) activeByRoom.set(session.roomId, session);
  }

  const myRooms: MobileCleaningRoom[] = [];
  const availablePoolRooms: MobileAvailableRoom[] = [];
  for (const row of sortHousekeepingRows(list.rows, "priority", "asc")) {
    const active = activeByRoom.get(row.room.id);
    const room: MobileCleaningRoom = {
      id: row.room.id,
      number: row.room.number,
      floor: row.room.floor,
      typeName: row.room.typeName,
      status: row.room.status,
      priority: row.priority,
      taskCode: row.taskCode,
      serviceKind: mobileServiceKind(row.room.status),
      reservationContexts: row.reservationContexts,
      notes: row.note?.notes ?? null,
      taskNote: row.taskNote,
      startedAt: active?.startedAt ?? null,
      inProgress: active !== undefined,
      activeHousekeeperId: active?.housekeeperId ?? null,
    };

    if (row.assignedHousekeeper?.id === userId) {
      myRooms.push(room);
    } else if (!row.assignedHousekeeper && !active && isMobilePoolEligible({
      status: row.room.status,
      hasScheduledMovement: row.reservationContexts.some(
        (context) => context.kind === "arrival" || context.kind === "departure",
      ),
    })) {
      availablePoolRooms.push(room);
    }
  }

  return {
    date: list.date,
    myRooms,
    availablePoolRooms,
    allHotelRooms: sortHousekeepingRows(list.rows, "room", "asc")
      .map((row) => ({ id: row.room.id, number: row.room.number })),
  };
}
