import { reservationStatusColors } from "@/lib/reservation-status-colors";

export const reservationBarColors = {
  CONFIRMED: {
    label: "Terkonfirmasi",
    bgColor: "#f97316",
    textColor: "#ffffff",
  },
  CHECKED_IN: {
    label: "Sudah check-in",
    bgColor: "#047857",
    textColor: "#ffffff",
  },
  CHECKED_OUT: {
    label: "Sudah check-out",
    bgColor: reservationStatusColors.CHECKED_OUT.backgroundColor,
    textColor: reservationStatusColors.CHECKED_OUT.foregroundColor,
  },
  UNALLOCATED: {
    label: "Belum dialokasikan",
    bgColor: "#2563eb",
    textColor: "#ffffff",
  },
} as const;

export const roomBlockBarColors = {
  label: "Kamar diblokir",
  bgColor: "#b91c1c",
  textColor: "#ffffff",
} as const;

const legendItems = [
  reservationBarColors.CONFIRMED,
  reservationBarColors.CHECKED_IN,
  reservationBarColors.CHECKED_OUT,
  reservationBarColors.UNALLOCATED,
  roomBlockBarColors,
] as const;

export function TapeChartLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-medium text-slate-600"
      aria-label="Legenda status reservasi"
    >
      <span className="font-semibold text-slate-700">Legenda:</span>
      {legendItems.map((item) => (
        <span key={item.label} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
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
