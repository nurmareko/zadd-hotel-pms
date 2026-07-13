"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import type { RoomStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
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

      toast.success(`Perubahan status kamar ${roomNumber} disimpan`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("mt-2 border border-blue-600 bg-slate-50 p-1.5", className)}
    >
      <label className="mb-1 block text-[9px] font-bold font-medium tracking-tight text-slate-900">
        Ubah status supervisor
      </label>
      <div className="flex gap-1">
        <select
          aria-label={`Ubah status supervisor kamar ${roomNumber}`}
          value={selectedStatus}
          disabled={isPending}
          onChange={(event) =>
            setSelectedStatus(event.target.value as RoomStatus)
          }
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white shadow-sm px-1.5 text-[10px] font-semibold text-slate-900 desktop:h-10"
        >
          {allRoomStatuses.map((roomStatus) => (
            <option key={roomStatus} value={roomStatus}>
              {roomStatusLabels[roomStatus]}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size="icon"
          aria-label={`Simpan perubahan status kamar ${roomNumber}`}
          disabled={isPending || selectedStatus === status}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
