"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";

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
        className={buttonVariants({ variant: "outline" })}
        href="/app/fb"
      >
        Simpan & Lanjutkan Pesan
      </Link>
      {hasItems ? (
        <Link
          className={buttonVariants()}
          href={`/app/fb/orders/${orderId}/bill`}
        >
          Lanjut ke Bill
        </Link>
      ) : (
        <Button disabled type="button">
          Lanjut ke Bill
        </Button>
      )}
      <Button
        disabled={!canEdit || isPending}
        onClick={handleVoid}
        type="button"
        variant="danger"
      >
        Batalkan Order
      </Button>
    </div>
  );
}
