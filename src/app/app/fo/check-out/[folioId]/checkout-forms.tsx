"use client";

import { PaymentMethod } from "@prisma/client";
import { Check, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymentMethods } from "../../folios/[id]/schema";
import { completeCheckout, recordFinalPayment } from "./actions";

type FinalPaymentFormProps = {
  folioId: number;
  balance: number;
};

type CompleteCheckoutFormProps = {
  folioId: number;
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
    <form onSubmit={onSubmit} className="space-y-3.5 p-3.5">
      <input type="hidden" name="folioId" value={folioId} />
      <input type="hidden" name="method" value={method} />

      <div className="grid gap-3.5 sm:grid-cols-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Amount
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
            Method
          </span>
          <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
            <SelectTrigger className="mt-1 h-8 w-full rounded-none border-console-border bg-console-surface text-[12px]">
              <SelectValue placeholder="Pilih metode" />
            </SelectTrigger>
            <SelectContent align="start" className="rounded-none border-console-border">
              {paymentMethods.map((paymentMethod) => (
                <SelectItem
                  key={paymentMethod}
                  value={paymentMethod}
                  className="rounded-none text-[12px]"
                >
                  {paymentMethod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Reference{method === PaymentMethod.TRANSFER ? " / Required" : ""}
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

      <div className="flex justify-end border-t border-console-border pt-3.5">
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

export function CompleteCheckoutForm({ folioId }: CompleteCheckoutFormProps) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    <form onSubmit={onSubmit} className="space-y-3.5 p-3.5">
      <input type="hidden" name="folioId" value={folioId} />

      <label className="flex items-start gap-2 border border-console-border bg-console-bg p-3 text-[12px] font-medium text-console-ink">
        <input
          name="confirmed"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded-none border-console-border"
        />
        <span>
          Saya konfirmasi tamu telah meninggalkan kamar dan barang sudah
          diperiksa.
        </span>
      </label>

      {actionError ? (
        <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
          {actionError}
        </p>
      ) : null}

      <div className="flex justify-end border-t border-console-border pt-3.5">
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
