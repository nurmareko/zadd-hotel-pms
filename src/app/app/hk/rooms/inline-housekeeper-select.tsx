"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setRoomHousekeeper } from "./actions";

export type HousekeeperOption = { id: number; name: string };
export type InlineHousekeeperSelectProps = {
  roomId: number;
  roomNumber: string;
  dateIso: string;
  assignedId: number | null;
  assignedName?: string;
  housekeepers: HousekeeperOption[];
};

export function InlineHousekeeperSelect({ roomId, roomNumber, dateIso, assignedId, assignedName, housekeepers }: InlineHousekeeperSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="min-w-44" aria-busy={pending}>
      <select
        aria-label={`Petugas kamar ${roomNumber}`}
        value={assignedId ?? ""}
        disabled={pending}
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-ring disabled:opacity-50 desktop:h-10"
        onChange={(event) => {
          const id = event.target.value ? Number(event.target.value) : null;
          startTransition(async () => {
            const toastId = toast.loading(`Menyimpan petugas kamar ${roomNumber}...`);
            try {
              const result = await setRoomHousekeeper(roomId, dateIso, id);
              if (!result.ok) {
                toast.error(result.error, { id: toastId });
                return;
              }
              toast.success(`Petugas kamar ${roomNumber} diperbarui`, { id: toastId });
              router.refresh();
            } catch {
              toast.error("Penugasan gagal disimpan. Silakan coba lagi.", { id: toastId });
            }
          });
        }}
      >
        <option value="">-- Belum Ditugaskan --</option>
        {assignedId !== null && !housekeepers.some((person) => person.id === assignedId) && (
          <option value={assignedId} disabled>{assignedName ?? "Petugas tidak aktif"}</option>
        )}
        {housekeepers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      <span role="status" className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {pending && <><Loader2 className="size-3 animate-spin" aria-hidden="true" />Menyimpan...</>}
      </span>
    </div>
  );
}
