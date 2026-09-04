"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { buttonVariants } from "@/components/ui/button";
import { cancelReservation } from "../new/actions";
import { safelyRunReservationAction } from "../new/reservation-errors";

type CancelReservationDialogProps = {
  reservationId: number;
  reservationNo: string;
};

export function CancelReservationDialog({
  reservationId,
  reservationNo,
}: CancelReservationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    if (isPending && !nextOpen) {
      return;
    }

    setOpen(nextOpen);
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await safelyRunReservationAction(
        () => cancelReservation(reservationId),
        "cancel",
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Reservasi dibatalkan");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        className={buttonVariants({ variant: "destructive" })}
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
          <AlertDialogCancel disabled={isPending}>
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              handleCancel();
            }}
            type="button"
          >
            {isPending ? "Membatalkan..." : "Ya, Batalkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
