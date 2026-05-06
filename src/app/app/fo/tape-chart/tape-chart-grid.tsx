"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent } from "react";
import type { RoomStatus } from "@prisma/client";

import styles from "./tape-chart-grid.module.css";

type TapeCellStatus = RoomStatus;

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
  TapeCellStatus,
  { bg: string; border: string; text: string; accent: string; hoverBg: string }
> = {
  VC: {
    bg: "bg-status-vc-bg",
    border: "border-status-vc-pip",
    text: "text-slate-700",
    accent: "var(--emerald-500)",
    hoverBg: "#d1fae5",
  },
  OC: {
    bg: "bg-status-oc-bg",
    border: "border-status-oc-pip",
    text: "text-status-oc-fg",
    accent: "var(--blue-500)",
    hoverBg: "#dbeafe",
  },
  VD: {
    bg: "bg-status-vd-bg",
    border: "border-status-vd-pip",
    text: "text-status-vd-fg",
    accent: "var(--amber-500)",
    hoverBg: "#fef3c7",
  },
  OD: {
    bg: "bg-status-od-bg",
    border: "border-status-od-pip",
    text: "text-status-od-fg",
    accent: "var(--red-500)",
    hoverBg: "#fee2e2",
  },
  OOO: {
    bg: "bg-status-ooo-bg",
    border: "border-status-ooo-pip",
    text: "text-status-ooo-fg",
    accent: "var(--slate-500)",
    hoverBg: "var(--slate-200)",
  },
};

function getCellLabel(cell: TapeChartCell) {
  return cell.guestLabel ?? cell.status;
}

function isOccupiedCell(cell: TapeChartCell) {
  return Boolean(
    cell.reservationId && (cell.status === "OC" || cell.status === "OD"),
  );
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
                  const isOccupied = isOccupiedCell(cell);
                  const isConfirmedReservation = isOccupied && !cell.folioId;

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
                      role="button"
                      style={{ height: 32, minWidth: 64, width: 64 }}
                      tabIndex={0}
                    >
                      <div
                        className={[
                          "overflow-hidden text-ellipsis whitespace-nowrap px-1.5 text-[11px] font-medium leading-[22px]",
                          isConfirmedReservation
                            ? "border border-dashed"
                            : "border-l-[3px]",
                          isOccupied ? styles.occupiedCell : styles.emptyCell,
                          classes.bg,
                          classes.border,
                          classes.text,
                        ].join(" ")}
                        data-folio-id={cell.folioId}
                        data-reservation-id={cell.reservationId}
                        style={
                          {
                            "--tape-cell-accent": classes.accent,
                            "--tape-cell-hover-bg": classes.hoverBg,
                            height: "calc(100% - 4px)",
                            margin: 2,
                          } as CSSProperties
                        }
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
