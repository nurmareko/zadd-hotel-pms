"use client";

import { BedDouble } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent } from "react";
import type { RoomStatus } from "@prisma/client";

import { EmptyState } from "@/components/ui/empty-state";

import styles from "./tape-chart-grid.module.css";

type TapeCellStatus = RoomStatus;
type TapeVisualState = TapeCellStatus | "CONFIRMED" | "CHECKED_IN";

export type TapeChartCell = {
  dayIso: string;
  status: TapeCellStatus;
  guestLabel?: string;
  reservationId?: number;
  folioId?: number;
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
  TapeVisualState,
  {
    bgColor: string;
    textColor: string;
    cueColor: string;
    hoverBg: string;
    cue: string;
    treatment: string;
    pattern?: string;
  }
> = {
  VC: {
    bgColor: "#639922",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    hoverBg: "#639922",
    cue: "VC",
    treatment: "border-l-[3px]",
  },
  OC: {
    bgColor: "#7F77DD",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    hoverBg: "#7F77DD",
    cue: "OC",
    treatment: "border-l-[3px]",
  },
  CONFIRMED: {
    bgColor: "#378ADD",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    hoverBg: "#378ADD",
    cue: "CNF",
    treatment: "border border-dashed",
  },
  CHECKED_IN: {
    bgColor: "#7F77DD",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    hoverBg: "#7F77DD",
    cue: "IN",
    treatment: "border-l-[3px]",
  },
  VD: {
    bgColor: "#D85A30",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    hoverBg: "#D85A30",
    cue: "VD",
    treatment: "border-l-[3px]",
  },
  OD: {
    bgColor: "#D85A30",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.82)",
    hoverBg: "#D85A30",
    cue: "OD",
    treatment: "border-l-[3px]",
  },
  VCU: {
    bgColor: "#EF9F27",
    textColor: "#412402",
    cueColor: "rgb(65 36 2 / 0.58)",
    hoverBg: "#EF9F27",
    cue: "VCU",
    treatment: "border border-dotted",
    pattern: styles.vcuCell,
  },
  OOO: {
    bgColor: "#888780",
    textColor: "#FFFFFF",
    cueColor: "rgb(255 255 255 / 0.78)",
    hoverBg: "#888780",
    cue: "OOO",
    treatment: "border border-solid",
    pattern: styles.outOfOrderCell,
  },
};

function isOccupiedCell(cell: TapeChartCell) {
  return Boolean(
    cell.reservationId && (cell.status === "OC" || cell.status === "OD"),
  );
}

function getVisualState(cell: TapeChartCell): TapeVisualState {
  if (cell.folioId) {
    return "CHECKED_IN";
  }

  if (cell.reservationId) {
    return "CONFIRMED";
  }

  return cell.status;
}

function getStateLabel(state: TapeVisualState) {
  switch (state) {
    case "CONFIRMED":
      return "Confirmed reservation";
    case "CHECKED_IN":
      return "Checked-in guest";
    case "VC":
      return "Vacant Clean";
    case "OC":
      return "Occupied Clean";
    case "VD":
      return "Vacant Dirty";
    case "OD":
      return "Occupied Dirty";
    case "VCU":
      return "Vacant Clean Unchecked";
    case "OOO":
      return "Out of Order";
  }
}

export function TapeChartGrid({ days, rows }: TapeChartGridProps) {
  const router = useRouter();
  const tableMinWidth = 128 + days.length * 64;

  function handleCellNavigation(row: TapeChartRow, cell: TapeChartCell) {
    if (cell.folioId) {
      router.push(`/app/fo/folios/${cell.folioId}`);
      return;
    }

    if (cell.reservationId) {
      router.push(`/app/fo/reservations/${cell.reservationId}`);
      return;
    }

    router.push(
      `/app/fo/reservations/new?roomId=${row.roomId}&arrival=${cell.dayIso}`,
    );
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLTableCellElement>,
    row: TapeChartRow,
    cell: TapeChartCell,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleCellNavigation(row, cell);
  }

  return (
    <div
      className="border border-console-border bg-console-surface"
      style={{ maxHeight: 520, overflow: "hidden", padding: 0 }}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="Belum ada kamar di tape chart"
          description="Tambahkan master kamar terlebih dahulu agar grid okupansi dapat ditampilkan."
          className="m-3.5 min-h-72"
        />
      ) : (
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
                  const visualState = getVisualState(cell);
                  const classes = statusClasses[visualState];
                  const isOccupied = isOccupiedCell(cell);

                  return (
                    <td
                      key={`${row.roomId}-${cell.dayIso}`}
                      className={[
                        styles.cell,
                        "border-b border-r border-console-border-soft p-0",
                      ].join(" ")}
                      onClick={() => handleCellNavigation(row, cell)}
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, row, cell)
                      }
                      aria-label={`${row.roomNumber} ${cell.dayIso}: ${getStateLabel(
                        visualState,
                      )}${cell.guestLabel ? `, ${cell.guestLabel}` : ""}`}
                      role="button"
                      style={{ height: 32, minWidth: 64, width: 64 }}
                      tabIndex={0}
                    >
                      <div
                        className={[
                          "flex items-center gap-1 overflow-hidden whitespace-nowrap px-1 text-[11px] font-medium leading-[22px]",
                          classes.treatment,
                          isOccupied ? styles.occupiedCell : styles.emptyCell,
                          classes.pattern,
                        ].join(" ")}
                        data-folio-id={cell.folioId}
                        data-reservation-id={cell.reservationId}
                        style={
                          {
                            "--tape-cell-cue": classes.cueColor,
                            "--tape-cell-hover-bg": classes.hoverBg,
                            backgroundColor: classes.bgColor,
                            borderColor: classes.cueColor,
                            color: classes.textColor,
                            height: "calc(100% - 4px)",
                            margin: 2,
                            textShadow:
                              classes.textColor === "#FFFFFF"
                                ? "0 1px 1px rgb(0 0 0 / 0.35)"
                                : "none",
                          } as CSSProperties
                        }
                      >
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.04em]">
                          {classes.cue}
                        </span>
                        {cell.guestLabel ? (
                          <span className="min-w-0 truncate">
                            {cell.guestLabel}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
