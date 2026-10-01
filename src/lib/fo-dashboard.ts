import type { RoomStatus } from "@prisma/client";

export function calculateOccupancy(
  totalRooms: number,
  occupiedRooms: number,
  oooRooms: number,
): { occupancyRate: number; sellableRooms: number } {
  const sellableRooms = totalRooms - oooRooms;

  return {
    occupancyRate: sellableRooms === 0 ? 0 : (occupiedRooms / sellableRooms) * 100,
    sellableRooms,
  };
}

export function summarizeRoomStatuses(
  rooms: readonly { status: RoomStatus }[],
): { clean: number; dirty: number; inspected: number; ooo: number; occupied: number } {
  const summary = { clean: 0, dirty: 0, inspected: 0, ooo: 0, occupied: 0 };

  for (const { status } of rooms) {
    switch (status) {
      case "VC":
        summary.clean++;
        break;
      case "VD":
        summary.dirty++;
        break;
      case "VCU":
        // Dashboard bucket name; VCU still means awaiting inspection operationally.
        summary.inspected++;
        break;
      case "OOO":
        summary.ooo++;
        break;
      case "OC":
      case "OD":
        summary.occupied++;
        break;

    }
  }

  return summary;
}

export function summarizeInHouse(
  reservations: readonly { adults: number; children: number }[],
): { roomCount: number; guestCount: number } {
  return {
    roomCount: reservations.length,
    guestCount: reservations.reduce(
      (total, reservation) => total + reservation.adults + reservation.children,
      0,
    ),
  };
}
