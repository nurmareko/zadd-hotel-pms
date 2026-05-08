"use client";

import { PaymentMethod } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordPayment } from "./actions";
import { paymentMethods, PaymentSchema } from "./schema";

type PaymentFormInput = {
  folioId: number;
  amount: string;
  method: (typeof paymentMethods)[number];
  reference: string;
};

type RecordPaymentDialogProps = {
  folioId: number;
  balance: number;
  disabled: boolean;
};

const fieldClassName =
  "h-8 rounded-none border-console-border bg-console-surface text-[12px]";

function defaultAmount(balance: number) {
  if (balance <= 0) {
    return "";
  }

  return Number.isInteger(balance) ? String(balance) : balance.toFixed(2);
}

function resultErrorMessage(error: unknown) {
  return typeof error === "string" ? error : "Unable to record payment";
}

export function RecordPaymentDialog({
  folioId,
  balance,
  disabled,
}: RecordPaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const form = useForm<PaymentFormInput>({
    resolver: zodResolver(PaymentSchema) as unknown as Resolver<PaymentFormInput>,
    mode: "onChange",
    defaultValues: {
      folioId,
      amount: defaultAmount(balance),
      method: PaymentMethod.CASH,
      reference: "",
    },
  });

  const method = useWatch({
    control: form.control,
    name: "method",
  });

  function formDefaults() {
    return {
      folioId,
      amount: defaultAmount(balance),
      method: PaymentMethod.CASH,
      reference: "",
    };
  }

  function resetAndClose(nextOpen: boolean) {
    setOpen(nextOpen);
    setActionError(null);

    form.reset(formDefaults());
  }

  async function onSubmit(values: PaymentFormInput) {
    setActionError(null);

    const formData = new FormData();
    formData.set("folioId", String(folioId));
    formData.set("amount", values.amount);
    formData.set("method", values.method);
    formData.set("reference", values.reference ?? "");

    const result = await recordPayment(formData);

    if (!result.ok) {
      const message = resultErrorMessage(result.error);
      setActionError(message);
      toast.error(message);
      return;
    }

    toast.success("Payment recorded");
    resetAndClose(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => resetAndClose(true)}
        className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
      >
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        Catat Pembayaran
      </Button>

      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="rounded-none border border-console-border bg-console-surface p-0 text-console-ink sm:max-w-md">
          <DialogHeader className="bg-console-ink px-3.5 py-3">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Catat Pembayaran"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5 p-3.5">
              <input
                type="hidden"
                value={folioId}
                {...form.register("folioId")}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        placeholder="0"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-8 w-full rounded-none border-console-border bg-console-surface text-[12px]">
                          <SelectValue placeholder="Pilih method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent
                        align="start"
                        className="rounded-none border-console-border"
                      >
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reference{method === PaymentMethod.TRANSFER ? " / Required" : ""}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="BCA TRF 12345"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {actionError ? (
                <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
                  {actionError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t border-console-border pt-3.5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetAndClose(false)}
                  className="h-8 rounded-none border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={!form.formState.isValid || form.formState.isSubmitting}
                  className="h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
                >
                  {form.formState.isSubmitting
                    ? "Recording..."
                    : "Record Payment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
