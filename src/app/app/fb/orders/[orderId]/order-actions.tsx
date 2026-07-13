"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { voidOrder } from "./actions";

type OrderActionsProps = {
  orderId: number;
  hasItems: boolean;
  canEdit: boolean;
};

export function OrderActions({ orderId, hasItems, canEdit }: OrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  function handleVoid() {
    const reason = voidReason.trim();

    if (!reason) {
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
      <div className="grid gap-1.5">
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/app/fb"
        >
          Kembali ke Daftar Meja
        </Link>
        {canEdit ? (
          <p className="text-center text-xs font-medium text-slate-500">
            Perubahan item tersimpan otomatis
          </p>
        ) : null}
      </div>
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
      <div className="mt-3 border-t border-slate-200 pt-4">
        <AlertDialog
          open={isVoidDialogOpen}
          onOpenChange={(open) => {
            setIsVoidDialogOpen(open);

            if (!open) {
              setVoidReason("");
            }
          }}
        >
          <AlertDialogTrigger
            className={buttonVariants({
              variant: "destructive",
              className: "w-full",
            })}
            disabled={!canEdit || isPending}
            type="button"
          >
            Batalkan Order
          </AlertDialogTrigger>
          <AlertDialogContent className="border border-slate-200">
            <AlertDialogHeader>
              <AlertDialogTitle>Batalkan order ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Order akan dibatalkan setelah alasan dicatat. Tindakan ini tidak
                dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-900"
                htmlFor="void-order-reason"
              >
                Alasan pembatalan
              </label>
              <Textarea
                id="void-order-reason"
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Masukkan alasan pembatalan order"
                disabled={isPending}
                maxLength={255}
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Kembali</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={handleVoid}
                type="button"
              >
                {isPending ? "Membatalkan..." : "Batalkan Order"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
