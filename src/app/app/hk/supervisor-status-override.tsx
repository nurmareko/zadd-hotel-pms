"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import type { RoomStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

import { setRoomStatusOverride } from "./actions";
import { allRoomStatuses, roomStatusLabels } from "./room-status-options";

export function SupervisorStatusOverride({
  roomId,
  roomNumber,
  status,
  className,
}: {
  roomId: number;
  roomNumber: string;
  status: RoomStatus;
  className?: string;
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus>(status);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await setRoomStatusOverride(roomId, selectedStatus);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Override status kamar ${roomNumber} disimpan`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("mt-2 border border-console-ink bg-console-bg p-1.5", className)}
    >
      <label className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-console-ink">
        Supervisor override
      </label>
      <div className="flex gap-1">
        <select
          aria-label={`Supervisor override status kamar ${roomNumber}`}
          value={selectedStatus}
          disabled={isPending}
          onChange={(event) =>
            setSelectedStatus(event.target.value as RoomStatus)
          }
          className="min-w-0 flex-1 border border-console-border bg-console-surface px-1.5 py-1 text-[10px] font-semibold text-console-ink"
        >
          {allRoomStatuses.map((roomStatus) => (
            <option key={roomStatus} value={roomStatus}>
              {roomStatusLabels[roomStatus]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          aria-label={`Override status kamar ${roomNumber}`}
          disabled={isPending || selectedStatus === status}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-console-ink bg-console-ink text-console-accent hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
