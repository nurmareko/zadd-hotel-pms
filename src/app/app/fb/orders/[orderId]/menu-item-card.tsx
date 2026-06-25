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
    <article className="grid min-h-[132px] gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300">
      <div>
        <div className="text-sm font-semibold leading-5 text-slate-900">
          {item.name}
        </div>
        <div className="num mt-1 text-sm font-semibold text-slate-700">
          {formatIDR(item.price)}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="inline-flex h-6 items-center rounded-full border border-gray-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-600">
          {item.category}
        </span>
        <button
          aria-label={`Add ${item.name}`}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
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
