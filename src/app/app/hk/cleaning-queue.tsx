"use client";

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { RoomStatus } from "@prisma/client";

import { EmptyState } from "@/components/ui/empty-state";
import {
  RoomStatusGrid,
  StatusPill,
  type RoomStatusGridFloor,
} from "./room-status-grid";

export type CleaningQueueRow = {
  id: number;
  number: string;
  roomTypeName: string;
  status: Extract<RoomStatus, "VD" | "OD" | "VCU">;
  timeInStatusLabel: string;
  note: string | null;
  actionLabel: string;
  href: string;
};

type HKDashboardTabsProps = {
  queueRows: CleaningQueueRow[];
  floors: RoomStatusGridFloor[];
  canOverrideStatus?: boolean;
};

const filters = ["ALL", "VD", "OD", "VCU"] as const;
type QueueFilter = (typeof filters)[number];
type ActiveTab = "cleaning" | "status";

const filterLabels: Record<QueueFilter, string> = {
  ALL: "Semua",
  VD: "VD",
  OD: "OD",
  VCU: "VCU",
};

export function HKDashboardTabs({
  queueRows,
  floors,
  canOverrideStatus = false,
}: HKDashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("cleaning");
  const [activeFilter, setActiveFilter] = useState<QueueFilter>("ALL");

  const filteredRows = useMemo(() => {
    if (activeFilter === "ALL") {
      return queueRows;
    }

    return queueRows.filter((row) => row.status === activeFilter);
  }, [activeFilter, queueRows]);

  return (
    <section className="mt-4">
      <div className="sticky top-[57px] z-10 border-b border-slate-200 bg-slate-50 md:top-0">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveTab("cleaning")}
            className={[
              "min-h-11 flex-1 border-b-2 px-2 text-[11px] font-semibold font-medium tracking-tight",
              activeTab === "cleaning"
                ? "border-slate-300 hover:border-slate-400 text-slate-900"
                : "border-transparent text-slate-500",
            ].join(" ")}
          >
            Pembersihan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("status")}
            className={[
              "min-h-11 flex-1 border-b-2 px-2 text-[11px] font-semibold font-medium tracking-tight",
              activeTab === "status"
                ? "border-slate-300 hover:border-slate-400 text-slate-900"
                : "border-transparent text-slate-500",
            ].join(" ")}
          >
            Status Kamar
          </button>
        </div>
      </div>

      <div className="pt-3">
        {activeTab === "cleaning" ? (
          <CleaningQueue
            rows={filteredRows}
            totalRows={queueRows}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        ) : (
          <RoomStatusGrid
            floors={floors}
            canOverrideStatus={canOverrideStatus}
          />
        )}
      </div>
    </section>
  );
}

function CleaningQueue({
  rows,
  totalRows,
  activeFilter,
  onFilterChange,
}: {
  rows: CleaningQueueRow[];
  totalRows: CleaningQueueRow[];
  activeFilter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
}) {
  function countFor(filter: QueueFilter) {
    if (filter === "ALL") {
      return totalRows.length;
    }

    return totalRows.filter((row) => row.status === filter).length;
  }

  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => {
          const active = activeFilter === filter;

          return (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
              className={[
                "min-h-11 shrink-0 border px-3 text-[11px] font-semibold font-medium tracking-tight",
                active
                  ? "rounded-xl bg-blue-600 border-blue-600 shadow-sm text-blue-600"
                  : "border-slate-200 bg-white text-slate-900",
              ].join(" ")}
            >
              {filterLabels[filter]} · {countFor(filter)}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Tidak ada kamar yang perlu pembersihan"
          description={
            activeFilter === "ALL"
              ? "Semua kamar bersih atau tidak memerlukan aksi housekeeping saat ini."
              : "Tidak ada kamar pada status ini untuk antrean pembersihan."
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 10).map((row) => (
            <Link
              key={row.id}
              href={row.href}
              className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-3 transition-colors hover:bg-status-vc-bg"
            >
              <div className="min-w-0">
                <div className="flex items-end gap-2">
                  <div className="num text-[24px] font-bold leading-none text-slate-900">
                    {row.number}
                  </div>
                  <div className="truncate pb-0.5 text-[11px] text-slate-500">
                    {row.roomTypeName}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={row.status} />
                  <span className="text-[11px] text-slate-500">
                    {row.timeInStatusLabel}
                  </span>
                </div>
                {row.note ? (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-600">
                    {row.note}
                  </p>
                ) : null}
              </div>
              <span className="self-center border rounded-xl bg-blue-600 border-blue-600 shadow-sm px-3 py-2 text-[11px] font-semibold font-medium tracking-tight text-blue-600">
                {row.actionLabel}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
