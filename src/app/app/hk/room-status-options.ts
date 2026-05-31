import { RoomStatus } from "@prisma/client";

export const occupiedRoomStatuses = [
  RoomStatus.OC,
  RoomStatus.OD,
  RoomStatus.OOO,
] as const;

export const vacantRoomStatuses = [
  RoomStatus.VC,
  RoomStatus.VD,
  RoomStatus.VCU,
  RoomStatus.OOO,
] as const;

export function allowedRoomStatuses(isOccupied: boolean): readonly RoomStatus[] {
  return isOccupied ? occupiedRoomStatuses : vacantRoomStatuses;
}
