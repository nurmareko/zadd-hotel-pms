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
          className="h-8 w-full appearance-none rounded-md border border-border bg-background px-2 pr-8 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-accent focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-wait disabled:opacity-50"
        >
          {allRoomStatuses.map((roomStatus) => (
            <option key={roomStatus} value={roomStatus}>
              {roomStatusLabels[roomStatus]}
            </option>
          ))}
        </select>
        {isPending ? (
          <LoaderCircle
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div
        aria-live="polite"
        className="mt-1 h-4 text-xs text-muted-foreground"
      >
        {isPending && pendingStatus ? "Menyimpan..." : ""}
      </div>
    </div>
  );
}
