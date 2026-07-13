import type { ReservationStatus } from "@prisma/client";

export const reservationStatusColors = {
  CONFIRMED: {
    backgroundColor: "var(--status-vd)",
    foregroundColor: "var(--slate-900)",
    mutedBackgroundColor: "var(--status-vd-bg)",
    badgeForegroundColor: "var(--status-vd-fg)",
  },
  CHECKED_IN: {
    backgroundColor: "var(--status-vc)",
    foregroundColor: "var(--slate-900)",
    mutedBackgroundColor: "var(--status-vc-bg)",
    badgeForegroundColor: "var(--status-vc-fg)",
  },
  CHECKED_OUT: {
    backgroundColor: "var(--status-oos)",
    foregroundColor: "#ffffff",
    mutedBackgroundColor: "var(--status-oos-bg)",
    badgeForegroundColor: "var(--status-oos-fg)",
  },
  CANCELLED: {
    backgroundColor: "var(--destructive)",
    foregroundColor: "#ffffff",
    mutedBackgroundColor: "#fef2f2",
    badgeForegroundColor: "var(--status-ooo-fg)",
  },
} as const satisfies Partial<Record<ReservationStatus, ReservationStatusColor>>;

export type SharedReservationStatus = keyof typeof reservationStatusColors;

type ReservationStatusColor = {
  backgroundColor: string;
  foregroundColor: string;
  mutedBackgroundColor: string;
  badgeForegroundColor: string;
};

export function hasSharedReservationStatusColor(
  status: ReservationStatus,
): status is SharedReservationStatus {
  return status in reservationStatusColors;
}
