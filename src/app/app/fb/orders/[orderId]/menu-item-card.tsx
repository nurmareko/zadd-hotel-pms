"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { formatIDR } from "@/lib/format";

import { addItemToOrder } from "./actions";
import type { MenuBrowseItem } from "./menu-browse";

type MenuItemCardProps = {
  item: MenuBrowseItem;
  orderId: number;
  guestNumber: number;
  disabled?: boolean;
};

export function MenuItemCard({
  item,
  orderId,
  guestNumber,
  disabled,
}: MenuItemCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await addItemToOrder({
        orderId,
        menuItemId: item.id,
        guestNumber,
        quantity: 1,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <article className="grid min-h-[126px] gap-3 border border-console-border bg-white p-3">
      <div>
        <div className="text-[13px] font-semibold leading-5 text-console-ink">
          {item.name}
        </div>
        <div className="num mt-1 text-[12px] text-slate-600">
          {formatIDR(item.price)}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="inline-flex h-5 items-center border border-console-border bg-console-bg px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600">
          {item.category}
        </span>
        <button
          aria-label={`Add ${item.name}`}
          className="inline-flex h-8 items-center gap-1.5 border border-console-ink bg-console-ink px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:opacity-50"
          disabled={disabled || isPending}
          onClick={handleAdd}
          title={`Add ${item.name}`}
          type="button"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Tamu {guestNumber}
        </button>
      </div>
    </article>
  );
}
