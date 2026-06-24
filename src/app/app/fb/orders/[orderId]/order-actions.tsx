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
    <div className="grid gap-2 border-t border-gray-200 p-5">
      <Link
        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
        href="/app/fb"
      >
        Simpan & Lanjutkan Pesan
      </Link>
      {hasItems ? (
        <Link
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          href={`/app/fb/orders/${orderId}/bill`}
        >
          Lanjut ke Bill
        </Link>
      ) : (
        <button
          className="h-10 rounded-xl border border-gray-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400"
          disabled
          type="button"
        >
          Lanjut ke Bill
        </button>
      )}
      <button
        className="h-10 rounded-xl border border-status-od-fg bg-status-od-fg px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
        disabled={!canEdit || isPending}
        onClick={handleVoid}
        type="button"
      >
        Batalkan Order
      </button>
    </div>
  );
}
