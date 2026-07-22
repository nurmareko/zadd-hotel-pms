import { reservationStatusColors } from "@/lib/reservation-status-colors";

export const reservationBarColors = {
  CONFIRMED: {
    label: "Confirmed",
    bgColor: "#f97316",
    textColor: "#ffffff",
  },
  CHECKED_IN: {
    label: "Checked-in",
    bgColor: "#047857",
    textColor: "#ffffff",
  },
  CHECKED_OUT: {
    label: "Checked-out",
    bgColor: reservationStatusColors.CHECKED_OUT.backgroundColor,
    textColor: reservationStatusColors.CHECKED_OUT.foregroundColor,
  },
  UNALLOCATED: {
    label: "Unallocated",
    bgColor: "#2563eb",
    textColor: "#ffffff",
  },
} as const;

const legendItems = [
  reservationBarColors.CONFIRMED,
  reservationBarColors.CHECKED_IN,
  reservationBarColors.CHECKED_OUT,
  reservationBarColors.UNALLOCATED,
] as const;

export function TapeChartLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-medium text-slate-600 lg:flex-nowrap lg:whitespace-nowrap"
      aria-label="Legenda status reservasi"
    >
      <span className="font-semibold text-slate-700">Legenda:</span>
      {legendItems.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1">
          <span
            className="size-2 shrink-0 rounded-sm ring-1 ring-black/10"
            style={{ backgroundColor: item.bgColor }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
