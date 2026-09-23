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
        <PackageCheck className="size-4" aria-hidden="true" />Terima Linen<span className="sr-only"> {batch.batchCode}</span>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Terima Batch {batch.batchCode}</DialogTitle>
          <DialogDescription>{ITEM_LABELS[batch.itemType]} · {batch.sentQuantity.toLocaleString("id-ID")} unit dikirim. Pisahkan linen bersih siap pakai dari linen rusak.</DialogDescription>
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
              toast.success("Penerimaan linen berhasil dicatat.");
              setOpen(false);
              router.refresh();
            } catch {
              const message = "Penerimaan belum dapat disimpan. Periksa status batch sebelum mencoba lagi.";
              setError(message);
              toast.error(message);
            }
          });
        }}>
          <input type="hidden" name="batchId" value={batch.id} />
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <legend className="sr-only">Hasil penerimaan linen</legend>
            <label className="block text-sm font-medium">Jumlah bersih diterima (unit)
              <input name="receivedQuantity" type="number" min={0} max={batch.sentQuantity} step={1} required value={received} onChange={(event) => setReceived(event.target.value)} aria-invalid={overReceipt} aria-describedby={`${id}-reconciliation`} className={controlClass} />
            </label>
            <label className="block text-sm font-medium">Jumlah afkir / rusak (unit)
              <input name="damagedQuantity" type="number" min={0} max={batch.sentQuantity} step={1} required value={damaged} onChange={(event) => setDamaged(event.target.value)} aria-invalid={overReceipt} aria-describedby={`${id}-reconciliation`} className={controlClass} />
            </label>
            <label className="block text-sm font-medium">Catatan penerimaan (opsional)
              <textarea name="notes" rows={3} maxLength={2000} className={`${controlClass} h-auto py-3`} placeholder="Catatan kerusakan atau selisih penerimaan" />
            </label>
          </fieldset>
          <div id={`${id}-reconciliation`} aria-live="polite" className={`rounded-md p-3 text-sm ${overReceipt ? "bg-rose-50 text-rose-800" : lost > 0 ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground"}`}>
            {!validCounts ? "Masukkan jumlah unit berupa bilangan bulat nol atau lebih." : overReceipt ? "Jumlah bersih dan rusak tidak boleh melebihi jumlah yang dikirim." : lost > 0 ? `Selisih ${lost.toLocaleString("id-ID")} unit akan dicatat sebagai kehilangan. Pastikan hasil penerimaan sudah benar.` : "Seluruh linen telah terhitung. Tidak ada kehilangan."}
          </div>
          <p className="text-xs text-muted-foreground">Penerimaan menyelesaikan batch menjadi Bersih / Masuk Gudang dan tidak dapat diubah melalui layar ini.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={pending || !validCounts || overReceipt}>{pending ? "Menyimpan..." : "Simpan Penerimaan"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
