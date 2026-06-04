"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { RoomStatus } from "@prisma/client";

import { updateRoomStatus } from "./actions";
import { allowedRoomStatuses, roomStatusLabels } from "./room-status-options";

export function RoomStatusControl({
  roomId,
  roomNumber,
  status,
  isOccupied,
}: {
  roomId: number;
  roomNumber: string;
  status: RoomStatus;
  isOccupied: boolean;
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus>(status);
  const [isPending, startTransition] = useTransition();
  const normalStatuses = allowedRoomStatuses(isOccupied);
  const statuses = normalStatuses.includes(status)
    ? normalStatuses
    : [status, ...normalStatuses];

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateRoomStatus(formData);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Status kamar ${roomNumber} diperbarui`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex gap-1">
      <input type="hidden" name="roomId" value={roomId} />
      <select
        aria-label={`Status kamar ${roomNumber}`}
        name="status"
        value={selectedStatus}
        disabled={isPending}
        onChange={(event) => setSelectedStatus(event.target.value as RoomStatus)}
        className="min-w-0 flex-1 border border-console-border bg-console-bg px-1.5 py-1 text-[10px] font-semibold text-console-ink"
      >
        {statuses.map((roomStatus) => (
          <option key={roomStatus} value={roomStatus}>
            {roomStatusLabels[roomStatus]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        aria-label={`Simpan status kamar ${roomNumber}`}
        disabled={isPending || selectedStatus === status}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-console-ink bg-console-ink text-console-accent hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
