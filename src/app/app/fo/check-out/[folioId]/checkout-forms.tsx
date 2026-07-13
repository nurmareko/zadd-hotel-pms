"use client";

import { PaymentMethod } from "@prisma/client";
import { AlertTriangle, Check, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { folioBalanceState, refundDueNote } from "@/lib/folio-balance-display";
import { paymentMethods } from "../../folios/[id]/schema";
import { completeCheckout, recordFinalPayment } from "./actions";

type FinalPaymentFormProps = {
  folioId: number;
  balance: number;
};

type CompleteCheckoutFormProps = {
  folioId: number;
  balance: number;
};

const fieldClassName =
  "h-11 desktop:h-10 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500";

function defaultAmount(balance: number) {
  return Number.isInteger(balance) ? String(balance) : balance.toFixed(2);
}

function resultErrorMessage(error: unknown, fallback: string) {
  return typeof error === "string" ? error : fallback;
}

export function FinalPaymentForm({ folioId, balance }: FinalPaymentFormProps) {
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
            min={0.01}
            step={0.01}
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

      <div className="mt-5 flex justify-end border-t border-slate-100 pt-5">
        <Button
          type="submit"
          disabled={isPending}
          className="disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          {isPending ? "Recording..." : "Record Payment & Continue"}
        </Button>
      </div>
    </form>
  );
}

export function CompleteCheckoutForm({
  folioId,
  balance,
}: CompleteCheckoutFormProps) {
  const router = useRouter();
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

  return (
    <form id="complete-checkout-form" onSubmit={onSubmit} className="p-5">
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

      <div className="mt-5 flex justify-end border-t border-slate-100 pt-5">
        <Button
          type="submit"
          disabled={!confirmed || isPending}
          className="disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {isPending ? "Completing..." : "Complete Check-Out"}
        </Button>
      </div>
    </form>
  );
}
