"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { safelyRunAction } from "@/lib/action-errors";
import { formatIDR } from "@/lib/format";
import { postCharge } from "@/lib/folio/actions";
import {
  folioFailure,
  INITIAL_FOLIO_DIALOG_UI_STATE,
  reduceFolioActionResult,
  reduceFolioDialogClose,
  type FolioDialogUiState,
} from "@/lib/folio/errors";
import { PostChargeSchema } from "@/lib/folio/schema";

export type ChargeArticleOption = {
  id: number;
  code: string;
  name: string;
  defaultPrice: number | null;
};

type AddChargeFormInput = {
  folioId: number;
  articleId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type AddChargeDialogProps = {
  folioId: number;
  articles: ChargeArticleOption[];
  disabled: boolean;
  variant?: "default" | "outline";
};

const fieldClassName =
  "h-11 desktop:h-10 rounded-md border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20";
const selectClassName =
  "h-11 desktop:h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors";

export function AddChargeDialog({
  folioId,
  articles,
  disabled,
  variant = "default",
}: AddChargeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uiState, setUiState] = useState<FolioDialogUiState>(
    INITIAL_FOLIO_DIALOG_UI_STATE,
  );
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddChargeFormInput>({
    resolver: zodResolver(PostChargeSchema) as unknown as Resolver<AddChargeFormInput>,
    mode: "onChange",
    defaultValues: {
      folioId,
      articleId: "",
      description: "",
      quantity: "1",
      unitPrice: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting || isPending;

  const [quantityValue, unitPriceValue] = useWatch({
    control: form.control,
    name: ["quantity", "unitPrice"],
  });
  const quantity = Number(quantityValue || 0);
  const unitPrice = Number(unitPriceValue || 0);
  const amount = useMemo(
    () =>
      Number.isFinite(quantity) && Number.isFinite(unitPrice)
        ? quantity * unitPrice
        : 0,
    [quantity, unitPrice],
  );

  function resetForm() {
    form.reset({
      folioId,
      articleId: "",
      description: "",
      quantity: "1",
      unitPrice: "",
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting && !nextOpen) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setUiState((current) => reduceFolioDialogClose(current));
      if (!uiState.isUncertain) {
        resetForm();
      }
    }
  }

  async function onSubmit(values: AddChargeFormInput) {
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
    formData.set("articleId", values.articleId);
    formData.set("description", values.description ?? "");
    formData.set("quantity", values.quantity);
    formData.set("unitPrice", values.unitPrice);

    startTransition(async () => {
      const result = await safelyRunAction(
        () => postCharge(formData),
        () => folioFailure("RESULT_UNKNOWN"),
      );

      const nextState = reduceFolioActionResult(uiState, result);
      setUiState(nextState);

      if (!result.ok) {
        return;
      }

      toast.success("Tagihan dicatat");
      resetForm();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled || articles.length === 0}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Tambah Tagihan
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl overflow-hidden sm:max-w-md"
          showCloseButton={!isSubmitting}
        >
          <DialogHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Tambah Tagihan
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
                name="articleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">Artikel</FormLabel>
                    <FormControl>
                      <select
                        disabled={isSubmitting}
                        className={selectClassName}
                        {...field}
                        onChange={(event) => {
                          field.onChange(event.target.value);
                          const article = articles.find(
                            (candidate) =>
                              String(candidate.id) === event.target.value,
                          );
                          form.setValue(
                            "unitPrice",
                            article?.defaultPrice === null ||
                              typeof article?.defaultPrice === "undefined"
                              ? ""
                              : String(article.defaultPrice),
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                      >
                        <option value="">Pilih artikel</option>
                        {articles.map((article) => (
                          <option key={article.id} value={String(article.id)}>
                            {article.code} - {article.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">Deskripsi</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isSubmitting}
                        placeholder="Opsional"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">Jumlah</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          disabled={isSubmitting}
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
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">Harga Satuan</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Harga
                </div>
                <div className="mt-1 flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-right text-sm font-bold tabular-nums text-slate-950">
                  {formatIDR(amount)}
                </div>
              </div>

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
                  {isSubmitting ? "Mencatat..." : "Catat Tagihan"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
