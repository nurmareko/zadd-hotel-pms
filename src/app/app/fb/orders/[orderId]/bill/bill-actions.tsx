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
    <aside className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="text-base font-semibold text-slate-900">
          Aksi Bill
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Konfirmasi, cetak, atau buka kembali order.
        </div>
      </div>
      <div className="grid gap-2 p-5">
        {status === "OPEN" ? (
          <>
            <button
              className="h-10 rounded-xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:border-gray-200 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={!hasItems || isPending}
              onClick={handleConfirmBill}
              type="button"
            >
              {isPending ? "Memproses..." : "Konfirmasi & Cetak Bill"}
            </button>
            {!hasItems ? (
              <p className="rounded-xl border border-status-od-pip bg-status-od-bg px-3 py-2 text-sm font-medium leading-5 text-status-od-fg">
                Order kosong, tidak bisa ditagih.
              </p>
            ) : null}
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              href={`/app/fb/orders/${orderId}`}
            >
              Kembali ke Order
            </Link>
          </>
        ) : null}

        {status === "BILLED" ? (
          <>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
              href={`/app/fb/orders/${orderId}/payment`}
            >
              Lanjut ke Pembayaran
            </Link>
            <button
              className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              onClick={handleReprint}
              type="button"
            >
              Cetak Ulang Bill
            </button>
            <AlertDialog>
              <AlertDialogTrigger
                className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={isPending}
                type="button"
              >
                Buka Kembali Order
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[20px] border border-gray-200 bg-white shadow-xl">
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
                    className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
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
            className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
            onClick={handleReprint}
            type="button"
          >
            Cetak Ulang Bill
          </button>
        ) : null}

        {status === "VOIDED" ? (
          <p className="text-sm leading-6 text-slate-500">
            Order voided tidak memiliki aksi cetak bill.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
