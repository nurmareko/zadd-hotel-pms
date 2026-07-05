"use client";

import { PaymentMethod } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { consoleButtonClassName } from "@/components/console-button";
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
  "h-10 rounded-md border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20";

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

    toast.success("Pembayaran tercatat");
    resetAndClose(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => resetAndClose(true)}
        className={consoleButtonClassName("primary")}
      >
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        Catat Pembayaran
      </Button>

      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl overflow-hidden sm:max-w-md">
          <DialogHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Catat Pembayaran
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
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
                    <FormLabel className="text-sm font-medium text-slate-700">Jumlah</FormLabel>
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
                    <FormLabel className="text-sm font-medium text-slate-700">Metode</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full rounded-md border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20">
                          <SelectValue placeholder="Pilih metode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent
                        align="start"
                        className="rounded-lg border border-slate-200 bg-white shadow-md"
                      >
                        {paymentMethods.map((paymentMethod) => (
                          <SelectItem
                            key={paymentMethod}
                            value={paymentMethod}
                            className="rounded-md text-sm cursor-pointer"
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
                    <FormLabel className="text-sm font-medium text-slate-700">
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
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {actionError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetAndClose(false)}
                  className={consoleButtonClassName("secondary")}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={!form.formState.isValid || form.formState.isSubmitting}
                  className={consoleButtonClassName("primary")}
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
