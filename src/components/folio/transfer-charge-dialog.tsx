"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { safelyRunAction } from "@/lib/action-errors";
import { transferFolioLineItem } from "@/lib/folio/actions";
import { folioFailure } from "@/lib/folio/errors";

export type TransferFolioOption = { id: number; label: string };

export function TransferChargeDialog({
  folioId,
  lineItemId,
  description,
  destinations,
}: {
  folioId: number;
  lineItemId: number;
  description: string;
  destinations: TransferFolioOption[];
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [targetFolioId, setTargetFolioId] = useState("");
  const [reason, setReason] = useState("");
  const [uiState, setUiState] = useState<{ isUncertain: boolean; actionError: string | null }>({ isUncertain: false, actionError: null });

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      if (!uiState.isUncertain) {
        setUiState({ isUncertain: false, actionError: null });
        setTargetFolioId("");
        setReason("");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" aria-label={`Transfer charge: ${description}`} />}>Transfer</DialogTrigger>
      <DialogContent showCloseButton={!isPending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer charge</DialogTitle>
          <DialogDescription>Select an open folio and record why this charge is being transferred. Payments are not transferred.</DialogDescription>
        </DialogHeader>
        <p className="break-words text-sm font-medium">{description}</p>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (isPending || uiState.isUncertain || !targetFolioId || !reason.trim()) return;
          const data = new FormData();
          data.set("sourceFolioId", String(folioId));
          data.set("lineItemId", String(lineItemId));
          data.set("targetFolioId", targetFolioId);
          data.set("reason", reason.trim());
          startTransition(async () => {
            const result = await safelyRunAction(() => transferFolioLineItem(data), () => folioFailure("RESULT_UNKNOWN"));
            setUiState(result.ok
              ? { isUncertain: false, actionError: null }
              : { isUncertain: result.code === "RESULT_UNKNOWN", actionError: result.error });
            if (!result.ok) return;
            toast.success("Charge transferred");
            setOpen(false);
            setTargetFolioId("");
            setReason("");
            router.refresh();
          });
        }}>
          <fieldset disabled={isPending || uiState.isUncertain} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={`${id}-destination`} className="block text-sm font-medium">Destination folio</label>
              <select id={`${id}-destination`} required value={targetFolioId} onChange={(event) => setTargetFolioId(event.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600">
                <option value="">Select an open folio</option>
                {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.label}</option>)}
              </select>
              {destinations.length === 0 ? <p className="text-sm text-slate-500">No other open folios are available.</p> : null}
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-reason`} className="block text-sm font-medium">Reason (required)</label>
              <textarea id={`${id}-reason`} required maxLength={255} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600" />
            </div>
          </fieldset>
          {uiState.actionError ? <p role="alert" className="text-sm text-red-700">{uiState.actionError}</p> : null}
          {uiState.isUncertain ? <p className="text-sm text-slate-600">Reload the page and check both folios before attempting another transfer.</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || uiState.isUncertain || !targetFolioId || !reason.trim()}>{isPending ? "Transferring…" : "Transfer charge"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
