import type { ReservationStatus, ReservationStayFeeKind, ReservationStayFeeStatus, RoomStatus } from "@prisma/client";

export type HousekeepingPriority = "P1" | "P2" | "P3" | "P4" | "P5";
export type HousekeepingSortBy = "priority" | "room" | "floor" | "status" | "assignee";
export type HousekeepingSortOrder = "asc" | "desc";

export type HousekeepingListFilterOptions = {
  date?: Date;
  q?: string;
  status?: RoomStatus;
  priority?: HousekeepingPriority;
  sortBy?: HousekeepingSortBy;
  sortOrder?: HousekeepingSortOrder;
};

export interface HousekeepingPriorityInfo {
  label: string;
  rank: number;
  className: string;
}

export const PRIORITY_CONFIG = {
  P1: { label: "Mendesak", rank: 1, className: "bg-red-100 text-red-700" },
  P2: { label: "Pergantian Cepat", rank: 2, className: "bg-orange-100 text-orange-700" },
  P3: { label: "Keberangkatan", rank: 3, className: "bg-amber-100 text-amber-700" },
  P4: { label: "Menginap", rank: 4, className: "bg-blue-100 text-blue-700" },
  P5: { label: "Rutin", rank: 5, className: "bg-slate-100 text-slate-600" },
} as const satisfies Record<HousekeepingPriority, HousekeepingPriorityInfo>;

export const HOUSEKEEPING_PRIORITY_CONFIG = PRIORITY_CONFIG;

export type HousekeepingPriorityReservation = {
  status: ReservationStatus;
  arrivalDate: Date;
  departureDate: Date;
  notes: string | null;
  stayFees: readonly { kind: ReservationStayFeeKind; status: ReservationStayFeeStatus }[];
};

export function resolveRoomPriority({ status, date, reservations }: {
  status: RoomStatus;
  date: Date;
  reservations: readonly HousekeepingPriorityReservation[];
}): HousekeepingPriority {
  const selectedDay = date.getTime();
  const arrivals = reservations.filter((reservation) =>
    reservation.status === "CONFIRMED" && reservation.arrivalDate.getTime() === selectedDay,
  );
  const hasDeparture = reservations.some((reservation) =>
    (reservation.status === "CHECKED_IN" || reservation.status === "CHECKED_OUT") &&
    reservation.departureDate.getTime() === selectedDay,
  );
  if (status !== "VC") {
    const urgentArrival = arrivals.some((reservation) => {
      const eta = reservation.notes?.match(/\bETA\s*:?\s*([01]?\d|2[0-3]):[0-5]\d\b/i);
      return reservation.stayFees.some((fee) => fee.kind === "EARLY_CHECK_IN" && fee.status !== "CANCELLED") ||
        (eta !== undefined && eta !== null && Number(eta[1]) < 14) ||
        /\bVIP\b/i.test(reservation.notes ?? "");
    });
    if (urgentArrival) return "P1";
    if (arrivals.length > 0 && hasDeparture) return "P2";
    if (hasDeparture) return "P3";
  }
  if (status === "OD" && reservations.some((reservation) =>
    reservation.status === "CHECKED_IN" && reservation.arrivalDate.getTime() <= selectedDay &&
    reservation.departureDate.getTime() > selectedDay,
  )) return "P4";
  return "P5";
}

export function housekeepingTaskCode(roomNumber: string): string {
  return `TSK-${roomNumber}`;
}

export type HousekeepingSortableRow = {
  room: { id: number; number: string; floor: number; status: RoomStatus };
  priority: HousekeepingPriority;
  assignedHousekeeper: { name: string } | null;
};

const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

export function sortHousekeepingRows<T extends HousekeepingSortableRow>(
  rows: readonly T[],
  sortBy: HousekeepingSortBy = "priority",
  sortOrder: HousekeepingSortOrder = "asc",
): T[] {
  const direction = sortOrder === "desc" ? -1 : 1;
  return [...rows].sort((first, second) => {
    let comparison: number;
    switch (sortBy) {
      case "room": comparison = collator.compare(first.room.number, second.room.number); break;
      case "floor": comparison = first.room.floor - second.room.floor; break;
      case "status": comparison = collator.compare(first.room.status, second.room.status); break;
      case "assignee": comparison = collator.compare(first.assignedHousekeeper?.name ?? "", second.assignedHousekeeper?.name ?? ""); break;
      default: comparison = PRIORITY_CONFIG[first.priority].rank - PRIORITY_CONFIG[second.priority].rank;
    }
    return comparison * direction || collator.compare(first.room.number, second.room.number) || first.room.id - second.room.id;
  });
}
