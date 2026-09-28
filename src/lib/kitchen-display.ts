export const KITCHEN_LATE_THRESHOLD_MS = 60 * 60 * 1000;

function elapsedMilliseconds(openedAt: Date, now: Date) {
  return Math.max(0, now.getTime() - openedAt.getTime());
}

export function isKitchenOrderLate(openedAt: Date, now: Date) {
  return elapsedMilliseconds(openedAt, now) >= KITCHEN_LATE_THRESHOLD_MS;
}

export function formatKitchenElapsedTime(openedAt: Date, now: Date) {
  const elapsedSeconds = Math.floor(elapsedMilliseconds(openedAt, now) / 1000);
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
