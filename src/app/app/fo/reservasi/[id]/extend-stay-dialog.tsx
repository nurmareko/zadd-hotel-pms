"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDateOnlyDays,
  hotelTodayISO,
  isValidISODateOnly,
  parseISODateOnly,
} from "@/lib/date-only";
import { extendReservationStay } from "./actions";

type ExtendStayDialogProps = {
  reservationId: number;
  guestName: string;
  roomNumber: string | null;
  departureDate: string;
};

function minimumDepartureDate(departureDate: string) {
  const laterDate = [hotelTodayISO(), departureDate].sort()[1];
  return addDateOnlyDays(parseISODateOnly(laterDate), 1).toISOString().slice(0, 10);
}

function departureLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseISODateOnly(value));
}

export function ExtendStayDialog({
  reservationId,
  guestName,
  roomNumber,
  departureDate,
}: ExtendStayDialogProps) {
  const router = useRouter();
  const inputId = useId();
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [newDepartureDate, setNewDepartureDate] = useState("");
  const [minDate, setMinDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const validSelection =
    isValidISODateOnly(newDepartureDate) && newDepartureDate >= minDate;
  const additionalNights = validSelection
    ? (parseISODateOnly(newDepartureDate).getTime() -
        parseISODateOnly(departureDate).getTime()) / 86_400_000
    : 0;

  function handleOpenChange(nextOpen: boolean) {
    if (submitting.current) return;
    if (nextOpen) {
      setMinDate(minimumDepartureDate(departureDate));
      setNewDepartureDate("");
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const minimum = minimumDepartureDate(departureDate);
    setMinDate(minimum);
    if (!isValidISODateOnly(newDepartureDate) || newDepartureDate < minimum) {
      setError(`Select the earliest departure date ${departureLabel(minimum)}.`);
      return;
    }

    submitting.current = true;
    setIsPending(true);
    setError(null);
    try {
      const result = await extendReservationStay({ reservationId, newDepartureDate });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(
        `Stay extended to ${departureLabel(result.data.newDepartureDate)} (${result.data.additionalNights} additional nights).`,
      );
      setOpen(false);
      router.refresh();
    } catch {
      setError("The save result could not be confirmed. Reload the page and check the departure date before trying again.");
    } finally {
      submitting.current = false;
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />} disabled={isPending}>
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
        Extend Stay
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto border border-slate-200 sm:max-w-md"
        showCloseButton={!isPending}
      >
        <DialogHeader>
          <DialogTitle>Extend Stay</DialogTitle>
          <DialogDescription className="break-words">
            {guestName} · {roomNumber ? `Room ${roomNumber}` : "Room not assigned"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={isPending}>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Current departure</p>
            <p className="mt-1 font-medium">{departureLabel(departureDate)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={inputId}>New departure date</Label>
            <Input
              id={inputId}
              type="date"
              required
              min={minDate}
              value={newDepartureDate}
              disabled={isPending}
              aria-invalid={Boolean(error)}
              aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
              onChange={(event) => {
                setNewDepartureDate(event.target.value);
                setError(null);
              }}
            />
            <p id={`${inputId}-hint`} className="text-xs text-slate-500">
              {minDate ? `Earliest ${departureLabel(minDate)} (hotel time, WIB).` : "Select a new departure date."}
            </p>
          </div>
          <p role="status" className="text-sm text-slate-600">
            {additionalNights > 0
              ? `Stay extension: ${additionalNights} nights.`
              : "Select a date to see the number of additional nights."}
          </p>
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !validSelection}>
              {isPending ? "Saving..." : "Save Extension"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
