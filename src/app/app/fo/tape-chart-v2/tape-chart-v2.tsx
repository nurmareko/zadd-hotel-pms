"use client";

import { BedDouble, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  COLUMN_WIDTH,
  DATE_HEADER_HEIGHT,
  GROUP_HEADER_HEIGHT,
  ROOM_LABEL_WIDTH,
  ROW_HEIGHT,
} from "@/lib/tape-chart-layout";
import type { TapeChartData, TapeChartRoomTypeData } from "@/lib/tape-chart-data";

import styles from "./tape-chart-v2.module.css";

export type TapeChartV2Day = {
  iso: string;
  dayOfWeek: string;
  dayNumber: string;
  monthLabel: string;
  isWeekend: boolean;
};

type TapeChartV2Props = {
  data: TapeChartData;
  days: TapeChartV2Day[];
  todayIso: string;
  previousHref: string;
  nextHref: string;
  todayHref: string;
  newReservationHref: string;
  rangeLabel: string;
};

function getCellClassName(day: TapeChartV2Day, todayIso: string, extra = "") {
  return [
    styles.gridCell,
    day.isWeekend ? styles.weekendCell : "",
    day.iso === todayIso ? styles.todayCell : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function getVisibleHeight(
  roomTypes: TapeChartRoomTypeData[],
  collapsedGroupIds: Set<number>,
) {
  return roomTypes.reduce((height, roomType) => {
    if (collapsedGroupIds.has(roomType.id)) {
      return height + GROUP_HEADER_HEIGHT;
    }

    return height + GROUP_HEADER_HEIGHT + (roomType.rooms.length + 1) * ROW_HEIGHT;
  }, DATE_HEADER_HEIGHT);
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
      className="flex h-8 w-8 items-center justify-center border border-console-border bg-console-surface text-console-ink hover:border-console-ink hover:bg-console-bg"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
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
  days: TapeChartV2Day[];
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
          className="flex h-full w-full items-center gap-2 px-2.5 text-left hover:bg-slate-200"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-bold uppercase tracking-[0.08em] text-console-ink">
              {roomType.code} / {roomType.name}
            </span>
            <span className="block text-[10px] text-slate-500">
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

export function TapeChartV2({
  data,
  days,
  todayIso,
  previousHref,
  nextHref,
  todayHref,
  newReservationHref,
  rangeLabel,
}: TapeChartV2Props) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<number>>(
    () => new Set(),
  );
  const roomCount = data.roomTypes.reduce(
    (count, roomType) => count + roomType.rooms.length,
    0,
  );
  const gridWidth = ROOM_LABEL_WIDTH + days.length * COLUMN_WIDTH;
  const gridHeight = useMemo(
    () => getVisibleHeight(data.roomTypes, collapsedGroupIds),
    [collapsedGroupIds, data.roomTypes],
  );
  const layoutStyle = {
    "--column-width": `${COLUMN_WIDTH}px`,
    "--date-header-height": `${DATE_HEADER_HEIGHT}px`,
    "--group-header-height": `${GROUP_HEADER_HEIGHT}px`,
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Tape Chart V2
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Stage 2 grid skeleton / reservation bars pending Stage 3.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <TapeChartNavButton
              href={previousHref}
              label="Tanggal sebelumnya"
              direction="previous"
            />
            <div className="flex h-8 items-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold tracking-[0.04em]">
              <span className="num">{rangeLabel}</span>
            </div>
            <TapeChartNavButton
              href={nextHref}
              label="Tanggal berikutnya"
              direction="next"
            />
          </div>
          <Link
            href={todayHref}
            className="flex h-8 items-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Today
          </Link>
          <Link
            href={newReservationHref}
            className="flex h-8 items-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Reservasi
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border border-console-border bg-console-surface px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-slate-500">
        <span>
          Grid / {roomCount} rooms / {data.dayCount} days
        </span>
        <span>
          {COLUMN_WIDTH}px cols / {ROW_HEIGHT}px rows / {ROOM_LABEL_WIDTH}px labels
        </span>
      </div>

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
              style={{ width: gridWidth, height: gridHeight }}
            >
              <div className={styles.headerRow}>
                <div
                  className={`${styles.labelCell} ${styles.headerLabelCell} flex items-center px-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em]`}
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
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                      {day.dayOfWeek}
                    </span>
                    <span className="num text-[12px] font-semibold text-white">
                      {day.dayNumber} {day.monthLabel}
                    </span>
                    {day.iso === todayIso ? (
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-console-accent">
                        Today
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              {data.roomTypes.map((roomType) => {
                const isCollapsed = collapsedGroupIds.has(roomType.id);

                return (
                  <div key={roomType.id}>
                    <GroupRow
                      roomType={roomType}
                      days={days}
                      todayIso={todayIso}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleGroup(roomType.id)}
                    />
                    {isCollapsed
                      ? null
                      : roomType.rooms.map((room) => (
                          <div
                            key={room.id}
                            className={`${styles.gridRow} ${styles.roomRow}`}
                          >
                            <div
                              className={[
                                styles.labelCell,
                                styles.roomLabelCell,
                                room.isOutOfOrder
                                  ? styles.roomLabelCellOutOfOrder
                                  : "",
                                "flex items-center justify-between gap-2 border-b border-console-border-soft px-2.5",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="num text-[12px] font-semibold text-console-ink">
                                  {room.number}
                                </span>
                                <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-slate-500">
                                  L{room.floor}
                                </span>
                              </span>
                              {room.isOutOfOrder ? (
                                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.06em] text-status-ooo-fg">
                                  Out of Order
                                </span>
                              ) : (
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                                  {room.status}
                                </span>
                              )}
                            </div>
                            {days.map((day) => (
                              <div
                                key={`${room.id}-${day.iso}`}
                                className={getCellClassName(
                                  day,
                                  todayIso,
                                  room.isOutOfOrder ? styles.outOfOrderCell : "",
                                )}
                                aria-label={`${room.number} ${day.iso}${
                                  room.isOutOfOrder ? ": Out of Order" : ""
                                }`}
                              />
                            ))}
                          </div>
                        ))}
                    {isCollapsed ? null : (
                      <div
                        className={`${styles.gridRow} ${styles.unallocatedRow}`}
                      >
                        <div
                          className={`${styles.labelCell} ${styles.unallocatedLabelCell} flex items-center justify-between gap-2 border-b border-console-border-soft px-2.5`}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                            Unallocated
                          </span>
                          <span className="num text-[10px] text-slate-500">
                            {roomType.unallocatedReservations.length}
                          </span>
                        </div>
                        {days.map((day) => (
                          <div
                            key={`${roomType.id}-unallocated-${day.iso}`}
                            className={getCellClassName(
                              day,
                              todayIso,
                              styles.unallocatedCell,
                            )}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
