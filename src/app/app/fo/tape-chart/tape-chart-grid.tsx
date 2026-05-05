import type { RoomStatus } from "@prisma/client";

type TapeCellStatus = RoomStatus;

export type TapeChartCell = {
  dayIso: string;
  status: TapeCellStatus;
  guestLabel?: string;
  reservationId?: number;
  isFirstDayOfStay: boolean;
  isLastDayOfStay: boolean;
};

export type TapeChartRow = {
  roomId: number;
  roomNumber: string;
  roomTypeLabel: string;
  cells: TapeChartCell[];
};

type TapeChartDay = {
  iso: string;
  dayOfWeek: string;
  dayNumber: string;
};

type TapeChartGridProps = {
  days: TapeChartDay[];
  rows: TapeChartRow[];
};

const statusClasses: Record<
  TapeCellStatus,
  { bg: string; border: string; text: string }
> = {
  VC: {
    bg: "bg-status-vc-bg",
    border: "border-status-vc-pip",
    text: "text-slate-700",
  },
  OC: {
    bg: "bg-status-oc-bg",
    border: "border-status-oc-pip",
    text: "text-status-oc-fg",
  },
  VD: {
    bg: "bg-status-vd-bg",
    border: "border-status-vd-pip",
    text: "text-status-vd-fg",
  },
  OD: {
    bg: "bg-status-od-bg",
    border: "border-status-od-pip",
    text: "text-status-od-fg",
  },
  OOO: {
    bg: "bg-status-ooo-bg",
    border: "border-status-ooo-pip",
    text: "text-status-ooo-fg",
  },
};

function getCellLabel(cell: TapeChartCell) {
  return cell.guestLabel ?? cell.status;
}

export function TapeChartGrid({ days, rows }: TapeChartGridProps) {
  const tableMinWidth = 128 + days.length * 64;

  return (
    <div
      className="border border-console-border bg-console-surface"
      style={{ maxHeight: 520, overflow: "hidden", padding: 0 }}
    >
      <div style={{ maxHeight: 520, overflow: "auto" }}>
        <table
          className="w-full border-separate border-spacing-0 text-[12px]"
          style={{ minWidth: tableMinWidth, tableLayout: "fixed" }}
        >
          <caption className="sr-only">
            Room by date tape chart for the next 14 days
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-r border-console-border bg-slate-50 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                style={{
                  left: 0,
                  minWidth: 128,
                  position: "sticky",
                  top: 0,
                  width: 128,
                  zIndex: 30,
                }}
              >
                Kamar
              </th>
              {days.map((day, index) => (
                <th
                  key={day.iso}
                  scope="col"
                  className="border-b border-console-border bg-slate-50 px-1 py-1.5 text-center font-semibold"
                  style={{
                    minWidth: 64,
                    position: "sticky",
                    top: 0,
                    width: 64,
                    zIndex: 20,
                  }}
                >
                  <div className="text-[10px] uppercase text-slate-500">
                    {day.dayOfWeek}
                  </div>
                  <div
                    className={[
                      "num text-[12px]",
                      index === 0 ? "text-console-ink" : "text-slate-500",
                    ].join(" ")}
                  >
                    {day.dayNumber}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.roomId}>
                <th
                  scope="row"
                  className="border-b border-r border-console-border-soft bg-console-surface px-2.5 py-0 text-left"
                  style={{
                    height: 32,
                    left: 0,
                    minWidth: 128,
                    position: "sticky",
                    width: 128,
                    zIndex: 10,
                  }}
                >
                  <span className="font-semibold text-console-ink">
                    {row.roomNumber}
                  </span>
                  <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.04em] text-slate-500">
                    {row.roomTypeLabel}
                  </span>
                </th>
                {row.cells.map((cell) => {
                  const classes = statusClasses[cell.status];

                  return (
                    <td
                      key={`${row.roomId}-${cell.dayIso}`}
                      className="border-b border-r border-console-border-soft p-0"
                      style={{ height: 32, minWidth: 64, width: 64 }}
                    >
                      <div
                        className={[
                          "overflow-hidden text-ellipsis whitespace-nowrap border-l-[3px] px-1.5 text-[11px] font-medium leading-[22px]",
                          classes.bg,
                          classes.border,
                          classes.text,
                        ].join(" ")}
                        data-reservation-id={cell.reservationId}
                        style={{
                          height: "calc(100% - 4px)",
                          margin: 2,
                        }}
                      >
                        {getCellLabel(cell)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
