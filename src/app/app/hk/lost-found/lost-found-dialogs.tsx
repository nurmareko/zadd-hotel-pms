"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HandHeart, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createLostFoundItem, claimLostFoundItem, disposeLostFoundItem } from "@/lib/lost-found/actions";
import { LOST_FOUND_CATEGORY_LABELS } from "@/lib/lost-found/labels";
import type { LostFoundActionResult } from "@/lib/lost-found/schema";

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
          setError("Permintaan belum dapat dikonfirmasi. Muat ulang daftar sebelum mencoba kembali.");
        } finally { setPending(false); }
      }}>
        <fieldset disabled={pending} className="space-y-4">{children}</fieldset>
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
          <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>{pending ? "Menyimpan…" : submitLabel}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

export function CreateLostFoundDialog({ rooms }: { rooms: { id: number; number: string }[] }) {
  const [locationType, setLocationType] = useState("PUBLIC");
  const locationId = useId();
  return <ActionDialog title="Catat Barang Temuan" description="Catat ciri barang dan lokasi penemuan. Nomor referensi dibuat otomatis setelah disimpan." trigger={<><Plus aria-hidden="true" />Catat Barang Temuan</>} submitLabel="Simpan Barang" action={createLostFoundItem}>
    <Field label="Kategori"><select name="category" className={fieldClass} defaultValue="OTHER">{Object.entries(LOST_FOUND_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Deskripsi barang"><textarea name="description" required minLength={3} maxLength={500} rows={3} className={fieldClass} placeholder="Ciri, warna, merek, dan kondisi barang" /></Field>
    <div><label htmlFor={locationId} className="text-sm font-medium">Jenis lokasi</label><select id={locationId} className={fieldClass} value={locationType} onChange={(event) => setLocationType(event.target.value)}><option value="PUBLIC">Area Publik</option><option value="ROOM">Kamar</option></select></div>
    {locationType === "ROOM" ? <Field label="Kamar"><select name="roomId" className={fieldClass} required defaultValue=""><option value="" disabled>Pilih kamar</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.number}</option>)}</select></Field> : <input type="hidden" name="roomId" value="" />}
    <Field label={locationType === "PUBLIC" ? "Lokasi penemuan" : "Detail lokasi (opsional)"}><input name="locationDetails" required={locationType === "PUBLIC"} maxLength={500} className={fieldClass} placeholder={locationType === "PUBLIC" ? "Contoh: lobi, dekat meja resepsionis" : "Contoh: laci meja di samping tempat tidur"} /></Field>
  </ActionDialog>;
}

type ItemIdentity = { id: number; referenceCode: string; description: string };

export function ClaimLostFoundDialog({ item }: { item: ItemIdentity }) {
  return <ActionDialog title="Serahkan ke Tamu" description={`${item.referenceCode} · ${item.description}. Pastikan identitas dan kepemilikan barang telah diperiksa.`} trigger={<><HandHeart aria-hidden="true" />Serahkan ke Tamu</>} submitLabel="Konfirmasi Penyerahan" action={claimLostFoundItem}>
    <input type="hidden" name="itemId" value={item.id} />
    <Field label="Nama pengambil"><input name="claimantName" required maxLength={200} autoComplete="off" className={fieldClass} /></Field>
    <Field label="Nomor telepon (opsional)"><input name="claimantPhone" type="tel" maxLength={50} autoComplete="off" className={fieldClass} /></Field>
    <Field label="Nomor identitas (opsional)"><input name="claimantIdNumber" maxLength={100} autoComplete="off" className={fieldClass} /></Field>
    <Field label="Catatan penyerahan (opsional)"><textarea name="resolution" maxLength={500} rows={3} className={fieldClass} /></Field>
    <p className="text-xs text-muted-foreground">Data pengambil hanya digunakan untuk bukti penyerahan. Penyerahan yang telah dicatat tidak dapat dibatalkan.</p>
  </ActionDialog>;
}

export function DisposeLostFoundDialog({ item, daysElapsed }: { item: ItemIdentity; daysElapsed: number }) {
  return <ActionDialog title="Musnahkan / Hibahkan Barang" description={`${item.referenceCode} · ${item.description}. Barang telah disimpan selama ${daysElapsed} hari.`} trigger={<><Trash2 aria-hidden="true" />Musnahkan/Hibah</>} submitLabel="Konfirmasi Pemusnahan / Hibah" action={disposeLostFoundItem} destructive>
    <input type="hidden" name="itemId" value={item.id} />
    <Field label="Alasan pemusnahan / hibah"><select name="disposalReason" required className={fieldClass} defaultValue=""><option value="" disabled>Pilih alasan</option><option>Masa simpan berakhir</option><option>Dihibahkan ke yayasan</option><option>Dimusnahkan karena rusak/kedaluwarsa</option></select></Field>
    <Field label="Catatan (opsional)"><textarea name="notes" maxLength={500} rows={3} className={fieldClass} /></Field>
    <p className="rounded-md bg-muted p-3 text-sm">Pastikan tindakan telah disetujui sesuai kebijakan hotel. Pencatatan ini tidak dapat dibatalkan.</p>
  </ActionDialog>;
}
