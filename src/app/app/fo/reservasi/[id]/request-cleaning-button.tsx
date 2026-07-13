"use client";

import type { RoomStatus } from "@prisma/client";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    <Button
          type="button"
      disabled={isPending || !canRequest}
      onClick={handleRequest}
      title={
        canRequest
          ? undefined
          : "Permintaan pembersihan hanya tersedia untuk kamar berstatus OC."
      }
      variant="outline"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      {isPending
        ? "Mengirim..."
        : alreadyRequested
          ? "Pembersihan Diminta"
          : "Minta Pembersihan Kamar"}
    </Button>
  );
}
