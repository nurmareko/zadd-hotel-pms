"use client";

import { PaymentMethod } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { safelyRunAction } from "@/lib/action-errors";
import { recordPayment } from "@/lib/folio/actions";
import {
  folioFailure,
  INITIAL_FOLIO_DIALOG_UI_STATE,
  reduceFolioActionResult,
  reduceFolioDialogClose,
  type FolioDialogUiState,
} from "@/lib/folio/errors";
import { paymentMethods, PaymentSchema } from "@/lib/folio/schema";

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
  "h-11 desktop:h-10 rounded-md border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20";

function defaultAmount(balance: number) {
  if (balance <= 0) {
    return "";
  }

  return String(balance);
}

export function RecordPaymentDialog({
  folioId,
  balance,
  disabled,
}: RecordPaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uiState, setUiState] = useState<FolioDialogUiState>(
    INITIAL_FOLIO_DIALOG_UI_STATE,
  );
  const [isPending, startTransition] = useTransition();

  function formDefaults(): PaymentFormInput {
    return {
      folioId,
      amount: defaultAmount(balance),
      method: PaymentMethod.CASH,
      reference: "",
    };
  }

  const form = useForm<PaymentFormInput>({
    resolver: zodResolver(PaymentSchema) as unknown as Resolver<PaymentFormInput>,
    mode: "onChange",
    defaultValues: formDefaults(),
  });

  const isSubmitting = form.formState.isSubmitting || isPending;

  const method = useWatch({
    control: form.control,
    name: "method",
  });

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting && !nextOpen) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setUiState((current) => reduceFolioDialogClose(current));
      if (!uiState.isUncertain) {
        form.reset(formDefaults());
      }
    }
  }

  async function onSubmit(values: PaymentFormInput) {
    if (uiState.isUncertain || isSubmitting) {
      return;
    }

    setUiState((current) => ({
      ...current,
      actionError: null,
      errorCode: null,
    }));

    const formData = new FormData();
    formData.set("folioId", String(folioId));
    formData.set("amount", values.amount);
    formData.set("method", values.method);
    formData.set("reference", values.reference ?? "");

    startTransition(async () => {
      const result = await safelyRunAction(
        () => recordPayment(formData),
        () => folioFailure("RESULT_UNKNOWN"),
      );

      const nextState = reduceFolioActionResult(uiState, result);
      setUiState(nextState);

      if (!result.ok) {
        return;
      }

      toast.success("Pembayaran tercatat");
      form.reset(formDefaults());
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        Catat Pembayaran
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl overflow-hidden sm:max-w-md"
          showCloseButton={!isSubmitting}
        >
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
                        min={1}
                        step={1}
                        disabled={isSubmitting}
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
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 desktop:h-10 w-full rounded-md border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20">
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
                      Referensi{method === PaymentMethod.TRANSFER ? " / Wajib" : ""}
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isSubmitting}
                        placeholder="BCA TRF 12345"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {uiState.actionError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  <p className="font-medium">{uiState.actionError}</p>
                  {uiState.isUncertain ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-red-300 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => window.location.reload()}
                      >
                        Muat ulang halaman
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleOpenChange(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !form.formState.isValid || isSubmitting || uiState.isUncertain
                  }
                >
                  {isSubmitting ? "Mencatat..." : "Catat Pembayaran"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
