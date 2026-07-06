import { revalidatePath } from "next/cache";

const ROOM_STATUS_PATHS = [
  "/app/hk",
  "/app/hk/rooms",
  "/app/fo/reservasi/kalender",
  "/app/fo/reservasi/new",
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
    revalidatePath(`/app/fo/reservasi/${reservationId}`);
  }

  if (roomId) {
    revalidatePath(`/app/hk/rooms/${roomId}`);
  }
}
