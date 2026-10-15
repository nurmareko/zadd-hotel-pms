"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { receiveLinenBatch } from "@/lib/laundry/actions";
import type { LinenBatchRow } from "@/lib/laundry/data";
import { controlClass, ITEM_LABELS } from "./laundry-labels";

type ReceiptBatch = Pick<LinenBatchRow, "id" | "batchCode" | "itemType" | "sentQuantity">;

export function ReceiveBatchDialog({ batch }: { batch: ReceiptBatch }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [received, setReceived] = useState(String(batch.sentQuantity));
  const [damaged, setDamaged] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const id = useId();
  const receivedCount = Number(received);
  const damagedCount = Number(damaged);
  const validCounts = received !== "" && damaged !== "" && Number.isSafeInteger(receivedCount) && Number.isSafeInteger(damagedCount) && receivedCount >= 0 && damagedCount >= 0;
  const total = receivedCount + damagedCount;
  const overReceipt = validCounts && total > batch.sentQuantity;
  const lost = validCounts ? batch.sentQuantity - total : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (next) {
        setReceived(String(batch.sentQuantity));
        setDamaged("0");
        setError(null);
      }
    }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <PackageCheck className="size-4" aria-hidden="true" />Receive Linen<span className="sr-only"> {batch.batchCode}</span>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Receive Batch {batch.batchCode}</DialogTitle>
          <DialogDescription>{ITEM_LABELS[batch.itemType]} · {batch.sentQuantity.toLocaleString("id-ID")} units sent. Separate clean, ready-to-use linen from damaged linen.</DialogDescription>
        </DialogHeader>
        <form aria-busy={pending} className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (pending || !validCounts || overReceipt) return;
          const data = new FormData(event.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const result = await receiveLinenBatch(data);
              if (!result.ok) {
                setError(result.error);
                toast.error(result.error);
                return;
              }
              toast.success("Linen receipt recorded successfully.");
              setOpen(false);
              router.refresh();
            } catch {
              const message = "The receipt could not be saved. Check the batch status before trying again.";
              setError(message);
              toast.error(message);
            }
          });
        }}>
          <input type="hidden" name="batchId" value={batch.id} />
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <legend className="sr-only">Linen receipt results</legend>
            <label className="block text-sm font-medium">Clean quantity received (units)
              <input name="receivedQuantity" type="number" min={0} max={batch.sentQuantity} step={1} required value={received} onChange={(event) => setReceived(event.target.value)} aria-invalid={overReceipt} aria-describedby={`${id}-reconciliation`} className={controlClass} />
            </label>
            <label className="block text-sm font-medium">Discarded / damaged quantity (units)
              <input name="damagedQuantity" type="number" min={0} max={batch.sentQuantity} step={1} required value={damaged} onChange={(event) => setDamaged(event.target.value)} aria-invalid={overReceipt} aria-describedby={`${id}-reconciliation`} className={controlClass} />
            </label>
            <label className="block text-sm font-medium">Receipt notes (optional)
              <textarea name="notes" rows={3} maxLength={2000} className={`${controlClass} h-auto py-3`} placeholder="Notes on damage or receipt discrepancies" />
            </label>
          </fieldset>
          <div id={`${id}-reconciliation`} aria-live="polite" className={`rounded-md p-3 text-sm ${overReceipt ? "bg-rose-50 text-rose-800" : lost > 0 ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground"}`}>
            {!validCounts ? "Enter a whole number of units, zero or more." : overReceipt ? "The clean and damaged quantities must not exceed the quantity sent." : lost > 0 ? `A difference of ${lost.toLocaleString("id-ID")} units will be recorded as missing. Check that the receipt quantities are correct.` : "All linen is accounted for. No items are missing."}
          </div>
          <p className="text-xs text-muted-foreground">Receiving completes the batch as Clean / In Stock and cannot be changed on this screen.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !validCounts || overReceipt}>{pending ? "Saving..." : "Save Receipt"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
