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
import { cancelReservation } from "@/lib/reservations/actions";
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
      toast.success("Reservation cancelled");
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
        Cancel Reservation
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl border border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to cancel reservation {reservationNo}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The reservation will be marked as Cancelled and the reserved room will become available again. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Cancel
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
            {isPending ? "Cancelling..." : "Yes, Cancel Reservation"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
