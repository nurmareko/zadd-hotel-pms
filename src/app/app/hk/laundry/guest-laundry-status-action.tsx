"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updateGuestLaundryStatus } from "@/lib/laundry/guest-actions";
import type { GuestLaundryStatus } from "@/lib/laundry/guest-schema";
import { controlClass } from "./laundry-labels";

const nextActions = {
  RECEIVED: { status: "WASHING", label: "Start Washing", success: "Laundry marked as washing." },
  WASHING: { status: "READY_FOR_RETURN", label: "Mark Ready", success: "Laundry marked as ready for return." },
  READY_FOR_RETURN: { status: "DELIVERED", label: "Deliver to Room", success: "Laundry delivery recorded." },
} satisfies Record<Exclude<GuestLaundryStatus, "DELIVERED">, { status: GuestLaundryStatus; label: string; success: string }>;

type Props = { orderLogId: number; status: GuestLaundryStatus; roomNumber: string | null; guestName: string | null };

export function GuestLaundryStatusAction({ orderLogId, status, roomNumber, guestName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  if (status === "DELIVERED") return null;
  const action = nextActions[status];

  function submit() {
    if (submitting.current || pending) return;
    setError(null);
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await updateGuestLaundryStatus({
          orderLogId, status: action.status,
          ...(action.status === "DELIVERED" ? { deliveryNotes: notes.trim() || undefined } : {}),
        });
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        toast.success(action.success);
        setOpen(false);
        router.refresh();
      } catch {
        const message = "The status update could not be confirmed. Refresh the orders before trying again.";
        setError(message);
        toast.error(message);
      } finally {
        submitting.current = false;
      }
    });
  }

  const buttonContent = <>{pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Updating..." : action.label}</>;
  if (status !== "READY_FOR_RETURN") return (
    <div className="space-y-2" aria-busy={pending}>
      <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={submit}>{buttonContent}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (submitting.current || pending) return;
      if (next) { setNotes(""); setError(null); }
      setOpen(next);
    }}>
      <DialogTrigger render={<Button type="button" variant="outline" className="min-h-11" disabled={pending} />}>{buttonContent}</DialogTrigger>
      <DialogContent showCloseButton={!pending} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deliver to Room</DialogTitle>
          <DialogDescription>Confirm that laundry order #{orderLogId} has been returned to {roomNumber ? `Room ${roomNumber}` : "the guest"}. This records the delivery attendant and time.</DialogDescription>
        </DialogHeader>
        <p className="break-words text-sm font-medium">{guestName || "Guest name unavailable"}</p>
        <form className="space-y-4" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <label className="block text-sm font-medium">Delivery notes (optional)
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={pending} rows={3} maxLength={500} className={`${controlClass} h-auto py-3`} placeholder="Handover details or recipient (max. 500 characters)" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Recording..." : "Confirm Delivery"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
