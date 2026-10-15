"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HandHeart, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createLostFoundItem, claimLostFoundItem, disposeLostFoundItem } from "@/lib/lost-found/actions";
import { LOST_FOUND_CATEGORY_LABELS } from "@/lib/lost-found/labels";
import type { LostFoundActionResult } from "@/lib/lost-found/schema";
import { DISPOSAL_REASON_LABELS } from "./disposal-reason-labels";

const fieldClass = "mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium">{label}{children}</label>;
}

function ActionDialog({ title, description, trigger, submitLabel, action, children, destructive = false }: {
  title: string; description: string; trigger: ReactNode; submitLabel: string;
  action: (data: FormData) => Promise<LostFoundActionResult>;
  children: ReactNode; destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return <Dialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(null); } }}>
    <DialogTrigger render={<Button variant={destructive ? "outline" : "default"} className="min-h-11" />}>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        setPending(true); setError(null);
        try {
          const result = await action(data);
          if (!result.ok) { setError(result.error); return; }
          setOpen(false); router.refresh();
        } catch {
          setError("The request could not be confirmed. Refresh the list before trying again.");
        } finally { setPending(false); }
      }}>
        <fieldset disabled={pending} className="space-y-4">{children}</fieldset>
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

export function CreateLostFoundDialog({ rooms }: { rooms: { id: number; number: string }[] }) {
  const [locationType, setLocationType] = useState("PUBLIC");
  const locationId = useId();
  return <ActionDialog title="Record Found Item" description="Record the item description and where it was found. A reference number is generated when saved." trigger={<><Plus aria-hidden="true" />Record Found Item</>} submitLabel="Save Item" action={createLostFoundItem}>
    <Field label="Category"><select name="category" className={fieldClass} defaultValue="OTHER">{Object.entries(LOST_FOUND_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Item description"><textarea name="description" required minLength={3} maxLength={500} rows={3} className={fieldClass} placeholder="Features, colour, brand and condition" /></Field>
    <div><label htmlFor={locationId} className="text-sm font-medium">Location type</label><select id={locationId} className={fieldClass} value={locationType} onChange={(event) => setLocationType(event.target.value)}><option value="PUBLIC">Public Area</option><option value="ROOM">Room</option></select></div>
    {locationType === "ROOM" ? <Field label="Room"><select name="roomId" className={fieldClass} required defaultValue=""><option value="" disabled>Select a room</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.number}</option>)}</select></Field> : <input type="hidden" name="roomId" value="" />}
    <Field label={locationType === "PUBLIC" ? "Location found" : "Location details (optional)"}><input name="locationDetails" required={locationType === "PUBLIC"} maxLength={500} className={fieldClass} placeholder={locationType === "PUBLIC" ? "Example: lobby, near the reception desk" : "Example: bedside table drawer"} /></Field>
  </ActionDialog>;
}

type ItemIdentity = { id: number; referenceCode: string; description: string };

export function ClaimLostFoundDialog({ item }: { item: ItemIdentity }) {
  return <ActionDialog title="Return to Guest" description={`${item.referenceCode} · ${item.description}. Confirm the claimant's identity and ownership before returning the item.`} trigger={<><HandHeart aria-hidden="true" />Return to Guest</>} submitLabel="Confirm Return" action={claimLostFoundItem}>
    <input type="hidden" name="itemId" value={item.id} />
    <Field label="Claimant name"><input name="claimantName" required maxLength={200} autoComplete="off" className={fieldClass} /></Field>
    <Field label="Phone number (optional)"><input name="claimantPhone" type="tel" maxLength={50} autoComplete="off" className={fieldClass} /></Field>
    <Field label="ID number (optional)"><input name="claimantIdNumber" maxLength={100} autoComplete="off" className={fieldClass} /></Field>
    <Field label="Return notes (optional)"><textarea name="resolution" maxLength={500} rows={3} className={fieldClass} /></Field>
    <p className="text-xs text-muted-foreground">Claimant details are used only as proof of return. A recorded return cannot be undone.</p>
  </ActionDialog>;
}

export function DisposeLostFoundDialog({ item, daysElapsed }: { item: ItemIdentity; daysElapsed: number }) {
  return <ActionDialog title="Dispose of / Donate Item" description={`${item.referenceCode} · ${item.description}. This item has been stored for ${daysElapsed} days.`} trigger={<><Trash2 aria-hidden="true" />Dispose / Donate</>} submitLabel="Confirm Disposal / Donation" action={disposeLostFoundItem} destructive>
    <input type="hidden" name="itemId" value={item.id} />
    <Field label="Disposal / donation reason"><select name="disposalReason" required className={fieldClass} defaultValue=""><option value="" disabled>Select a reason</option>{Object.entries(DISPOSAL_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Notes (optional)"><textarea name="notes" maxLength={500} rows={3} className={fieldClass} /></Field>
    <p className="rounded-md bg-muted p-3 text-sm">Ensure this action is approved under hotel policy. This record cannot be undone.</p>
  </ActionDialog>;
}
