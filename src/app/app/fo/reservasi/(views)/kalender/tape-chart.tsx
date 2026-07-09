"use client";

import {
  BedDouble,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  DATE_HEADER_HEIGHT,
  GROUP_HEADER_HEIGHT,
  ROOM_LABEL_WIDTH,
  ROW_HEIGHT,
} from "@/lib/tape-chart-layout";
import { reservationStatusColors } from "@/lib/reservation-status-colors";
import type {
  TapeChartData,
  TapeChartReservationData,
  TapeChartRoomData,
  TapeChartRoomTypeData,
} from "@/lib/tape-chart-data";

import styles from "./tape-chart.module.css";

export type TapeChartDay = {
  iso: string;
  dayOfWeek: string;
  dayNumber: string;
  monthLabel: string;
  isWeekend: boolean;
};

type TapeChartProps = {
  data: TapeChartData;
  days: TapeChartDay[];
  todayIso: string;
  previousHref: string;
  nextHref: string;
  todayHref: string;
  newReservationHref: string;
  rangeLabel: string;
};

const BAR_VERTICAL_MARGIN = 4;
const MIN_DAY_WIDTH = 56;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const reservationBarColors = {
  CONFIRMED: {
    label: "Confirmed",
    bgColor: reservationStatusColors.CONFIRMED.backgroundColor,
    textColor: reservationStatusColors.CONFIRMED.foregroundColor,
  },
  CHECKED_IN: {
    label: "Checked-in",
    bgColor: reservationStatusColors.CHECKED_IN.backgroundColor,
    textColor: reservationStatusColors.CHECKED_IN.foregroundColor,
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

type AllocatedBarColorKey = Exclude<
  keyof typeof reservationBarColors,
  "UNALLOCATED"
>;
type BarColorKey = keyof typeof reservationBarColors;

type UnallocatedLaneReservation = {
  reservation: TapeChartReservationData;
  laneIndex: number;
};

type VisibleLayoutRow =
  | {
      kind: "group";
      roomType: TapeChartRoomTypeData;
      isCollapsed: boolean;
      y: number;
      height: number;
    }
  | {
      kind: "room";
      roomType: TapeChartRoomTypeData;
      room: TapeChartRoomData;
      y: number;
      height: number;
    }
  | {
      kind: "unallocated";
      roomType: TapeChartRoomTypeData;
      lanes: UnallocatedLaneReservation[];
      laneCount: number;
      y: number;
      height: number;
    };

type ReservationBar = {
  key: string;
  reservation: TapeChartReservationData;
  label: string;
  gridColumnStart: number;
  gridColumnEnd: number;
  top: number;
  height: number;
  colorKey: BarColorKey;
  hasCheckoutNotch: boolean;
};

function isoDayValue(isoDate: string) {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);

  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function getDateIndex(isoDate: string, startIso: string) {
  return isoDayValue(isoDate) - isoDayValue(startIso);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getAllocatedBarColorKey(
  reservation: TapeChartReservationData,
): AllocatedBarColorKey {
  switch (reservation.status) {
    case "CONFIRMED":
      return "CONFIRMED";
    case "CHECKED_IN":
      return "CHECKED_IN";
    case "CHECKED_OUT":
      return "CHECKED_OUT";
    default:
      return "CHECKED_OUT";
  }
}

function getReservationSpan(
  reservation: TapeChartReservationData,
  startIso: string,
  dayCount: number,
) {
  const gridLeft = 0;
  const gridRight = dayCount * 2;
  const leftRaw = getDateIndex(reservation.checkInDate, startIso) * 2 + 1;
  const rightRaw = getDateIndex(reservation.checkOutDate, startIso) * 2 + 1;
  const startHalfIndex = clamp(leftRaw, gridLeft, gridRight);
  const endHalfIndex = clamp(rightRaw, gridLeft, gridRight);

  return {
    gridColumnStart: startHalfIndex + 2,
    gridColumnEnd: endHalfIndex + 2,
    span: endHalfIndex - startHalfIndex,
    hasCheckoutNotch: rightRaw <= gridRight && rightRaw > gridLeft,
  };
}

function assignUnallocatedLanes(
  reservations: TapeChartReservationData[],
  startIso: string,
) {
  const laneEnds: number[] = [];

  return [...reservations]
    .sort((first, second) => {
      const startDelta =
        getDateIndex(first.checkInDate, startIso) -
        getDateIndex(second.checkInDate, startIso);

      if (startDelta !== 0) {
        return startDelta;
      }

      const endDelta =
        getDateIndex(first.checkOutDate, startIso) -
        getDateIndex(second.checkOutDate, startIso);

      return endDelta !== 0 ? endDelta : first.id - second.id;
    })
    .map((reservation) => {
      const startIndex = getDateIndex(reservation.checkInDate, startIso);
      const endIndex = getDateIndex(reservation.checkOutDate, startIso);
      const existingLaneIndex = laneEnds.findIndex(
        (laneEnd) => laneEnd <= startIndex,
      );
      const laneIndex =
        existingLaneIndex === -1 ? laneEnds.length : existingLaneIndex;

      laneEnds[laneIndex] = endIndex;

      return { reservation, laneIndex };
    });
}

function buildVisibleLayout(
  roomTypes: TapeChartRoomTypeData[],
  collapsedGroupIds: Set<number>,
  startIso: string,
) {
  const rows: VisibleLayoutRow[] = [];
  let y = DATE_HEADER_HEIGHT;

  for (const roomType of roomTypes) {
    const isCollapsed = collapsedGroupIds.has(roomType.id);

    rows.push({
      kind: "group",
      roomType,
      isCollapsed,
      y,
      height: GROUP_HEADER_HEIGHT,
    });
    y += GROUP_HEADER_HEIGHT;

    if (isCollapsed) {
      continue;
    }

    for (const room of roomType.rooms) {
      rows.push({
        kind: "room",
        roomType,
        room,
        y,
        height: ROW_HEIGHT,
      });
      y += ROW_HEIGHT;
    }

    const lanes = assignUnallocatedLanes(
      roomType.unallocatedReservations,
      startIso,
    );
    const laneCount =
      lanes.reduce((count, lane) => Math.max(count, lane.laneIndex + 1), 0) ||
      1;
    const height = laneCount * ROW_HEIGHT;

    rows.push({
      kind: "unallocated",
      roomType,
      lanes,
      laneCount,
      y,
      height,
    });
    y += height;
  }

  return { rows, height: y };
}

function buildReservationBars(
  rows: VisibleLayoutRow[],
  startIso: string,
  dayCount: number,
): ReservationBar[] {
  const bars: ReservationBar[] = [];
  const barHeight = ROW_HEIGHT - BAR_VERTICAL_MARGIN * 2;

  for (const row of rows) {
    if (row.kind === "room") {
      for (const reservation of row.room.reservations) {
        const span = getReservationSpan(reservation, startIso, dayCount);
        const colorKey = getAllocatedBarColorKey(reservation);

        if (span.span <= 0) {
          continue;
        }

        bars.push({
          key: `room-${row.room.id}-${reservation.id}`,
          reservation,
          label: reservationBarColors[colorKey].label,
          gridColumnStart: span.gridColumnStart,
          gridColumnEnd: span.gridColumnEnd,
          top: row.y + BAR_VERTICAL_MARGIN,
          height: barHeight,
          colorKey,
          hasCheckoutNotch: span.hasCheckoutNotch,
        });
      }
    }

    if (row.kind === "unallocated") {
      for (const lane of row.lanes) {
        const span = getReservationSpan(lane.reservation, startIso, dayCount);

        if (span.span <= 0) {
          continue;
        }

        bars.push({
          key: `unallocated-${row.roomType.id}-${lane.reservation.id}`,
          reservation: lane.reservation,
          label: reservationBarColors.UNALLOCATED.label,
          gridColumnStart: span.gridColumnStart,
          gridColumnEnd: span.gridColumnEnd,
          top:
            row.y +
            lane.laneIndex * ROW_HEIGHT +
            BAR_VERTICAL_MARGIN,
          height: barHeight,
          colorKey: "UNALLOCATED",
          hasCheckoutNotch: span.hasCheckoutNotch,
        });
      }
    }
  }

  return bars;
}

function getCellClassName(day: TapeChartDay, todayIso: string, extra = "") {
  return [
    styles.gridCell,
    day.isWeekend ? styles.weekendCell : "",
    day.iso === todayIso ? styles.todayCell : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function getNewReservationHref(params: {
  dayIso: string;
  roomId?: number;
  roomTypeId?: number;
}) {
  const searchParams = new URLSearchParams({
    arrival: params.dayIso,
    from: "kalender",
  });

  if (typeof params.roomId === "number") {
    searchParams.set("roomId", String(params.roomId));
  } else if (typeof params.roomTypeId === "number") {
    searchParams.set("roomTypeId", String(params.roomTypeId));
  }

  return `/app/fo/reservasi/new?${searchParams.toString()}`;
}

function TapeChartNavButton({
  href,
  label,
  direction,
}: {
  href: string;
  label: string;
  direction: "previous" | "next";
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function TapeChartLegend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3 text-xs font-medium text-slate-500 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>Legenda:</span>
        {legendItems.map((item) => (
          <span
            key={item.label}
            className="inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium"
            style={{
              backgroundColor: item.bgColor,
              color: item.textColor,
            }}
          >
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: item.bgColor }}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function GroupRow({
  roomType,
  days,
  todayIso,
  isCollapsed,
  onToggle,
}: {
  roomType: TapeChartRoomTypeData;
  days: TapeChartDay[];
  todayIso: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const Icon = isCollapsed ? ChevronDown : ChevronUp;
  const roomCount = roomType.rooms.length;
  const oooCount = roomType.rooms.filter((room) => room.isOutOfOrder).length;

  return (
    <div className={`${styles.gridRow} ${styles.groupRow}`}>
      <div className={`${styles.labelCell} ${styles.groupLabelCell}`}>
        <button
          type="button"
          aria-expanded={!isCollapsed}
          onClick={onToggle}
          className="flex h-full w-full items-center gap-2 px-2.5 text-left hover:bg-slate-100 transition-colors"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-slate-900">
              {roomType.name}
            </span>
            <span className="block text-xs text-slate-500">
              {roomCount} rooms{oooCount ? ` / ${oooCount} OOO` : ""}
            </span>
          </span>
        </button>
      </div>
      {days.map((day) => (
        <div
          key={`${roomType.id}-${day.iso}`}
          className={getCellClassName(day, todayIso, styles.groupCell)}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function TapeChart({
  data,
  days,
  todayIso,
  previousHref,
  nextHref,
  todayHref,
  newReservationHref,
  rangeLabel,
}: TapeChartProps) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<number>>(
    () => new Set(),
  );
  const roomCount = data.roomTypes.reduce(
    (count, roomType) => count + roomType.rooms.length,
    0,
  );
  const gridMinWidth = ROOM_LABEL_WIDTH + days.length * MIN_DAY_WIDTH;
  const visibleLayout = useMemo(
    () => buildVisibleLayout(data.roomTypes, collapsedGroupIds, data.startDate),
    [collapsedGroupIds, data.roomTypes, data.startDate],
  );
  const reservationBars = useMemo(
    () =>
      buildReservationBars(visibleLayout.rows, data.startDate, data.dayCount),
    [data.dayCount, data.startDate, visibleLayout.rows],
  );
  const layoutStyle = {
    "--day-min-width": `${MIN_DAY_WIDTH}px`,
    "--date-header-height": `${DATE_HEADER_HEIGHT}px`,
    "--group-header-height": `${GROUP_HEADER_HEIGHT}px`,
    "--half-day-min-width": `${MIN_DAY_WIDTH / 2}px`,
    "--half-day-count": days.length * 2,
    "--room-label-width": `${ROOM_LABEL_WIDTH}px`,
    "--row-height": `${ROW_HEIGHT}px`,
  } as CSSProperties;

  function toggleGroup(roomTypeId: number) {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);

      if (next.has(roomTypeId)) {
        next.delete(roomTypeId);
      } else {
        next.add(roomTypeId);
      }

      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Kalender
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <TapeChartNavButton
              href={previousHref}
              label="Tanggal sebelumnya"
              direction="previous"
            />
            <div className="flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm">
              <span>{rangeLabel}</span>
            </div>
            <TapeChartNavButton
              href={nextHref}
              label="Tanggal berikutnya"
              direction="next"
            />
          </div>
          <Link
            href={todayHref}
            className="flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            Today
          </Link>
          <Link
            href={newReservationHref}
            className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Reservasi
          </Link>
        </div>
      </div>

      <TapeChartLegend />

      <div className={styles.chartShell} style={layoutStyle}>
        {roomCount === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="Belum ada kamar di tape chart"
            description="Tambahkan master kamar terlebih dahulu agar grid skeleton dapat ditampilkan."
            className="m-3.5 min-h-72"
          />
        ) : (
          <div className={styles.scrollArea}>
            <div
              className={styles.grid}
              style={{ minWidth: gridMinWidth, height: visibleLayout.height }}
            >
              <div className={styles.headerRow}>
                <div
                  className={`${styles.labelCell} ${styles.headerLabelCell} flex items-center px-3 text-left text-xs font-semibold uppercase tracking-wider`}
                >
                  Kamar
                </div>
                {days.map((day) => (
                  <div
                    key={day.iso}
                    className={[
                      styles.dateHeaderCell,
                      day.isWeekend ? styles.dateHeaderWeekend : "",
                      day.iso === todayIso ? styles.dateHeaderToday : "",
                      "flex flex-col items-center justify-center text-center",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span
                      className={
                        day.iso === todayIso
                          ? styles.todayLabel
                          : "text-[10px] font-medium uppercase text-slate-500"
                      }
                    >
                      {day.iso === todayIso ? "Today" : day.dayOfWeek}
                    </span>
                    <span className="text-sm font-bold leading-tight text-slate-800">
                      {day.dayNumber} {day.monthLabel}
                    </span>
                  </div>
                ))}
              </div>

              {visibleLayout.rows.map((row) => {
                if (row.kind === "group") {
                  return (
                    <GroupRow
                      key={`group-${row.roomType.id}`}
                      roomType={row.roomType}
                      days={days}
                      todayIso={todayIso}
                      isCollapsed={row.isCollapsed}
                      onToggle={() => toggleGroup(row.roomType.id)}
                    />
                  );
                }

                if (row.kind === "room") {
                  return (
                    <div
                      key={`room-${row.room.id}`}
                      className={`${styles.gridRow} ${styles.roomRow}`}
                    >
                      <div
                        className={[
                          styles.labelCell,
                          styles.roomLabelCell,
                          row.room.isOutOfOrder
                            ? styles.roomLabelCellOutOfOrder
                            : "",
                          "flex items-center justify-between gap-2 border-b border-slate-100 px-3",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800">
                            {row.room.number}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-slate-500">
                            L{row.room.floor}
                          </span>
                        </span>
                        {row.room.isOutOfOrder ? (
                          <span
                            className={styles.outOfOrderBadge}
                            aria-label="Out of Order"
                          >
                            <Wrench className="h-3 w-3" aria-hidden="true" />
                            Out of Order
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                            {row.room.status}
                          </span>
                        )}
                      </div>
                      {days.map((day) => (
                        row.room.isOutOfOrder ? (
                          <div
                            key={`${row.room.id}-${day.iso}`}
                            className={getCellClassName(
                              day,
                              todayIso,
                              styles.outOfOrderCell,
                            )}
                            aria-label={`${row.room.number} ${day.iso}: Out of Order`}
                          />
                        ) : (
                          <Link
                            key={`${row.room.id}-${day.iso}`}
                            href={getNewReservationHref({
                              roomId: row.room.id,
                              dayIso: day.iso,
                            })}
                            className={getCellClassName(
                              day,
                              todayIso,
                              styles.bookableCell,
                            )}
                            aria-label={`Buat reservasi kamar ${row.room.number} untuk ${day.iso}`}
                          />
                        )
                      ))}
                    </div>
                  );
                }

                return (
                  <div
                    key={`unallocated-${row.roomType.id}`}
                    className={`${styles.gridRow} ${styles.unallocatedRow}`}
                    style={{ height: row.height }}
                  >
                    <div
                      className={`${styles.labelCell} ${styles.unallocatedLabelCell} flex items-center justify-between gap-2 border-b border-slate-100 px-3`}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                        Unallocated
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {row.roomType.unallocatedReservations.length}
                        {row.laneCount > 1 ? ` / ${row.laneCount} lanes` : ""}
                      </span>
                    </div>
                    {days.map((day) => (
                      <Link
                        key={`${row.roomType.id}-unallocated-${day.iso}`}
                        href={getNewReservationHref({
                          roomTypeId: row.roomType.id,
                          dayIso: day.iso,
                        })}
                        className={getCellClassName(
                          day,
                          todayIso,
                          `${styles.unallocatedCell} ${styles.bookableCell}`,
                        )}
                        aria-label={`Buat reservasi ${row.roomType.name} tanpa alokasi kamar untuk ${day.iso}`}
                      />
                    ))}
                  </div>
                );
              })}

              <div className={styles.barLayer} aria-hidden={reservationBars.length === 0}>
                {reservationBars.map((bar) => {
                  const colors = reservationBarColors[bar.colorKey];

                  return (
                    <Link
                      key={bar.key}
                      href={`/app/fo/reservasi/${bar.reservation.id}`}
                      className={[
                        styles.reservationBar,
                        bar.hasCheckoutNotch ? styles.reservationBarNotched : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={`${bar.reservation.guestName}, ${bar.label}, ${bar.reservation.checkInDate} to ${bar.reservation.checkOutDate}`}
                      style={{
                        gridColumn: `${bar.gridColumnStart} / ${bar.gridColumnEnd}`,
                        top: bar.top,
                        height: bar.height,
                        backgroundColor: colors.bgColor,
                        color: colors.textColor,
                      }}
                    >
                      <span className={styles.reservationBarText}>
                        {bar.reservation.guestName}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
