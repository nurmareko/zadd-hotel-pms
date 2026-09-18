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
      <DialogTrigger render={<Button />}><Plus className="size-4" aria-hidden="true" />Catat Batch Cucian</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Kirim Batch Linen</DialogTitle>
          <DialogDescription>Catat satu tipe linen per batch. Batch baru berstatus Dikirim / Menunggu Cuci.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" aria-busy={pending} onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const result = await createLinenBatch(data);
              if ("error" in result) {
                setError(result.error);
                toast.error(result.error);
                return;
              }
              toast.success("Pengiriman batch linen berhasil dicatat.");
              setOpen(false);
              router.refresh();
            } catch {
              const message = "Pengiriman belum dapat disimpan. Periksa daftar batch sebelum mencoba lagi.";
              setError(message);
              toast.error(message);
            }
          });
        }}>
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <legend className="sr-only">Detail pengiriman linen</legend>
            <label className="block text-sm font-medium">Tipe linen
              <select name="itemType" required defaultValue="" className={controlClass}>
                <option value="" disabled>Pilih tipe linen</option>
                {Object.entries(ITEM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Jumlah dikirim (unit)
              <input name="sentQuantity" type="number" min={1} max={2147483647} step={1} required className={controlClass} />
            </label>
            <label className="block text-sm font-medium">Vendor
              <select name="vendor" defaultValue="Laundry Internal" required className={controlClass}>
                <option>Laundry Internal</option>
                <option>CV Mandiri</option>
              </select>
            </label>
            <label className="block text-sm font-medium">Catatan (opsional)
              <textarea name="notes" rows={3} maxLength={2000} className={`${controlClass} h-auto py-3`} placeholder="Catatan kondisi linen atau pengiriman" />
            </label>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Pengiriman"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
