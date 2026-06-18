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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  "bg-background border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const bodyCellClass =
  "border-b border-border/60 px-4 py-3 align-top";

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
      className="h-4 w-4 accent-blue-600 disabled:cursor-not-allowed"
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
      <Badge variant="secondary" className="rounded-full text-xs font-normal text-muted-foreground">
        Tidak ada kebutuhan
      </Badge>
    );
  }

  const reasonColorMap: Record<HousekeepingForecastReason, string> = {
    turnover: "bg-amber-50 border-amber-200 text-amber-700",
    "freshen-up": "bg-blue-50 border-blue-200 text-blue-700",
    "arrival-prep": "bg-violet-50 border-violet-200 text-violet-700",
    "dirty-now": "bg-orange-50 border-orange-200 text-orange-700",
  };

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1.5">
      {row.reasons.map((reason) => (
        <span
          key={reason}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${reasonColorMap[reason]}`}
        >
          {reasonLabels[reason]}
        </span>
      ))}
    </div>
  );
}

function AssigneeCell({ row }: { row: HousekeepingForecastRoomRow }) {
  if (!row.assignment) {
    return (
      <span className="text-xs italic text-muted-foreground">
        Belum ditugaskan
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
        {row.assignment.housekeeperInitials}
      </span>
      <span className="text-sm font-medium text-foreground">
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
    <Card className="rounded-2xl overflow-hidden p-0">
      <CardHeader className="border-b border-border rounded-none px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Penugasan Massal</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCount} dipilih · tugaskan atau kosongkan per kamar/tanggal
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Housekeeper
              </span>
              <select
                value={housekeeperId}
                onChange={onHousekeeperChange}
                disabled={controlsDisabled}
                className="h-9 min-w-[250px] rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
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
              <Button
                type="button"
                size="lg"
                onClick={assignSelected}
                disabled={controlsDisabled || selectedCount === 0}
                className="rounded-lg px-4"
              >
                <UserCheck className="h-4 w-4 mr-1.5" aria-hidden="true" />
                {pendingAction === "assign"
                  ? "Menugaskan..."
                  : "Tugaskan terpilih"}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={unassignSelected}
                disabled={isPending || selectedCount === 0}
                className="rounded-lg px-4"
              >
                <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                {pendingAction === "unassign"
                  ? "Mengosongkan..."
                  : "Kosongkan terpilih"}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
                      className="border-y border-border bg-muted/60 px-4 py-2 text-left text-xs font-semibold text-foreground"
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
                      className="odd:bg-white even:bg-slate-50 hover:bg-status-vc-bg"
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
                            className="h-4 w-4 accent-blue-600 disabled:cursor-not-allowed"
                          />
                        </label>
                      </td>
                      <td className={bodyCellClass}>
                        <div className="text-base font-bold leading-none text-foreground">
                          {row.room.number}
                        </div>
                      </td>
                      <td className={bodyCellClass}>
                        <div className="text-sm font-semibold text-foreground">
                          {row.room.typeCode}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
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
        </CardContent>
    </Card>
  );
}
