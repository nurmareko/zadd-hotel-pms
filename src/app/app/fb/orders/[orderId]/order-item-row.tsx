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
    <div className="grid gap-2 border-b border-console-border-soft p-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-console-ink">
            {item.name}
          </div>
          <div className="num mt-1 text-[11px] text-slate-500">
            {formatIDR(item.unitPrice)} · {item.category}
          </div>
          {!item.isAvailable ? (
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-status-vd-fg">
              Item tidak tersedia
            </div>
          ) : null}
        </div>
        <button
          aria-label={`Remove ${item.name}`}
          className="inline-flex size-7 items-center justify-center border border-console-border bg-white text-console-ink hover:border-console-ink hover:bg-console-bg disabled:opacity-50"
          disabled={!canEdit || isPending}
          onClick={removeItem}
          title={`Remove ${item.name}`}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex h-8 items-center border border-console-border bg-white">
          <button
            aria-label={`Decrease ${item.name}`}
            className="inline-flex h-full w-8 items-center justify-center text-console-ink hover:bg-console-bg disabled:opacity-50"
            disabled={!canEdit || isPending}
            onClick={() => changeQuantity(item.quantity - 1)}
            title={`Decrease ${item.name}`}
            type="button"
          >
            <Minus aria-hidden="true" className="size-3.5" />
          </button>
          <span className="num w-9 border-x border-console-border text-center text-[12px] font-semibold">
            {item.quantity}
          </span>
          <button
            aria-label={`Increase ${item.name}`}
            className="inline-flex h-full w-8 items-center justify-center text-console-ink hover:bg-console-bg disabled:opacity-50"
            disabled={!canEdit || isPending}
            onClick={() => changeQuantity(item.quantity + 1)}
            title={`Increase ${item.name}`}
            type="button"
          >
            <Plus aria-hidden="true" className="size-3.5" />
          </button>
        </div>
        <div className="num text-right text-[13px] font-bold text-console-ink">
          {formatIDR(item.amount)}
        </div>
      </div>

      <input
        className="h-8 w-full border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none placeholder:text-slate-400 focus:border-console-ink disabled:bg-slate-100"
        disabled={!canEdit || isPending}
        maxLength={255}
        onBlur={saveNotes}
        onChange={(event) => setNotes(event.target.value)}
        onKeyDown={handleNoteKeyDown}
        placeholder="Add note"
        value={notes}
      />
    </div>
  );
}
