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
import { consoleButtonClassName } from "@/components/console-button";
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
        className={consoleButtonClassName("secondary")}
        disabled={isPending}
        type="button"
      >
        Batalkan Reservasi
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl border border-slate-200">
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
          <AlertDialogCancel
            className={consoleButtonClassName("secondary")}
            disabled={isPending}
          >
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            className={consoleButtonClassName("danger")}
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
