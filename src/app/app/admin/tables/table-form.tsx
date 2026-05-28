"use client";

import { TableLocation, TableStatus } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { focusFirstFormError } from "@/lib/form-error-focus";
import { createRestaurantTable, updateRestaurantTable } from "./actions";
import {
  RestaurantTableCreateSchema,
  tableLocations,
  tableStatuses,
  type RestaurantTableFormInput,
  type RestaurantTableFormValues,
} from "./schema";

type TableFormDefaultValues = RestaurantTableFormValues & {
  id: number;
};

type TableFormProps = {
  defaultValues?: TableFormDefaultValues;
  onCancel: () => void;
  onSaved: () => void;
};

const locationLabels: Record<TableLocation, string> = {
  INDOOR: "Indoor",
  OUTDOOR: "Outdoor",
  PRIVATE: "Private",
};

const statusLabels: Record<TableStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  OUT_OF_SERVICE: "Out of Service",
};

const emptyValues: RestaurantTableFormInput = {
  number: "",
  capacity: "",
  location: TableLocation.INDOOR,
  status: TableStatus.AVAILABLE,
  notes: null,
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

export function RestaurantTableForm({
  defaultValues,
  onCancel,
  onSaved,
}: TableFormProps) {
  const isEditing = Boolean(defaultValues);
  const initialValues = defaultValues ?? emptyValues;
  const locationItems = useMemo(
    () =>
      tableLocations.map((location) => ({
        label: locationLabels[location],
        value: location,
      })),
    [],
  );
  const statusItems = useMemo(
    () =>
      tableStatuses.map((status) => ({
        label: statusLabels[status],
        value: status,
      })),
    [],
  );
  const form = useForm<
    RestaurantTableFormInput,
    unknown,
    RestaurantTableFormValues
  >({
    resolver: zodResolver(RestaurantTableCreateSchema),
    defaultValues: initialValues,
  });
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  function onInvalid() {
    focusFirstFormError(formElement);
  }

  async function onSubmit(values: RestaurantTableFormValues) {
    const result = isEditing
      ? await updateRestaurantTable({ ...values, id: defaultValues?.id })
      : await createRestaurantTable(values);

    if (result.ok) {
      toast.success(isEditing ? "Table updated" : "Table created");
      form.reset(emptyValues);
      onSaved();
      return;
    }

    if (result.field) {
      form.setError(
        result.field as FieldPath<RestaurantTableFormInput>,
        { type: "server", message: result.error },
        { shouldFocus: true },
      );
      focusFirstFormError(formElement);
    }

    toast.error(result.error);
  }

  return (
    <Form {...form}>
      <form
        ref={setFormElement}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Nomor Meja</FormLabel>
                <FormControl>
                  <Input placeholder="T01" {...field} className={inputClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Kapasitas</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="4"
                    {...field}
                    value={
                      typeof field.value === "string" ||
                      typeof field.value === "number"
                        ? field.value
                        : ""
                    }
                    className={inputClassName}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Lokasi</FormLabel>
                <Select
                  items={locationItems}
                  value={field.value}
                  onValueChange={(value) => {
                    if (tableLocations.some((location) => location === value)) {
                      field.onChange(value);
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={`${inputClassName} w-full`}>
                      <SelectValue placeholder="Pilih lokasi" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent align="start">
                    {tableLocations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {locationLabels[location]}
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
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Status</FormLabel>
                <Select
                  items={statusItems}
                  value={field.value}
                  onValueChange={(value) => {
                    if (tableStatuses.some((status) => status === value)) {
                      field.onChange(value);
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={`${inputClassName} w-full`}>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent align="start">
                    {tableStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Catatan</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional table notes"
                  {...field}
                  value={field.value ?? ""}
                  className={textareaClassName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-2 border-t border-console-border pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className={buttonClassName}
            onClick={onCancel}
          >
            Batal
          </Button>
          <Button
            type="submit"
            className={primaryButtonClassName}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Menyimpan..."
              : isEditing
                ? "Simpan Perubahan"
                : "Tambah Meja"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
