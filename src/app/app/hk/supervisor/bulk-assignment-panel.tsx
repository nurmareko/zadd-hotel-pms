"use client";

import type { RoomStatus } from "@prisma/client";
import { Trash2, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { consoleButtonClassName } from "@/components/console-button";
import type {
  HousekeepingForecastHousekeeperLoad,
  HousekeepingForecastReason,
  HousekeepingForecastRoomRow,
} from "@/lib/housekeeping-forecast-data";
import { cn } from "@/lib/utils";

import {
  assignHousekeepingRooms,
  unassignHousekeepingRooms,
} from "./actions";

type FloorGroup = {
  floor: number;
  rows: HousekeepingForecastRoomRow[];
};

const statusClassNames: Record<
  RoomStatus,
  { badge: string; pip: string }
> = {
  VC: {
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
  },
  OC: {
    badge: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
    pip: "bg-status-oc-pip",
  },
  VD: {
    badge: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
    pip: "bg-status-vd-pip",
  },
  OD: {
    badge: "border-status-od-pip bg-status-od-bg text-status-od-fg",
    pip: "bg-status-od-pip",
  },
  VCU: {
    badge: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
    pip: "bg-status-vcu-pip",
  },
  OOO: {
    badge: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
    pip: "bg-status-ooo-pip",
  },
};

const reasonLabels: Record<HousekeepingForecastReason, string> = {
  turnover: "Turnover",
  "freshen-up": "Freshen-up",
  "arrival-prep": "Arrival prep",
  "dirty-now": "Dirty saat ini",
};

const headerCellClass =
  "bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent";
const bodyCellClass =
  "border-b border-console-border-soft px-3 py-[9px] align-top";

function FloorSelectCheckbox({
  checked,
  indeterminate,
  disabled,
  floor,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  floor: number;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={`Pilih semua lantai ${floor}`}
      className="h-4 w-4 accent-console-ink disabled:cursor-not-allowed"
    />
  );
}

function StatusCell({ status }: { status: RoomStatus }) {
  const classes = statusClassNames[status];

  return (
    <StatusBadge
      label={status}
      className={classes.badge}
      pipClassName={classes.pip}
      size="md"
    />
  );
}

function AttentionCell({ row }: { row: HousekeepingForecastRoomRow }) {
  if (!row.needsAttention) {
    return (
      <StatusBadge
        label="Tidak ada kebutuhan terjadwal"
        className="border-console-border bg-console-bg text-slate-500"
        pipClassName="bg-slate-400"
      />
    );
  }

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1.5">
      {row.reasons.map((reason) => (
        <StatusBadge
          key={reason}
          label={reasonLabels[reason]}
          className="border-console-ink bg-console-ink text-console-accent"
          pipClassName="bg-console-accent"
        />
      ))}
    </div>
  );
}

function AssigneeCell({ row }: { row: HousekeepingForecastRoomRow }) {
  if (!row.assignment) {
    return (
      <span className="text-[11px] italic text-slate-400">
        Belum ditugaskan
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-console-border bg-console-bg text-[10px] font-bold text-console-ink">
        {row.assignment.housekeeperInitials}
      </span>
      <span className="text-[12px] font-semibold text-console-ink">
        {row.assignment.housekeeperName}
      </span>
    </div>
  );
}

function groupRowsByFloor(rows: HousekeepingForecastRoomRow[]) {
  const floors = new Map<number, HousekeepingForecastRoomRow[]>();

  for (const row of rows) {
    const floorRows = floors.get(row.room.floor) ?? [];
    floorRows.push(row);
    floors.set(row.room.floor, floorRows);
  }

  return [...floors.entries()]
    .sort(([firstFloor], [secondFloor]) => firstFloor - secondFloor)
    .map(([floor, floorRows]) => ({ floor, rows: floorRows }));
}

export function BulkAssignmentPanel({
  dateISO,
  housekeepers,
  rooms,
}: {
  dateISO: string;
  housekeepers: HousekeepingForecastHousekeeperLoad[];
  rooms: HousekeepingForecastRoomRow[];
}) {
  const router = useRouter();
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [selectedHousekeeperId, setSelectedHousekeeperId] = useState(
    () => housekeepers[0]?.id.toString() ?? "",
  );
  const [pendingAction, setPendingAction] = useState<
    "assign" | "unassign" | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const groupedFloors = useMemo(() => groupRowsByFloor(rooms), [rooms]);
  const selectedCount = selectedRoomIds.size;
  const housekeeperId = housekeepers.some(
    (housekeeper) => housekeeper.id.toString() === selectedHousekeeperId,
  )
    ? selectedHousekeeperId
    : (housekeepers[0]?.id.toString() ?? "");

  function toggleRoom(roomId: number, checked: boolean) {
    setSelectedRoomIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(roomId);
      } else {
        next.delete(roomId);
      }

      return next;
    });
  }

  function toggleFloor(floor: FloorGroup, checked: boolean) {
    setSelectedRoomIds((current) => {
      const next = new Set(current);

      for (const row of floor.rows) {
        if (checked) {
          next.add(row.room.id);
        } else {
          next.delete(row.room.id);
        }
      }

      return next;
    });
  }

  function selectedFormData() {
    const formData = new FormData();

    formData.set("date", dateISO);
    for (const roomId of selectedRoomIds) {
      formData.append("roomId", roomId.toString());
    }

    return formData;
  }

  function assignSelected() {
    if (selectedRoomIds.size === 0) {
      toast.error("Pilih minimal satu kamar");
      return;
    }

    if (!housekeeperId) {
      toast.error("Pilih housekeeper");
      return;
    }

    const formData = selectedFormData();
    formData.set("housekeeperId", housekeeperId);
    setPendingAction("assign");

    startTransition(async () => {
      const result = await assignHousekeepingRooms(formData);

      setPendingAction(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result.count} kamar ditugaskan`);
      setSelectedRoomIds(new Set());
      router.refresh();
    });
  }

  function unassignSelected() {
    if (selectedRoomIds.size === 0) {
      toast.error("Pilih minimal satu kamar");
      return;
    }

    const formData = selectedFormData();
    setPendingAction("unassign");

    startTransition(async () => {
      const result = await unassignHousekeepingRooms(formData);

      setPendingAction(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result.count} penugasan dihapus`);
      setSelectedRoomIds(new Set());
      router.refresh();
    });
  }

  function onHousekeeperChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedHousekeeperId(event.target.value);
  }

  const controlsDisabled = isPending || housekeepers.length === 0;

  return (
    <section className="border border-console-border bg-console-surface">
      <div className="flex flex-col gap-3 border-b border-console-border bg-console-ink px-3 py-3 text-console-accent xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em]">
            Penugasan massal
          </h2>
          <p className="mt-1 text-[11px] text-slate-300">
            {selectedCount} dipilih · tugaskan atau kosongkan per kamar/tanggal
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">
              Housekeeper
            </span>
            <select
              value={housekeeperId}
              onChange={onHousekeeperChange}
              disabled={controlsDisabled}
              className="h-8 min-w-[250px] border border-console-border bg-console-surface px-2 text-[11px] font-semibold text-console-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {housekeepers.length === 0 ? (
                <option value="">Tidak ada member HK</option>
              ) : null}
              {housekeepers.map((housekeeper) => (
                <option key={housekeeper.id} value={housekeeper.id}>
                  {housekeeper.name} ({housekeeper.assignedCount})
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={assignSelected}
              disabled={controlsDisabled || selectedCount === 0}
              className={consoleButtonClassName("primary")}
            >
              <UserCheck aria-hidden="true" />
              {pendingAction === "assign"
                ? "Menugaskan..."
                : "Tugaskan terpilih"}
            </button>
            <button
              type="button"
              onClick={unassignSelected}
              disabled={isPending || selectedCount === 0}
              className={consoleButtonClassName("secondary")}
            >
              <Trash2 aria-hidden="true" />
              {pendingAction === "unassign"
                ? "Mengosongkan..."
                : "Kosongkan terpilih"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-full overflow-auto">
        <table className="w-full min-w-[1080px] border-collapse text-[12px]">
          <caption className="sr-only">
            Penugasan massal housekeeping supervisor per lantai
          </caption>
          <thead>
            <tr>
              <th className={cn(headerCellClass, "w-[80px]")} scope="col">
                Pilih
              </th>
              <th className={headerCellClass} scope="col">
                Kamar
              </th>
              <th className={headerCellClass} scope="col">
                Tipe
              </th>
              <th className={headerCellClass} scope="col">
                Status
              </th>
              <th className={headerCellClass} scope="col">
                Perlu dibersihkan
              </th>
              <th className={headerCellClass} scope="col">
                Petugas saat ini
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedFloors.map((floor) => {
              const floorSelectedCount = floor.rows.filter((row) =>
                selectedRoomIds.has(row.room.id),
              ).length;
              const allFloorSelected =
                floor.rows.length > 0 && floorSelectedCount === floor.rows.length;

              return (
                <Fragment key={floor.floor}>
                  <tr>
                    <th
                      colSpan={6}
                      scope="colgroup"
                      className="border-y border-console-border bg-[var(--slate-100)] px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-console-ink"
                    >
                      <div className="flex items-center gap-2">
                        <FloorSelectCheckbox
                          floor={floor.floor}
                          checked={allFloorSelected}
                          indeterminate={
                            floorSelectedCount > 0 && !allFloorSelected
                          }
                          disabled={isPending}
                          onChange={(checked) => toggleFloor(floor, checked)}
                        />
                        <span>Lantai {floor.floor}</span>
                        <span className="font-medium normal-case tracking-normal text-slate-500">
                          · {floor.rows.length} kamar · {floorSelectedCount}{" "}
                          dipilih
                        </span>
                      </div>
                    </th>
                  </tr>
                  {floor.rows.map((row) => (
                    <tr
                      key={row.room.id}
                      className="odd:bg-white even:bg-console-bg hover:bg-status-vc-bg"
                    >
                      <td className={bodyCellClass}>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedRoomIds.has(row.room.id)}
                            disabled={isPending}
                            onChange={(event) =>
                              toggleRoom(row.room.id, event.target.checked)
                            }
                            aria-label={`Pilih kamar ${row.room.number}`}
                            className="h-4 w-4 accent-console-ink disabled:cursor-not-allowed"
                          />
                        </label>
                      </td>
                      <td className={bodyCellClass}>
                        <div className="num text-[16px] font-bold leading-none text-console-ink">
                          {row.room.number}
                        </div>
                      </td>
                      <td className={bodyCellClass}>
                        <div className="font-semibold text-console-ink">
                          {row.room.typeCode}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {row.room.typeName}
                        </div>
                      </td>
                      <td className={bodyCellClass}>
                        <StatusCell status={row.room.status} />
                      </td>
                      <td className={bodyCellClass}>
                        <AttentionCell row={row} />
                      </td>
                      <td className={bodyCellClass}>
                        <AssigneeCell row={row} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
