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
  "h-8 rounded-none border-console-border bg-console-surface text-[12px]";

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
    <form id="final-payment-form" onSubmit={onSubmit} className="p-3.5">
      <input type="hidden" name="folioId" value={folioId} />
      <input type="hidden" name="method" value={method} />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
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
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Metode
          </span>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {paymentMethods.map((paymentMethod) => (
              <button
                key={paymentMethod}
                type="button"
                onClick={() => setMethod(paymentMethod)}
                className={`h-8 border px-2 text-[11px] font-semibold uppercase tracking-[0.04em] ${
                  method === paymentMethod
                    ? "border-console-ink bg-console-ink text-console-accent"
                    : "border-console-border bg-console-surface text-console-ink hover:border-console-ink hover:bg-console-bg"
                }`}
              >
                {paymentMethod}
              </button>
            ))}
          </div>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
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
        <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
          {actionError}
        </p>
      ) : null}

      <div className="mt-3.5 flex justify-end border-t border-console-border pt-3.5">
        <Button
          type="submit"
          disabled={isPending}
          className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
        >
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
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
    <form id="complete-checkout-form" onSubmit={onSubmit} className="p-3.5">
      <input type="hidden" name="folioId" value={folioId} />

      {isCreditBalance ? (
        <div className="mb-3 flex items-start gap-2 border border-status-vd-pip bg-status-vd-bg p-3 text-[12px] text-status-vd-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <div>
            <div className="font-semibold">Refund harus dikembalikan</div>
            <div className="mt-1">{refundDueNote(balance)}</div>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="flex items-start gap-2 py-1.5 text-[12px] text-console-ink">
          <input
            type="checkbox"
            checked={roomStatusConfirmed}
            onChange={(event) => setRoomStatusConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-none border-console-border"
          />
          <span>
            <span className="block font-medium">
              Set status kamar → Vacant Dirty (VD)
            </span>
            <span className="block text-[11px] text-slate-500">
              Otomatis dikirim ke Housekeeping.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 py-1.5 text-[12px] text-console-ink">
          <input
            name="confirmed"
            type="checkbox"
            checked={folioCloseConfirmed}
            onChange={(event) => setFolioCloseConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-none border-console-border"
          />
          <span>
            <span className="block font-medium">Tutup folio</span>
            <span className="block text-[11px] text-slate-500">
              Charge tidak dapat ditambahkan setelah folio ditutup.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 py-1.5 text-[12px] text-console-ink">
          <input
            type="checkbox"
            checked={pdfConfirmed}
            onChange={(event) => setPdfConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-none border-console-border"
          />
          <span>
            <span className="block font-medium">Generate PDF bill</span>
            <span className="block text-[11px] text-slate-500">
              File tersedia setelah konfirmasi.
            </span>
          </span>
        </label>
      </div>

      {actionError ? (
        <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
          {actionError}
        </p>
      ) : null}

      <div className="mt-3.5 flex justify-end border-t border-console-border pt-3.5">
        <Button
          type="submit"
          disabled={!confirmed || isPending}
          className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:border-console-border disabled:bg-console-bg disabled:text-slate-400"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {isPending ? "Completing..." : "Complete Check-Out"}
        </Button>
      </div>
    </form>
  );
}
