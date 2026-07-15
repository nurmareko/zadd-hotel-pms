"use client";

import {
  PricingRuleAdjustmentKind,
  PricingRuleDayOfWeek,
  PricingRuleSelectorKind,
} from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import {
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { focusFirstFormError } from "@/lib/form-error-focus";
import { createPricingRule, updatePricingRule } from "./actions";
import {
  PricingRuleCreateSchema,
  PricingRuleUpdateSchema,
} from "./schema";

export type PricingRoomTypeOption = {
  id: number;
  code: string;
  name: string;
  baseRate: string;
};

export type PricingRuleFormValues = {
  id?: string;
  name: string;
  roomTypeId: number | string;
  selectorKind: PricingRuleSelectorKind;
  dayOfWeek?: PricingRuleDayOfWeek | null;
  startsOn?: string | null;
  endsBefore?: string | null;
  adjustmentKind: PricingRuleAdjustmentKind;
  adjustmentValue: string;
  isActive: boolean;
};

type PricingRuleFormProps = {
  roomTypes: PricingRoomTypeOption[];
  defaultValues?: PricingRuleFormValues & { id: string };
  onCancelAction: () => void;
  onSavedAction: () => void;
};

const emptyValues: PricingRuleFormValues = {
  name: "",
  roomTypeId: "",
  selectorKind: PricingRuleSelectorKind.DAY_OF_WEEK,
  dayOfWeek: null,
  startsOn: null,
  endsBefore: null,
  adjustmentKind: PricingRuleAdjustmentKind.AMOUNT_DELTA,
  adjustmentValue: "",
  isActive: true,
};

const inputClassName =
  "h-11 desktop:h-10 rounded-md border-input bg-white text-sm shadow-sm";
const selectClassName =
  "h-11 desktop:h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
const labelClassName = "text-sm font-semibold text-foreground";

const dayLabels: Record<PricingRuleDayOfWeek, string> = {
  MONDAY: "Senin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Kamis",
  FRIDAY: "Jumat",
  SATURDAY: "Sabtu",
  SUNDAY: "Minggu",
};

function sanitizeSelectorValues(
  values: PricingRuleFormValues,
): PricingRuleFormValues {
  if (values.selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK) {
    return { ...values, startsOn: null, endsBefore: null };
  }

  return { ...values, dayOfWeek: null };
}

export function PricingRuleForm({
  roomTypes,
  defaultValues,
  onCancelAction,
  onSavedAction,
}: PricingRuleFormProps) {
  const isEditing = Boolean(defaultValues);
  const form = useForm<PricingRuleFormValues>({
    resolver: zodResolver(
      isEditing ? PricingRuleUpdateSchema : PricingRuleCreateSchema,
    ) as Resolver<PricingRuleFormValues>,
    defaultValues: defaultValues ?? emptyValues,
  });
  const selectorKind = useWatch({
    control: form.control,
    name: "selectorKind",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  function onInvalid() {
    focusFirstFormError(formElement);
  }

  async function onSubmit(rawValues: PricingRuleFormValues) {
    setServerError(null);
    const values = sanitizeSelectorValues(rawValues);
    const result = isEditing
      ? await updatePricingRule({ ...values, id: defaultValues?.id })
      : await createPricingRule(values);

    if (result.ok) {
      toast.success(
        isEditing ? "Aturan harga diperbarui" : "Aturan harga dibuat",
      );
      form.reset(emptyValues);
      onSavedAction();
      return;
    }

    setServerError(result.error);
    if (result.field) {
      form.setError(
        result.field as FieldPath<PricingRuleFormValues>,
        { type: "server", message: result.error },
        { shouldFocus: true },
      );
      focusFirstFormError(formElement);
    }
  }

  return (
    <Form {...form}>
      <form
        ref={setFormElement}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
      >
        <div className="max-h-[min(70vh,680px)] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {serverError ? (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClassName}>Nama aturan</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={inputClassName}
                      placeholder="Tarif akhir pekan"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClassName}>Tipe kamar</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className={selectClassName}
                      value={field.value ?? ""}
                    >
                      <option value="">Pilih tipe kamar</option>
                      {roomTypes.map((roomType) => (
                        <option key={roomType.id} value={roomType.id}>
                          {roomType.code} — {roomType.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="rounded-lg border border-border bg-slate-50 p-4">
            <FormField
              control={form.control}
              name="selectorKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClassName}>Berlaku berdasarkan</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className={selectClassName}
                      onChange={(event) => {
                        const value = event.target.value as PricingRuleSelectorKind;
                        field.onChange(value);
                        setServerError(null);
                        if (value === PricingRuleSelectorKind.DAY_OF_WEEK) {
                          form.setValue("startsOn", null);
                          form.setValue("endsBefore", null);
                          form.clearErrors(["startsOn", "endsBefore"]);
                        } else {
                          form.setValue("dayOfWeek", null);
                          form.clearErrors("dayOfWeek");
                        }
                      }}
                    >
                      <option value={PricingRuleSelectorKind.DAY_OF_WEEK}>
                        Hari dalam minggu
                      </option>
                      <option value={PricingRuleSelectorKind.DATE_RANGE}>
                        Rentang tanggal
                      </option>
                    </select>
                  </FormControl>
                  <FormDescription>
                    Rentang tanggal lebih diprioritaskan daripada aturan hari saat keduanya cocok.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectorKind === PricingRuleSelectorKind.DAY_OF_WEEK ? (
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel className={labelClassName}>Hari</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className={selectClassName}
                        value={field.value ?? ""}
                      >
                        <option value="">Pilih hari</option>
                        {Object.values(PricingRuleDayOfWeek).map((day) => (
                          <option key={day} value={day}>
                            {dayLabels[day]}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startsOn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClassName}>Mulai berlaku</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          className={inputClassName}
                        />
                      </FormControl>
                      <FormDescription>Termasuk tanggal ini.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endsBefore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClassName}>Berakhir sebelum</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          className={inputClassName}
                        />
                      </FormControl>
                      <FormDescription>Tidak termasuk tanggal ini.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="adjustmentKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClassName}>Jenis penyesuaian</FormLabel>
                  <FormControl>
                    <select {...field} className={selectClassName}>
                      <option value={PricingRuleAdjustmentKind.AMOUNT_DELTA}>
                        Nominal rupiah
                      </option>
                      <option value={PricingRuleAdjustmentKind.PERCENT_DELTA}>
                        Persentase
                      </option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adjustmentValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClassName}>Nilai penyesuaian</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={inputClassName}
                      inputMode="decimal"
                      placeholder="Contoh: 100000 atau -10"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormDescription>
                    Gunakan nilai negatif untuk potongan harga.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Status aturan</FormLabel>
                <FormControl>
                  <button
                    ref={field.ref}
                    name={field.name}
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    onBlur={field.onBlur}
                    onClick={() => field.onChange(!field.value)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 desktop:min-h-10"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {field.value ? "Aktif" : "Nonaktif"}
                      </span>
                      <span className="block text-xs text-slate-500">
                        Hanya aturan aktif yang digunakan oleh resolver pratinjau.
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        field.value ? "bg-slate-900" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
                          field.value ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none rounded-b-xl px-4 sm:px-5">
          <Button
            type="button"
            variant="outline"
            onClick={onCancelAction}
            disabled={form.formState.isSubmitting}
          >
            Batal
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Menyimpan..."
              : isEditing
                ? "Simpan perubahan"
                : "Buat aturan"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
