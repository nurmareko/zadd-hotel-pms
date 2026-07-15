"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Eye, Info } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldPath, type Resolver } from "react-hook-form";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { focusFirstFormError } from "@/lib/form-error-focus";
import { formatIDR } from "@/lib/format";
import {
  previewPricingSchedule,
  type PricingPreviewResult,
} from "./actions";
import type { PricingRoomTypeOption } from "./pricing-rule-form";
import { PricingPreviewSchema } from "./schema";

type PreviewFormValues = {
  roomTypeId: number | string;
  arrivalDate: string;
  departureDate: string;
};

type PricingPreviewProps = {
  roomTypes: PricingRoomTypeOption[];
};

const controlClassName =
  "h-11 desktop:h-10 rounded-md border-input bg-white text-sm shadow-sm";
const selectClassName =
  "h-11 desktop:h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

function formatPreviewDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function PricingPreview({ roomTypes }: PricingPreviewProps) {
  const form = useForm<PreviewFormValues>({
    resolver: zodResolver(PricingPreviewSchema) as Resolver<PreviewFormValues>,
    defaultValues: {
      roomTypeId: roomTypes[0]?.id ?? "",
      arrivalDate: "",
      departureDate: "",
    },
  });
  const [result, setResult] = useState<PricingPreviewResult | null>(null);
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  async function onSubmit(values: PreviewFormValues) {
    setResult(null);
    const nextResult = await previewPricingSchedule(values);
    setResult(nextResult);

    if (!nextResult.ok && nextResult.field) {
      form.setError(
        nextResult.field as FieldPath<PreviewFormValues>,
        { type: "server", message: nextResult.error },
        { shouldFocus: true },
      );
      focusFirstFormError(formElement);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Eye className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Pratinjau bayangan tarif
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Simulasikan hasil resolver untuk interval menginap [kedatangan,
              keberangkatan).
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm leading-5 text-blue-800">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Ini hanya mode shadow/pratinjau dan tidak digunakan untuk membuat atau
            mengubah reservasi.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          ref={setFormElement}
          onSubmit={form.handleSubmit(onSubmit, () =>
            focusFirstFormError(formElement),
          )}
          noValidate
          className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end"
        >
          <FormField
            control={form.control}
            name="roomTypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipe kamar</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    value={field.value ?? ""}
                    className={selectClassName}
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
          <FormField
            control={form.control}
            name="arrivalDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kedatangan</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className={controlClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="departureDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Keberangkatan</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className={controlClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Calculator aria-hidden="true" />
            {form.formState.isSubmitting ? "Menghitung..." : "Hitung pratinjau"}
          </Button>
        </form>
      </Form>

      {result && !result.ok ? (
        <div className="mx-4 mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-5 sm:mb-5" role="alert">
          {result.error}
        </div>
      ) : null}

      {result?.ok ? (
        <div className="border-t border-border">
          <div className="grid gap-px bg-border sm:grid-cols-3">
            <div className="bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Tarif dasar / malam</p>
              <p className="num mt-1 text-lg font-bold">{formatIDR(result.baseRate)}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Total dasar flat</p>
              <p className="num mt-1 text-lg font-bold">{formatIDR(result.flatTotal)}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Total setelah aturan</p>
              <p className="num mt-1 text-lg font-bold text-blue-700">
                {formatIDR(result.resolvedTotal)}
              </p>
              <p className="num mt-1 text-xs text-slate-500">
                Selisih {formatIDR(Number(result.resolvedTotal) - Number(result.flatTotal))}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-170">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Malam</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Aturan diterapkan</TableHead>
                  <TableHead className="px-4 text-right">Tarif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.nights.map((night, index) => (
                  <TableRow key={night.date}>
                    <TableCell className="num px-4 font-medium">{index + 1}</TableCell>
                    <TableCell className="num">{formatPreviewDate(night.date)}</TableCell>
                    <TableCell>
                      {night.sourceRule ? (
                        <div>
                          <p className="font-medium text-foreground">{night.sourceRule.name}</p>
                          <p className="text-xs text-slate-500">
                            {night.sourceRule.selectorKind === "DATE_RANGE"
                              ? "Rentang tanggal"
                              : "Hari dalam minggu"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500">Tarif dasar (tanpa aturan)</span>
                      )}
                    </TableCell>
                    <TableCell className="num px-4 text-right font-semibold">
                      {formatIDR(night.rate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
