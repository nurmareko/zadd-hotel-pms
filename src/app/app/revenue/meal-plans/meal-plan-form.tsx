"use client";

import type { ArrangementType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import { updateMealPlanPrices } from "./actions";

const plans = [
  { code: "BB", name: "Sarapan" },
  { code: "HB", name: "Sarapan + satu kali makan utama" },
  { code: "FB", name: "Sarapan, makan siang, dan makan malam" },
] as const;

export function MealPlanForm({ prices, canManage }: {
  prices: Record<ArrangementType, number>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canManage || pending) return;
        const data = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            const result = await updateMealPlanPrices(Object.fromEntries(data));
            if (!result.ok) { setError(result.error); return; }
            toast.success("Harga paket makan berhasil disimpan.");
            router.refresh();
          } catch {
            setError("Tidak dapat menyimpan harga. Periksa koneksi lalu coba lagi.");
          }
        });
      }}
    >
      <div className="border-b border-slate-200 p-4 md:p-5">
        <h2 className="text-base font-semibold">Harga paket aktif</h2>
        <p id="meal-price-help" className="mt-1 text-sm text-muted-foreground">
          Berlaku untuk reservasi baru dan perubahan paket pada malam mendatang yang belum diposting.
          Perubahan jumlah tamu tetap memakai harga yang tersimpan.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="flex flex-wrap justify-between gap-3 p-4 md:p-5">
          <p><span className="font-semibold">RO</span> — Tanpa makan</p>
          <p className="text-sm text-muted-foreground">{formatIDR(0)} · Tetap</p>
        </div>
        {plans.map((plan) => (
          <div key={plan.code} className="grid items-center gap-3 p-4 sm:grid-cols-2 md:p-5">
            <label htmlFor={`price-${plan.code}`} className="text-sm">
              <span className="font-semibold">{plan.code}</span> — {plan.name}
              <span className="mt-1 block text-xs text-muted-foreground">Rupiah per tamu per malam</span>
            </label>
            {canManage ? (
              <Input id={`price-${plan.code}`} name={plan.code} type="number" inputMode="numeric"
                min={0} max={9_999_999_999} step={1} required defaultValue={prices[plan.code]}
                disabled={pending} aria-describedby="meal-price-help" className="h-11 sm:ml-auto sm:max-w-xs" />
            ) : <p className="font-medium tabular-nums sm:text-right">{formatIDR(prices[plan.code])}</p>}
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-slate-200 p-4 md:p-5">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {canManage ? <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Harga"}</Button>
          : <p className="text-sm text-muted-foreground">Hanya ADMIN dan GM yang dapat mengubah harga paket makan.</p>}
      </div>
    </form>
  );
}
