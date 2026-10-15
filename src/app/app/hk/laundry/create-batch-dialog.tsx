"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createLinenBatch } from "@/lib/laundry/actions";
import { controlClass, ITEM_LABELS } from "./laundry-labels";

export function CreateBatchDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (next) setError(null);
    }}>
      <DialogTrigger render={<Button />}><Plus className="size-4" aria-hidden="true" />Record Laundry Batch</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Send Linen Batch</DialogTitle>
          <DialogDescription>Record one linen type per batch. New batches are marked Sent / Awaiting Wash.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" aria-busy={pending} onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const result = await createLinenBatch(data);
              if (!result.ok) {
                setError(result.error);
                toast.error(result.error);
                return;
              }
              toast.success("Linen dispatch recorded successfully.");
              setOpen(false);
              router.refresh();
            } catch {
              const message = "The dispatch could not be saved. Check the batch list before trying again.";
              setError(message);
              toast.error(message);
            }
          });
        }}>
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <legend className="sr-only">Linen dispatch details</legend>
            <label className="block text-sm font-medium">Linen type
              <select name="itemType" required defaultValue="" className={controlClass}>
                <option value="" disabled>Select a linen type</option>
                {Object.entries(ITEM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Quantity sent (units)
              <input name="sentQuantity" type="number" min={1} max={2147483647} step={1} required className={controlClass} />
            </label>
            <label className="block text-sm font-medium">Vendor
              <select name="vendor" defaultValue="Laundry Internal" required className={controlClass}>
                <option value="Laundry Internal">In-house Laundry</option>
                <option>CV Mandiri</option>
              </select>
            </label>
            <label className="block text-sm font-medium">Notes (optional)
              <textarea name="notes" rows={3} maxLength={2000} className={`${controlClass} h-auto py-3`} placeholder="Notes on linen condition or dispatch" />
            </label>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save Dispatch"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
