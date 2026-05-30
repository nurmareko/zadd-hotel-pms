"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelReservation } from "../new/actions";

type CancelReservationDialogProps = {
  reservationId: number;
  reservationNo: string;
};

export function CancelReservationDialog({
  reservationId,
  reservationNo,
}: CancelReservationDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelReservation(reservationId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Reservasi dibatalkan");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        className="inline-flex h-8 items-center justify-center border border-red-500 bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-status-od-fg hover:bg-status-od-bg disabled:opacity-50"
        disabled={isPending}
        type="button"
      >
        Batalkan Reservasi
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-none border-console-border">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Yakin batalkan reservasi {reservationNo}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Status reservasi akan menjadi CANCELLED dan kamar yang dipesan akan
            kembali tersedia. Tindakan ini tidak bisa dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-none border-red-500 bg-red-600 text-white hover:bg-red-700"
            disabled={isPending}
            onClick={handleCancel}
            type="button"
          >
            {isPending ? "Membatalkan..." : "Ya, Batalkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
