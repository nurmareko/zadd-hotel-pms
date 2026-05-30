"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatIDR } from "@/lib/format";
import { updateHotelSettings } from "./actions";
import { HotelSettingsUpdateSchema } from "./schema";

type SettingsFormInput = {
  hotelName: string;
  address?: string | null;
  taxPercent: number | string;
  serviceChargePercent: number | string;
  nightAuditTime: string;
  currency: string;
};

type SettingsFormProps = {
  defaultValues: SettingsFormInput;
};

const inputClassName =
  "h-8 rounded-none border-console-border bg-console-surface text-[12px] focus-visible:border-console-ink";

const textareaClassName =
  "min-h-20 rounded-none border-console-border bg-console-surface text-[12px] focus-visible:border-console-ink";

const labelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.06em]";

const buttonClassName =
  "h-8 rounded-none border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg";

const primaryButtonClassName =
  "h-8 rounded-none border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 hover:text-console-accent";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// "}
        {title}
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function PreviewRow({
  label,
  value,
  muted = false,
  strong = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-0.5 ${
        strong ? "font-bold" : ""
      }`}
    >
      <span className={muted ? "text-slate-500" : "text-console-ink"}>
        {label}
      </span>
      <span className="num text-right">{value}</span>
    </div>
  );
}

export function SettingsForm({ defaultValues }: SettingsFormProps) {
  const form = useForm<SettingsFormInput>({
    resolver: zodResolver(
      HotelSettingsUpdateSchema,
    ) as Resolver<SettingsFormInput>,
    defaultValues,
  });
  const serviceChargeValue = useWatch({
    control: form.control,
    name: "serviceChargePercent",
  });
  const taxValue = useWatch({ control: form.control, name: "taxPercent" });
  const watchedServiceCharge = Number(serviceChargeValue || 0);
  const watchedTax = Number(taxValue || 0);
  const previewSubtotal = 100000;
  const previewService = Math.round(
    previewSubtotal * (watchedServiceCharge / 100),
  );
  const previewTaxBase = previewSubtotal + previewService;
  const previewTax = Math.round(previewTaxBase * (watchedTax / 100));
  const previewTotal = previewTaxBase + previewTax;

  async function onSubmit(values: SettingsFormInput) {
    const result = await updateHotelSettings(values);

    if (result.ok) {
      toast.success("Pengaturan diperbarui");
      form.reset({
        ...values,
        address: values.address ?? "",
      });
      return;
    }

    toast.error(result.error);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-[1100px] gap-4 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-3">
          <Section title="Informasi Hotel">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hotelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>
                      Nama Hotel
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Linggian Hotel"
                        {...field}
                        className={inputClassName}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>Mata Uang</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="IDR"
                        {...field}
                        className={inputClassName}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel className={labelClassName}>Alamat</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Bandung, Indonesia"
                      {...field}
                      value={field.value ?? ""}
                      className={textareaClassName}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Tax & Service Charge">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="taxPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>
                      Tax (PPN) %
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        {...field}
                        className={inputClassName}
                      />
                    </FormControl>
                    <p className="text-[10px] leading-4 text-slate-500">
                      Diaplikasikan ke subtotal + service charge.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceChargePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>
                      Service Charge %
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        {...field}
                        className={inputClassName}
                      />
                    </FormControl>
                    <p className="text-[10px] leading-4 text-slate-500">
                      Diaplikasikan ke subtotal F&amp;B.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          <Section title="Night Audit">
            <FormField
              control={form.control}
              name="nightAuditTime"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel className={labelClassName}>
                    Cut-off Time
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="23:00"
                      {...field}
                      className={inputClassName}
                    />
                  </FormControl>
                  <p className="text-[10px] leading-4 text-slate-500">
                    Waktu paling awal Night Audit dapat dijalankan.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>
        </div>

        <aside className="space-y-3">
          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Preview"}
            </div>
            <div className="p-3.5 text-[12px]">
              <div className="border border-console-border-soft bg-console-bg p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Contoh perhitungan F&amp;B
                </div>
                <div className="mt-2">
                  <PreviewRow
                    label="Subtotal"
                    value={formatIDR(previewSubtotal.toString())}
                  />
                  <PreviewRow
                    label={`+ Service ${watchedServiceCharge}%`}
                    value={formatIDR(previewService.toString())}
                    muted
                  />
                  <PreviewRow
                    label={`+ PPN ${watchedTax}%`}
                    value={formatIDR(previewTax.toString())}
                    muted
                  />
                  <div className="my-2 border-t border-console-border-soft" />
                  <PreviewRow
                    label="Total"
                    value={formatIDR(previewTotal.toString())}
                    strong
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-2 border border-console-border bg-console-surface p-3.5 sm:flex-row sm:justify-end lg:flex-col-reverse">
            <Button
              type="button"
              variant="outline"
              className={buttonClassName}
              onClick={() => form.reset(defaultValues)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className={primaryButtonClassName}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </aside>
      </form>
    </Form>
  );
}
