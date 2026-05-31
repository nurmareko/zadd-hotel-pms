import type { ReservationStatus } from "@prisma/client";

export const reservationStatusColors = {
  CONFIRMED: {
    backgroundColor: "#f97316",
    foregroundColor: "#ffffff",
    mutedBackgroundColor: "#fff7ed",
  },
  CHECKED_IN: {
    backgroundColor: "#047857",
    foregroundColor: "#ffffff",
    mutedBackgroundColor: "#ecfdf5",
  },
  CHECKED_OUT: {
    backgroundColor: "#64748b",
    foregroundColor: "#ffffff",
    mutedBackgroundColor: "#f1f5f9",
  },
  CANCELLED: {
    backgroundColor: "var(--destructive)",
    foregroundColor: "#ffffff",
    mutedBackgroundColor: "#fef2f2",
  },
} as const satisfies Partial<Record<ReservationStatus, ReservationStatusColor>>;

export type SharedReservationStatus = keyof typeof reservationStatusColors;

type ReservationStatusColor = {
  backgroundColor: string;
  foregroundColor: string;
  mutedBackgroundColor: string;
};

export function hasSharedReservationStatusColor(
  status: ReservationStatus,
): status is SharedReservationStatus {
  return status in reservationStatusColors;
}
