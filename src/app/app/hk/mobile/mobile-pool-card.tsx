"use client";

import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MobileCleaningRoom } from "@/lib/housekeeper-mobile-data";
import { claimAvailableRoom } from "./actions";
import { MobileRoomSummary, useMobileAction } from "./mobile-presentation";

export type MobilePoolCardProps = {
  room: MobileCleaningRoom;
};

export function MobilePoolCard({ room }: MobilePoolCardProps) {
  const { isPending, run } = useMobileAction();
  const claimable = !room.inProgress && room.status !== "OOO";

  return (
    <article aria-label={`Kamar tersedia ${room.number}`} aria-busy={isPending} className="relative min-w-0 max-w-full space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <MobileRoomSummary room={room} />
      {claimable ? (
        <p className="text-xs text-slate-600">Ambil kamar untuk menambahkannya ke tugas Anda.</p>
      ) : (
        <p className="text-sm text-slate-600">Kamar tidak lagi tersedia untuk diambil. Muat ulang daftar untuk melihat tugas terbaru.</p>
      )}
      <Button
        disabled={isPending || !claimable}
        onClick={() => run(() => claimAvailableRoom(room.id), `Kamar ${room.number} ditambahkan ke tugas Anda`)}
        aria-describedby={`claim-hint-${room.id}`}
                className="min-h-12 w-full min-w-0 whitespace-normal"
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Ambil Tugas
      </Button>
      <span id={`claim-hint-${room.id}`} className="sr-only">Tugaskan ke Saya</span>
    </article>
  );
}
