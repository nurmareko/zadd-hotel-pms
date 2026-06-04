import { RoomStatus } from "@prisma/client";

export const allRoomStatuses = [
  RoomStatus.VC,
  RoomStatus.OC,
  RoomStatus.VD,
  RoomStatus.OD,
  RoomStatus.VCU,
  RoomStatus.OOO,
] as const;

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

export const roomStatusLabels: Record<RoomStatus, string> = {
  VC: "VC - Vacant Clean",
  OC: "OC - Occupied Clean",
  VD: "VD - Vacant Dirty",
  OD: "OD - Occupied Dirty",
  VCU: "VCU - Clean Unchecked",
  OOO: "OOO - Out of Order",
};
