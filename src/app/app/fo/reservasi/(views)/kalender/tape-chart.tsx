"use client";

import type { RoomStatus } from "@prisma/client";
import {
  BedDouble,
  ChevronDown,
  ChevronUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { addDateOnlyDays, parseISODateOnly } from "@/lib/date-only";
import { overlapsDateRange, ROOM_BLOCK_REASON_LABELS } from "@/lib/room-blocks/overlap";
import {
  DATE_HEADER_HEIGHT,
  GROUP_HEADER_HEIGHT,
  ROOM_LABEL_WIDTH,
  ROW_HEIGHT,
} from "@/lib/tape-chart-layout";
import type {
  TapeChartData,
  TapeChartReservationData,
  TapeChartRoomData,
  TapeChartRoomTypeData,
} from "@/lib/tape-chart-data";

import { reservationBarColors, roomBlockBarColors } from "./tape-chart-legend";
import styles from "./tape-chart.module.css";

export type TapeChartDay = {
  iso: string;
  dayNumber: string;
  monthLabel: string;
  isWeekend: boolean;
};

type TapeChartProps = {
  data: TapeChartData;
  days: TapeChartDay[];
  todayIso: string;
};

const BAR_VERTICAL_MARGIN = 4;
const MIN_DAY_WIDTH = 56;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const ROOM_STATUS_FULL_NAMES: Record<RoomStatus, string> = {
  VC: "Kosong bersih",
  OC: "Terisi bersih",
  VD: "Kosong kotor",
  OD: "Terisi kotor",
  VCU: "Bersih belum diperiksa",
  OOO: "Tidak beroperasi",
};

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
  const oooCount = roomType.rooms.filter(
    (room) => room.isBlockedToday || room.status === "OOO",
  ).length;

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
              {roomCount} kamar{oooCount ? ` / ${oooCount} OOO hari ini` : ""}
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

export function TapeChart({ data, days, todayIso }: TapeChartProps) {
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
  const roomBlockBars = visibleLayout.rows.flatMap((row) => {
    if (row.kind !== "room") return [];

    return row.room.roomBlocks.flatMap((block) => {
      if (block.status !== "ACTIVE") return [];
      // Blocks cover whole hotel dates, unlike the noon-to-noon stay bars.
      const start = clamp(getDateIndex(block.startDate, data.startDate), 0, data.dayCount);
      const end = clamp(getDateIndex(block.endDate, data.startDate), 0, data.dayCount);
      if (end <= start) return [];

      return [{
        block,
        roomNumber: row.room.number,
        gridColumn: `${start * 2 + 2} / ${end * 2 + 2}`,
        top: row.y + BAR_VERTICAL_MARGIN,
      }];
    });
  });
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
    <div className={styles.chartShell} style={layoutStyle}>
        {roomCount === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="Belum ada kamar di kalender"
            description="Tambahkan master kamar terlebih dahulu agar kalender dapat ditampilkan."
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
                    {day.iso === todayIso ? (
                      <span className={styles.todayLabel}>Hari ini</span>
                    ) : null}
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
                  const unavailableToday = row.room.isBlockedToday || row.room.status === "OOO";
                  const outOfOrderLabel = row.room.isBlockedToday ? "Out of Order" : "Status Fisik OOO";
                  return (
                    <div
                      key={`room-${row.room.id}`}
                      className={`${styles.gridRow} ${styles.roomRow}`}
                    >
                      <div
                        className={`${styles.labelCell} ${styles.roomLabelCell} flex items-center justify-between gap-2 border-b border-slate-100 px-3`}
                      >
                        <span className="min-w-0 text-xs font-semibold text-slate-800">
                          {row.room.number}
                        </span>
                        {unavailableToday ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-600"
                            aria-label={outOfOrderLabel}
                          >
                            <Wrench
                              className="h-3 w-3 text-red-500"
                              aria-hidden="true"
                            />
                            {outOfOrderLabel}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-semibold text-slate-500">
                            {ROOM_STATUS_FULL_NAMES[row.room.status]}
                          </span>
                        )}
                      </div>
                      {days.map((day) => {
                        const block = row.room.roomBlocks.find((candidate) =>
                          candidate.status === "ACTIVE" && overlapsDateRange(candidate, {
                            startDate: day.iso,
                            endDate: addDateOnlyDays(parseISODateOnly(day.iso), 1).toISOString().slice(0, 10),
                          }),
                        );
                        const isUnavailable = block || (day.iso === todayIso && unavailableToday);
                        const blockLabel = block
                          ? `Kamar ${row.room.number} ${day.iso}: Tidak tersedia — ${ROOM_BLOCK_REASON_LABELS[block.reason]}${block.note ? ` — ${block.note}` : ""}`
                          : `Kamar ${row.room.number} ${day.iso}: Tidak tersedia — ${row.room.isBlockedToday ? "Diblokir hari ini" : "Status Fisik OOO"}`;

                        return isUnavailable ? (
                          <div
                            key={`${row.room.id}-${day.iso}`}
                            className={getCellClassName(
                              day,
                              todayIso,
                              `${styles.outOfOrderCell} ${styles.unavailableCell}`,
                            )}
                            role="img"
                            title={blockLabel}
                            aria-label={blockLabel}
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
                        );
                      })}
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
                      <span className="min-w-0 text-xs font-semibold text-slate-800">
                        Belum dialokasikan
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                        {row.roomType.unallocatedReservations.length}
                        {row.laneCount > 1 ? ` / ${row.laneCount} baris` : ""}
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
                          styles.bookableCell,
                        )}
                        aria-label={`Buat reservasi ${row.roomType.name} tanpa alokasi kamar untuk ${day.iso}`}
                      />
                    ))}
                  </div>
                );
              })}

              <div className={styles.barLayer} aria-hidden={reservationBars.length === 0 && roomBlockBars.length === 0}>
                {reservationBars.map((bar) => {
                  const colors = reservationBarColors[bar.colorKey];
                  const barClassName = [
                    styles.reservationBar,
                    bar.hasCheckoutNotch ? styles.reservationBarNotched : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const barStyle = {
                    gridColumn: `${bar.gridColumnStart} / ${bar.gridColumnEnd}`,
                    top: bar.top,
                    height: bar.height,
                    backgroundColor: colors.bgColor,
                    color: colors.textColor,
                  };

                  return (
                    <Link
                      key={bar.key}
                      href={`/app/fo/reservasi/${bar.reservation.id}`}
                      className={barClassName}
                      aria-label={`${bar.reservation.guestName}, ${bar.label}, ${bar.reservation.checkInDate} hingga ${bar.reservation.checkOutDate}`}
                      style={barStyle}
                    >
                      <span className={styles.reservationBarText}>
                        {bar.reservation.guestName}
                      </span>
                    </Link>
                  );
                })}
                {roomBlockBars.map(({ block, roomNumber, gridColumn, top }) => {
                  const label = `Kamar ${roomNumber}: Diblokir — ${ROOM_BLOCK_REASON_LABELS[block.reason]}, ${block.startDate} hingga sebelum ${block.endDate}${block.note ? ` — ${block.note}` : ""}`;
                  return (
                    <div
                      key={`block-${block.id}`}
                      className={`${styles.reservationBar} ${styles.roomBlockBar}`}
                      role="img"
                      tabIndex={0}
                      aria-label={label}
                      title={label}
                      style={{
                        gridColumn,
                        top,
                        height: ROW_HEIGHT - BAR_VERTICAL_MARGIN * 2,
                        backgroundColor: roomBlockBarColors.bgColor,
                        color: roomBlockBarColors.textColor,
                      }}
                    >
                      <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className={styles.reservationBarText}>
                        Diblokir — {ROOM_BLOCK_REASON_LABELS[block.reason]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
