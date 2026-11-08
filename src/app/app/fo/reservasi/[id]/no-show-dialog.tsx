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
import { markReservationNoShow } from "@/lib/reservations/actions";
import { safelyRunReservationAction } from "../new/reservation-errors";

type NoShowReservationDialogProps = {
  reservationId: number;
  reservationNo: string;
  hasDeposit: boolean;
};

export function NoShowReservationDialog({
  reservationId,
  reservationNo,
  hasDeposit,
}: NoShowReservationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    if (isPending && !nextOpen) return;
    setOpen(nextOpen);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await safelyRunReservationAction(
        () => markReservationNoShow(reservationId),
        "no-show",
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("Reservation marked as no-show");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        className={buttonVariants({ variant: "outline", className: "text-amber-700 hover:text-amber-800" })}
        disabled={isPending}
        type="button"
      >
        Mark as No-Show
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl border border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle>Mark Reservation as No-Show</AlertDialogTitle>
          <AlertDialogDescription>
            Reservation {reservationNo} will be marked as No-Show. The room
            assignment will be released and pending stay fees will be cancelled.
            {hasDeposit ? " The collected deposit remains recorded on the open folio." : null}
            {" "}This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
            type="button"
          >
            {isPending ? "Marking as No-Show..." : "Mark as No-Show"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
