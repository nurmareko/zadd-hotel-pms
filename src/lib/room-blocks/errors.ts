export type RoomBlockFailureCode =
  | "SESSION_EXPIRED" | "FORBIDDEN" | "INVALID_INPUT" | "ROOM_NOT_FOUND"
  | "BLOCK_NOT_FOUND" | "RESERVATION_CONFLICT" | "CAPACITY_CONFLICT"
  | "CLEANING_IN_PROGRESS" | "ROOM_OCCUPIED"
  | "CONCURRENT_CHANGE" | "UNEXPECTED";
export type RoomBlockActionResult =
  | { ok: true; blockId: number; roomId: number; alreadyReleased?: boolean }
  | { ok: false; code: RoomBlockFailureCode; error: string; field?: string };

export class RoomBlockError extends Error {
  constructor(readonly code: RoomBlockFailureCode, message: string) {
    super(message);
    this.name = "RoomBlockError";
  }
}
