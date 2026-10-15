"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getStockLedger, receiveStock, recordStockTake, recordWastage, toggle86MenuItem } from "@/lib/fb/inventory-actions";
import type { InventoryIngredient, InventoryMovement } from "@/lib/fb/inventory-types";

export type StockOperation = "RECEIVE" | "STOCK_TAKE" | "WASTAGE";
export const operationLabels: Record<StockOperation, string> = {
  RECEIVE: "Receive Stock", STOCK_TAKE: "Stocktake", WASTAGE: "Record Wastage",
};
export const quantityFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });
export function inventoryDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
  }).format(new Date(value)) : "Not yet counted";
}
const selectClass = "h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring desktop:h-10";

export function StockDialog({ operation, ingredients, initialId, onClose, onSuccess }: {
  operation: StockOperation; ingredients: InventoryIngredient[]; initialId?: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const [ingredientId, setIngredientId] = useState(initialId?.toString() ?? "");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const ingredient = ingredients.find((item) => item.id === Number(ingredientId));
  const counting = operation === "STOCK_TAKE";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || uncertain) return;
    const amount = Number(quantity);
    if (!ingredient || !quantity.trim() || !Number.isFinite(amount) || amount < 0 || (!counting && amount === 0) || amount > 9999999.999 || Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.000001) {
      setError("Select an ingredient and enter a valid quantity with up to 3 decimal places. Received or wasted quantities must be greater than 0.");
      return;
    }
    if (notes.trim().length > 255) {
      setError("Notes must not exceed 255 characters.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const input = { ingredientId: ingredient.id, quantity: amount, notes: notes.trim() || undefined };
      const result = counting
        ? await recordStockTake({ ingredientId: ingredient.id, countedQuantity: amount, notes: input.notes })
        : operation === "RECEIVE" ? await receiveStock(input) : await recordWastage(input);
      if ("error" in result) {
        setError(result.error);
        if (result.uncertain) setUncertain(true);
        return;
      }
      toast.success("Stock changes saved successfully.");
      onSuccess();
    } catch {
      setUncertain(true);
      setError("The save could not be confirmed. Close the dialog, refresh and check the stock history before recording it again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>{operationLabels[operation]}</DialogTitle>
        <DialogDescription>{counting ? "Enter the actual physical count. The system records the difference from the stock balance at the time of saving." : operation === "RECEIVE" ? "Record the ingredients received in their stock units." : "Record damaged or wasted ingredients to deduct them from stock."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        <fieldset disabled={busy || uncertain} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="stock-ingredient">Ingredients</Label>
            <select id="stock-ingredient" required value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} className={selectClass}>
              <option value="">Select an ingredient</option>
              {ingredients.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
            </select>
          </div>
          {ingredient && <p className="text-sm text-muted-foreground">Recorded stock: <span className="font-semibold tabular-nums">{quantityFormat.format(ingredient.onHand)} {ingredient.unit}</span></p>}
          <div className="space-y-2"><Label htmlFor="stock-quantity">{counting ? "Actual Physical Count" : "Quantity"}{ingredient ? ` (${ingredient.unit})` : ""}</Label>
            <Input id="stock-quantity" type="number" inputMode="decimal" required min={counting ? 0 : 0.001} max={9999999.999} step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-describedby="stock-quantity-help" />
            <p id="stock-quantity-help" className="text-xs text-muted-foreground">Up to 3 decimal places. {counting && "Enter 0 if no physical stock remains."}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock-notes">Notes (optional)</Label>
            <Textarea id="stock-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={255} rows={3} aria-describedby="stock-notes-help" />
            <p id="stock-notes-help" className="text-xs text-muted-foreground">Maximum 255 characters.</p>
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{uncertain ? "Close" : "Cancel"}</Button><Button type="submit" disabled={busy || uncertain}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function DisableMenuDialog({ menu, onClose, onSuccess }: {
  menu: NonNullable<InventoryIngredient["menuItem"]>; onClose: () => void; onSuccess: (id: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  async function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await toggle86MenuItem(menu.id);
      if ("error" in result) { setError(result.error); return; }
      toast.success("Menu item disabled (86).");
      onSuccess(menu.id);
    } catch { setError("Unable to disable the menu item. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Disable menu item (86)?</DialogTitle><DialogDescription>Menu item “{menu.name}” will be disabled so it cannot be ordered. Ingredient stock will not change. This action will not reactivate an already disabled item.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={confirm}>{busy ? "Disabling…" : "Disable (86)"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

const movementLabels: Record<InventoryMovement["type"], string> = {
  ...operationLabels, CONSUMPTION: "Usage",
};
export function LedgerDialog({ ingredient, onClose }: { ingredient: InventoryIngredient; onClose: () => void }) {
  const [result, setResult] = useState<{ movements: InventoryMovement[] } | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getStockLedger(ingredient.id).then((data) => {
      if (active) setResult(data);
    }).catch(() => {
      if (active) setResult({ error: "Unable to load stock history. Please try again." });
    });
    return () => { active = false; };
  }, [ingredient.id, attempt]);

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Stock History · {ingredient.name}</DialogTitle><DialogDescription>Up to 100 recent movements. Quantities in {ingredient.unit}; times in WIB.</DialogDescription></DialogHeader>
      {!result ? <div role="status" aria-busy="true" className="space-y-3 py-4"><p>Loading stock history…</p>{[0, 1, 2].map((key) => <div key={key} className="h-12 animate-pulse rounded-md bg-slate-100" />)}</div>
        : "error" in result ? <div className="space-y-3"><p role="alert" className="text-red-700">{result.error}</p><Button variant="outline" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Try Again</Button></div>
        : result.movements.length === 0 ? <p role="status" className="py-8 text-center text-muted-foreground">No stock movements for this ingredient yet.</p>
        : <ol className="divide-y">{result.movements.map((movement) => <li key={movement.id} className="space-y-2 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{movementLabels[movement.type]}</p><p className="text-xs text-muted-foreground">{inventoryDate(movement.createdAt)} WIB · {movement.recordedBy}</p></div><div className="text-right tabular-nums"><p className={movement.quantityDelta < 0 ? "font-semibold text-red-700" : "font-semibold text-green-800"}>{movement.quantityDelta > 0 ? "+" : ""}{quantityFormat.format(movement.quantityDelta)} {ingredient.unit}</p><p className="text-xs text-muted-foreground">Balance: {quantityFormat.format(movement.balanceAfter)} {ingredient.unit}</p></div></div>
          {movement.notes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{movement.notes}</p>}
        </li>)}</ol>}
      <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
