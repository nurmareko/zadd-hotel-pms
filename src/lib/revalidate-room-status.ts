import { revalidatePath } from "next/cache";

const ROOM_STATUS_PATHS = [
  "/app/hk",
  "/app/fo/tape-chart",
  "/app/fo/dashboard",
  "/app/fo/reservations/new",
  "/app/admin/rooms",
  "/app/acc",
] as const;

export function revalidateRoomStatusViews({
  reservationId,
  roomId,
}: {
  reservationId?: number;
  roomId?: number;
} = {}) {
  for (const path of ROOM_STATUS_PATHS) {
    revalidatePath(path);
  }

  if (reservationId) {
    revalidatePath(`/app/fo/reservations/${reservationId}`);
  }

  if (roomId) {
    revalidatePath(`/app/hk/rooms/${roomId}`);
  }
}
