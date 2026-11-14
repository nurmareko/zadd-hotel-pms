import { reservationStatusColors } from "@/lib/reservation-status-colors";

import styles from "./tape-chart.module.css";

export const reservationBarColors = {
  CONFIRMED: {
    label: "Guaranteed",
    bgColor: "#f97316",
    textColor: "#ffffff",
  },
  TENTATIVE: {
    label: "Tentative",
    bgColor: "#fef3c7",
    textColor: "#92400e",
  },
  CHECKED_IN: {
    label: "Checked In",
    bgColor: "#047857",
    textColor: "#ffffff",
  },
  CHECKED_OUT: {
    label: "Checked Out",
    bgColor: reservationStatusColors.CHECKED_OUT.backgroundColor,
    textColor: reservationStatusColors.CHECKED_OUT.foregroundColor,
  },
  UNALLOCATED: {
    label: "Not assigned",
    bgColor: "#2563eb",
    textColor: "#ffffff",
  },
} as const;

export const tentativeBarStyle = { border: "2px dashed currentColor" } as const;

export const roomBlockBarColors = {
  label: "Room blocked",
  bgColor: "#b91c1c",
  textColor: "#ffffff",
} as const;

const legendItems = [
  reservationBarColors.CONFIRMED,
  reservationBarColors.TENTATIVE,
  reservationBarColors.CHECKED_IN,
  reservationBarColors.CHECKED_OUT,
  reservationBarColors.UNALLOCATED,
  roomBlockBarColors,
] as const;

export function TapeChartLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-600"
      aria-label="Reservation status legend"
    >
      <span className="font-semibold text-slate-700">Legend:</span>
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-red-700" aria-label="Physical Status: Out of Order">
        <span className={`${styles.outOfOrderCell} h-3 w-5 shrink-0 rounded-sm border`} aria-hidden="true" />
        OOO
      </span>
      {legendItems.map((item) => (
        <span key={item.label} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span
            className="h-3 w-5 shrink-0 rounded-sm ring-1 ring-black/10"
            style={{
              backgroundColor: item.bgColor,
              color: item.textColor,
              ...(item === reservationBarColors.TENTATIVE ? tentativeBarStyle : {}),
            }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
