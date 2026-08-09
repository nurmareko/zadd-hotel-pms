"use client";

import { PaymentMethod } from "@prisma/client";
import { AlertTriangle, Check, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { PinnedActionFooter } from "@/components/pinned-action-footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { folioBalanceState, refundDueNote } from "@/lib/folio-balance-display";
import { paymentMethods } from "@/lib/folio/schema";
import { completeCheckout, recordFinalPayment } from "./actions";

type FinalPaymentFormProps = {
  folioId: number;
  reservationId: number;
  balance: number;
};

type CompleteCheckoutFormProps = {
  folioId: number;
  reservationId: number;
  balance: number;
};

const fieldClassName =
  "h-11 desktop:h-10 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500";

function defaultAmount(balance: number) {
  return String(balance);
}

function resultErrorMessage(error: unknown, fallback: string) {
  return typeof error === "string" ? error : fallback;
}

function CheckoutPinnedActionFooter({ children }: { children: ReactNode }) {
  const container = useSyncExternalStore(
    () => () => {},
    () => document.getElementById("checkout-pinned-action-footer"),
    () => null,
  );

  return container ? createPortal(children, container) : null;
}

export function FinalPaymentForm({
  folioId,
  reservationId,
  balance,
}: FinalPaymentFormProps) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("folioId", String(folioId));
    formData.set("method", method);

    startTransition(async () => {
      const result = await recordFinalPayment(formData);

      if (!result.ok) {
        const message = resultErrorMessage(
          result.error,
          "Unable to record final payment",
        );
        setActionError(message);
        toast.error(message);
        return;
      }

      toast.success("Pembayaran final tercatat");
      router.refresh();
    });
  }

  return (
    <>
      <form id="final-payment-form" onSubmit={onSubmit} className="p-5">
      <input type="hidden" name="folioId" value={folioId} />
      <input type="hidden" name="method" value={method} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">
            Jumlah
          </span>
          <Input
            name="amount"
            type="number"
            min={1}
            step={1}
            defaultValue={defaultAmount(balance)}
            className={`mt-1 ${fieldClassName}`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-500">
            Metode
          </span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {paymentMethods.map((paymentMethod) => (
              <Button
                              key={paymentMethod}
                              type="button"
                              variant={method === paymentMethod ? "default" : "outline"}
                              onClick={() => setMethod(paymentMethod)}
                              className="text-xs font-semibold"
                            >
                              {paymentMethod}
                            </Button>
            ))}
          </div>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-slate-500">
            Referensi Pembayaran
            {method === PaymentMethod.TRANSFER ? " / Required" : ""}
          </span>
          <Input
            name="reference"
            placeholder="BCA TRF 12345"
            className={`mt-1 ${fieldClassName}`}
          />
        </label>
      </div>

      {actionError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {actionError}
        </p>
      ) : null}

    </form>

    <CheckoutPinnedActionFooter>
      <PinnedActionFooter
        hint={
          actionError ? (
            <p className="font-medium text-red-600">{actionError}</p>
          ) : (
            <p className="text-slate-500">
              Catat pembayaran akhir sebelum menyelesaikan check-out.
            </p>
          )
        }
        actionsClassName="w-full flex-col items-stretch sm:w-auto sm:flex-row sm:items-center"
        actions={
          <>
            <Link
              href={`/app/fo/reservasi/${reservationId}?tab=tagihan`}
              className={buttonVariants({
                variant: "outline",
                className: "w-full justify-center sm:w-auto",
              })}
            >
              Batal
            </Link>
            <Button
              type="submit"
              form="final-payment-form"
              disabled={isPending}
              className="w-full disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Recording..." : "Record Payment & Continue"}
            </Button>
          </>
        }
      />
    </CheckoutPinnedActionFooter>
    </>
  );
}

export function CompleteCheckoutForm({
  folioId,
  reservationId,
  balance,
}: CompleteCheckoutFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [roomStatusConfirmed, setRoomStatusConfirmed] = useState(true);
  const [folioCloseConfirmed, setFolioCloseConfirmed] = useState(true);
  const [pdfConfirmed, setPdfConfirmed] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmed =
    roomStatusConfirmed && folioCloseConfirmed && pdfConfirmed;
  const isCreditBalance = folioBalanceState(balance) === "credit";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("folioId", String(folioId));

    startTransition(async () => {
      const result = await completeCheckout(formData);

      if (!result.ok) {
        const message = resultErrorMessage(
          result.error,
          "Unable to complete check-out",
        );
        setActionError(message);
        toast.error(message);
        return;
      }

      toast.success("Check-out selesai");
      router.refresh();
    });
  }

  function focusFirstUnconfirmedStep() {
    const firstUnconfirmed = formRef.current?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]:not(:checked)',
    );

    firstUnconfirmed?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstUnconfirmed?.focus({ preventScroll: true });
  }

  return (
    <>
      <form
        id="complete-checkout-form"
      ref={formRef}
      onSubmit={onSubmit}
      className="p-5"
    >
      <input type="hidden" name="folioId" value={folioId} />

      {isCreditBalance ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <div className="font-semibold text-sm">Refund harus dikembalikan</div>
            <div className="mt-1">{refundDueNote(balance)}</div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="flex items-start gap-3 py-2 text-sm text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={roomStatusConfirmed}
            onChange={(event) => setRoomStatusConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="block font-semibold text-slate-900">
              Set status kamar → Vacant Dirty (VD)
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Otomatis dikirim ke Housekeeping.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-2 text-sm text-slate-800 cursor-pointer">
          <input
            name="confirmed"
            type="checkbox"
            checked={folioCloseConfirmed}
            onChange={(event) => setFolioCloseConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="block font-semibold text-slate-900">Tutup folio</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Charge tidak dapat ditambahkan setelah folio ditutup.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-2 text-sm text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={pdfConfirmed}
            onChange={(event) => setPdfConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="block font-semibold text-slate-900">Buat PDF tagihan</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              File tersedia setelah konfirmasi.
            </span>
          </span>
        </label>
      </div>

      {actionError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {actionError}
        </p>
      ) : null}

    </form>

    <CheckoutPinnedActionFooter>
      <PinnedActionFooter
        hint={
          actionError ? (
            <p className="font-medium text-red-600">{actionError}</p>
          ) : !confirmed ? (
            <p className="font-medium text-red-600">
              Selesaikan konfirmasi check-out yang belum dicentang.
            </p>
          ) : (
            <p className="text-slate-500">
              Semua langkah telah dikonfirmasi. Check-out siap diselesaikan.
            </p>
          )
        }
        actionsClassName="w-full flex-col items-stretch sm:w-auto sm:flex-row sm:items-center"
        actions={
          <>
            <Link
              href={`/app/fo/reservasi/${reservationId}?tab=tagihan`}
              className={buttonVariants({
                variant: "outline",
                className: "w-full justify-center sm:w-auto",
              })}
            >
              Batal
            </Link>
            {confirmed ? (
              <Button
                type="submit"
                form="complete-checkout-form"
                disabled={isPending}
                className="w-full disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {isPending ? "Completing..." : "Complete Check-Out"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={focusFirstUnconfirmedStep}
                className="w-full sm:w-auto"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Complete Check-Out
              </Button>
            )}
          </>
        }
      />
    </CheckoutPinnedActionFooter>
    </>
  );
}
