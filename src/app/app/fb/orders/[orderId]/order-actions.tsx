"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { voidOrder } from "./actions";

type OrderActionsProps = {
  orderId: number;
  hasItems: boolean;
  canEdit: boolean;
};

export function OrderActions({ orderId, hasItems, canEdit }: OrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleVoid() {
    const reason = window.prompt("Alasan membatalkan order?");

    if (!reason?.trim()) {
      toast.error("Alasan pembatalan wajib diisi");
      return;
    }

    startTransition(async () => {
      const result = await voidOrder({ orderId, reason });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Order dibatalkan");
      router.push("/app/fb");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2 border-t border-console-border p-3.5">
      <Link
        className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
        href="/app/fb"
      >
        Simpan & Lanjutkan Pesan
      </Link>
      {hasItems ? (
        <Link
          className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          href={`/app/fb/orders/${orderId}/bill`}
        >
          Lanjut ke Bill
        </Link>
      ) : (
        <button
          className="h-8 border border-console-border bg-slate-100 px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400"
          disabled
          type="button"
        >
          Lanjut ke Bill
        </button>
      )}
      <button
        className="h-8 border border-status-od-fg bg-status-od-fg px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-white hover:bg-red-700 disabled:opacity-50"
        disabled={!canEdit || isPending}
        onClick={handleVoid}
        type="button"
      >
        Batalkan Order
      </button>
    </div>
  );
}
