"use client";

import { Minus, Plus, X } from "lucide-react";
import { KeyboardEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { formatIDR } from "@/lib/format";

import {
  removeItemFromOrder,
  updateItemNotes,
  updateItemQuantity,
} from "./actions";

export type OrderCartItem = {
  id: number;
  name: string;
  category: string;
  isAvailable: boolean;
  unitPrice: string;
  quantity: number;
  amount: string;
  notes: string;
  guestNumber: number;
};

type OrderItemRowProps = {
  item: OrderCartItem;
  canEdit: boolean;
};

export function OrderItemRow({ item, canEdit }: OrderItemRowProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(item.notes);
  const [isPending, startTransition] = useTransition();

  function refreshAfter(result: { ok: true } | { ok: false; error: string }) {
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    router.refresh();
  }

  function changeQuantity(quantity: number) {
    startTransition(async () => {
      const result = await updateItemQuantity({
        orderItemId: item.id,
        quantity,
      });

      refreshAfter(result);
    });
  }

  function removeItem() {
    startTransition(async () => {
      const result = await removeItemFromOrder({ orderItemId: item.id });

      refreshAfter(result);
    });
  }

  function saveNotes() {
    if (notes === item.notes) {
      return;
    }

    startTransition(async () => {
      const result = await updateItemNotes({
        orderItemId: item.id,
        notes,
      });

      refreshAfter(result);
    });
  }

  function handleNoteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  return (
    <div className="grid gap-3 border-b border-gray-100 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">
            {item.name}
          </div>
          <div className="num mt-1 text-xs text-slate-500">
            {formatIDR(item.unitPrice)} · {item.category}
          </div>
          {!item.isAvailable ? (
            <div className="mt-1 inline-flex h-6 items-center rounded-full border border-status-vd-pip bg-status-vd-bg px-2.5 text-xs font-semibold text-status-vd-fg">
              Item tidak tersedia
            </div>
          ) : null}
        </div>
        <button
          aria-label={`Remove ${item.name}`}
          className="inline-flex size-8 items-center justify-center rounded-md border border-gray-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          disabled={!canEdit || isPending}
          onClick={removeItem}
          title={`Remove ${item.name}`}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          <button
            aria-label={`Decrease ${item.name}`}
            className="inline-flex h-full w-9 items-center justify-center text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            disabled={!canEdit || isPending}
            onClick={() => changeQuantity(item.quantity - 1)}
            title={`Decrease ${item.name}`}
            type="button"
          >
            <Minus aria-hidden="true" className="size-3.5" />
          </button>
          <span className="num w-10 border-x border-gray-200 text-center text-sm font-semibold text-slate-900">
            {item.quantity}
          </span>
          <button
            aria-label={`Increase ${item.name}`}
            className="inline-flex h-full w-9 items-center justify-center text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            disabled={!canEdit || isPending}
            onClick={() => changeQuantity(item.quantity + 1)}
            title={`Increase ${item.name}`}
            type="button"
          >
            <Plus aria-hidden="true" className="size-3.5" />
          </button>
        </div>
        <div className="num text-right text-sm font-bold text-slate-900">
          {formatIDR(item.amount)}
        </div>
      </div>

      <input
        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        disabled={!canEdit || isPending}
        maxLength={255}
        onBlur={saveNotes}
        onChange={(event) => setNotes(event.target.value)}
        onKeyDown={handleNoteKeyDown}
        placeholder="Tambah catatan"
        value={notes}
      />
    </div>
  );
}
