"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { RoomStatus } from "@prisma/client";

import { setRoomStatusOverride } from "../actions";
import { allRoomStatuses, roomStatusLabels } from "../room-status-options";

export function SupervisorRoomStatusSelect({
  roomId,
  roomNumber,
  status,
}: {
  roomId: number;
  roomNumber: string;
  status: RoomStatus;
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus>(status);
  const [pendingStatus, setPendingStatus] = useState<RoomStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyStatus(nextStatus: RoomStatus) {
    setSelectedStatus(nextStatus);

    if (nextStatus === status) {
      setPendingStatus(null);
      return;
    }

    setPendingStatus(nextStatus);

    startTransition(async () => {
      const result = await setRoomStatusOverride(roomId, nextStatus);

      if (!result.ok) {
        setSelectedStatus(status);
        setPendingStatus(null);
        toast.error(result.error);
        return;
      }

      toast.success(`Status kamar ${roomNumber} diperbarui`);
      setPendingStatus(null);
      router.refresh();
    });
  }

  return (
    <div className="min-w-[190px]">
      <label className="sr-only" htmlFor={`room-status-override-${roomId}`}>
        Ubah status supervisor kamar {roomNumber}
      </label>
      <div className="relative">
        <select
          id={`room-status-override-${roomId}`}
          aria-label={`Ubah status supervisor kamar ${roomNumber}`}
          value={selectedStatus}
          disabled={isPending}
          onChange={(event) => applyStatus(event.target.value as RoomStatus)}
          className="h-8 w-full border border-console-border bg-console-surface px-2 pr-8 text-[11px] font-semibold text-console-ink shadow-none outline-none transition-colors hover:border-console-ink focus:border-console-ink disabled:cursor-wait disabled:bg-console-bg disabled:text-slate-500"
        >
          {allRoomStatuses.map((roomStatus) => (
            <option key={roomStatus} value={roomStatus}>
              {roomStatusLabels[roomStatus]}
            </option>
          ))}
        </select>
        {isPending ? (
          <LoaderCircle
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-console-ink"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div
        aria-live="polite"
        className="mt-1 h-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"
      >
        {isPending && pendingStatus ? "Menyimpan..." : ""}
      </div>
    </div>
  );
}
