"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { removeItemFromOrder, updateItemNotes, updateItemQuantity } from "@/app/app/fb/orders/[orderId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fbOrderGuestLabel } from "@/lib/fb-order-guest";
import { formatIDR } from "@/lib/format";

import type { PosOrderItem } from "./pos-types";

export type PosMutation = (
  action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  onSuccess?: () => void,
) => void;

export function PosCartItem({ item, disabled, mutate }: {
  item: PosOrderItem;
  disabled: boolean;
  mutate: PosMutation;
}) {
  const [notes, setNotes] = useState(item.notes);
  const dirty = notes.trim() !== item.notes;

  return (
    <li className="space-y-3 border-b border-slate-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{fbOrderGuestLabel(item.guestNumber)} · {formatIDR(item.unitPrice)}</p></div>
        <Button type="button" className="size-11 shrink-0" variant="ghost" aria-label={`Hapus ${item.name}`} disabled={disabled} onClick={() => mutate(() => removeItemFromOrder({ orderItemId: item.id }))}><Trash2 aria-hidden="true" className="size-4" /></Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md border">
          <Button type="button" className="size-11" variant="ghost" aria-label={`Kurangi ${item.name}`} disabled={disabled} onClick={() => mutate(() => updateItemQuantity({ orderItemId: item.id, quantity: item.quantity - 1 }))}><Minus aria-hidden="true" className="size-4" /></Button>
          <span className="min-w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
          <Button type="button" className="size-11" variant="ghost" aria-label={`Tambah ${item.name}`} disabled={disabled || item.quantity >= 99} onClick={() => mutate(() => updateItemQuantity({ orderItemId: item.id, quantity: item.quantity + 1 }))}><Plus aria-hidden="true" className="size-4" /></Button>
        </div>
        <strong className="text-sm tabular-nums">{formatIDR(item.amount)}</strong>
      </div>
      <form className="flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (dirty) mutate(() => updateItemNotes({ orderItemId: item.id, notes }));
      }}>
        <Input aria-label={`Catatan untuk ${item.name}`} className="h-11 min-w-0" disabled={disabled} maxLength={235} placeholder="Catatan untuk dapur" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Button type="submit" variant="outline" className="min-h-11" disabled={disabled || !dirty}>Simpan</Button>
      </form>
      {dirty && <p className="text-xs text-amber-700">Catatan belum disimpan.</p>}
    </li>
  );
}
