"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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

import { confirmBill, reopenOrder } from "./actions";

type BillActionsProps = {
  orderId: number;
  orderNo: string;
  status: "OPEN" | "BILLED" | "CLOSED" | "VOIDED";
  hasItems: boolean;
};

function downloadBillPdf(orderId: number, orderNo: string) {
  const link = document.createElement("a");
  link.href = `/api/fb-orders/${orderId}/bill`;
  link.download = `fb-bill-${orderNo}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
}

export function BillActions({
  orderId,
  orderNo,
  status,
  hasItems,
}: BillActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConfirmBill() {
    startTransition(async () => {
      const result = await confirmBill({ orderId });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Bill dikonfirmasi");
      downloadBillPdf(orderId, orderNo);
      router.refresh();
    });
  }

  function handleReprint() {
    downloadBillPdf(orderId, orderNo);
  }

  function handleReopen() {
    startTransition(async () => {
      const result = await reopenOrder({ orderId });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Order dibuka kembali");
      router.push(`/app/fb/orders/${orderId}`);
      router.refresh();
    });
  }

  return (
    <aside className="border border-console-border bg-console-surface xl:sticky xl:top-4 xl:self-start">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// AKSI BILL"}
      </div>
      <div className="grid gap-2 p-3.5">
        {status === "OPEN" ? (
          <>
            <button
              className="h-8 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:border-console-border disabled:bg-slate-100 disabled:text-slate-400"
              disabled={!hasItems || isPending}
              onClick={handleConfirmBill}
              type="button"
            >
              {isPending ? "Memproses..." : "Konfirmasi & Cetak Bill"}
            </button>
            {!hasItems ? (
              <p className="text-[11px] leading-5 text-status-od-fg">
                Order kosong, tidak bisa ditagih.
              </p>
            ) : null}
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              href={`/app/fb/orders/${orderId}`}
            >
              Kembali ke Order
            </Link>
          </>
        ) : null}

        {status === "BILLED" ? (
          <>
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
              href={`/app/fb/orders/${orderId}/payment`}
            >
              Lanjut ke Pembayaran
            </Link>
            <button
              className="h-8 border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              onClick={handleReprint}
              type="button"
            >
              Cetak Ulang Bill
            </button>
            <AlertDialog>
              <AlertDialogTrigger
                className="h-8 border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg disabled:opacity-50"
                disabled={isPending}
                type="button"
              >
                Buka Kembali Order
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-none border-console-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Buka kembali order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Status akan kembali menjadi OPEN sehingga item bisa
                    ditambahkan lagi. Bill perlu dikonfirmasi ulang sebelum
                    pembayaran.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Batal
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-none"
                    disabled={isPending}
                    onClick={handleReopen}
                    type="button"
                  >
                    {isPending ? "Memproses..." : "Buka Kembali"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}

        {status === "CLOSED" ? (
          <button
            className="h-8 border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
            onClick={handleReprint}
            type="button"
          >
            Cetak Ulang Bill
          </button>
        ) : null}

        {status === "VOIDED" ? (
          <p className="text-[11px] leading-5 text-slate-500">
            Order voided tidak memiliki aksi cetak bill.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
