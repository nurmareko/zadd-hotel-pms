"use client";

import type { RoomStatus } from "@prisma/client";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { requestRoomCleaning } from "./actions";

export function RequestCleaningButton({
  reservationId,
  roomStatus,
}: {
  reservationId: number;
  roomStatus: RoomStatus | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const alreadyRequested = roomStatus === "OD";
  const canRequest = roomStatus === "OC";

  function handleRequest() {
    startTransition(async () => {
      const result = await requestRoomCleaning(reservationId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Permintaan pembersihan kamar dikirim");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={isPending || !canRequest}
      onClick={handleRequest}
      title={
        canRequest
          ? undefined
          : "Permintaan pembersihan hanya tersedia untuk kamar berstatus OC."
      }
      className="inline-flex h-8 items-center justify-center gap-2 border border-status-od-pip bg-status-od-bg px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-status-od-fg hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      {isPending
        ? "Mengirim..."
        : alreadyRequested
          ? "Pembersihan Diminta"
          : "Minta Pembersihan Kamar"}
    </button>
  );
}
