import type { DepositStatus, ReservationStatus } from "@prisma/client";
import type { CSSProperties, ReactNode } from "react";

import {
  hasSharedReservationStatusColor,
  reservationStatusColors,
  type SharedReservationStatus,
} from "@/lib/reservation-status-colors";
import { cn } from "@/lib/utils";

const bookingStatusLabels: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function BookingStatusBadge({
  status,
  depositStatus,
}: {
  status: ReservationStatus;
  depositStatus: DepositStatus;
}) {
  if (status === "CONFIRMED") {
    const guaranteed = depositStatus === "COLLECTED";
    return (
      <StatusBadge
        label={guaranteed ? "Confirmed · Guaranteed" : "Confirmed · Tentative"}
        className={guaranteed
          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
          : "border-amber-600 bg-amber-50 text-amber-800"}
      />
    );
  }

  return hasSharedReservationStatusColor(status) ? (
    <StatusBadge label={bookingStatusLabels[status]} reservationStatus={status} />
  ) : (
    <StatusBadge
      label={bookingStatusLabels[status]}
      className="border-status-od-pip bg-status-od-bg text-status-od-fg"
      pipClassName="bg-status-od-pip"
    />
  );
}

type StatusBadgeSize = "sm" | "md";

const sizeClassNames: Record<StatusBadgeSize, string> = {
  sm: "h-5 px-2",
  md: "h-6 px-2.5",
};

export function StatusBadge({
  label,
  className,
  pipClassName = "bg-current",
  showPip = true,
  size = "sm",
  reservationStatus,
}: {
  label: ReactNode;
  className?: string;
  pipClassName?: string;
  showPip?: boolean;
  size?: StatusBadgeSize;
  reservationStatus?: SharedReservationStatus;
}) {
  const reservationColors = reservationStatus
    ? reservationStatusColors[reservationStatus]
    : null;
  const reservationBadgeStyle = reservationColors
    ? ({
        backgroundColor: reservationColors.mutedBackgroundColor,
        borderColor: reservationColors.backgroundColor,
        color: reservationColors.badgeForegroundColor,
      } satisfies CSSProperties)
    : undefined;
  const reservationPipStyle = reservationColors
    ? ({
        backgroundColor: reservationColors.backgroundColor,
      } satisfies CSSProperties)
    : undefined;

  return (
    <span
      style={reservationBadgeStyle}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border text-xs font-semibold rounded-full uppercase tracking-wider",
        sizeClassNames[size],
        className,
      )}
    >
      {showPip ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", pipClassName)}
          style={reservationPipStyle}
        />
      ) : null}
      {label}
    </span>
  );
}
