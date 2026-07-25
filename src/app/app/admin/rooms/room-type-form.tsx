"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type FieldPath, type Resolver } from "react-hook-form";
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
import { focusFirstFormError } from "@/lib/form-error-focus";
import { createRoomType, updateRoomType } from "./actions";
import { RoomTypeCreateSchema, RoomTypeUpdateSchema } from "./schema";

type RoomTypeFormDefaultValues = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  capacity: number;
  baseRate: number;
};

type RoomTypeFormInput = {
  id?: number;
  code: string;
  name: string;
  description?: string | null;
  capacity: number | string;
  baseRate: number | string;
};

type RoomTypeFormProps = {
  defaultValues?: RoomTypeFormDefaultValues;
  onCancel: () => void;
  onSaved: () => void;
};

const emptyValues: RoomTypeFormInput = {
  code: "",
  name: "",
  description: null,
  capacity: "",
  baseRate: "",
};

const inputClassName = "flex h-11 desktop:h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "min-h-20 rounded-none border-border bg-card text-sm focus-visible:border-primary";

const labelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.06em]";

export function RoomTypeForm({
  defaultValues,
  onCancel,
  onSaved,
}: RoomTypeFormProps) {
  const isEditing = Boolean(defaultValues);
  const initialValues = defaultValues ?? emptyValues;
  const form = useForm<RoomTypeFormInput>({
    resolver: zodResolver(
      isEditing ? RoomTypeUpdateSchema : RoomTypeCreateSchema,
    ) as Resolver<RoomTypeFormInput>,
    defaultValues: initialValues,
  });
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  function onInvalid() {
    focusFirstFormError(formElement);
  }

  async function onSubmit(values: RoomTypeFormInput) {
    const result = isEditing
      ? await updateRoomType({ ...values, id: defaultValues?.id })
      : await createRoomType(values);

    if (result.ok) {
      toast.success(isEditing ? "Tipe kamar diperbarui" : "Tipe kamar dibuat");
      form.reset(emptyValues);
      onSaved();
      return;
    }

    if (result.field) {
      form.setError(
        result.field as FieldPath<RoomTypeFormInput>,
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
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Code</FormLabel>
                <FormControl>
                  <Input placeholder="DLX" {...field} className={inputClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Nama Tipe</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Deluxe Room"
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Deskripsi</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional room type notes"
                  {...field}
                  value={field.value ?? ""}
                  className={textareaClassName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
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
                    placeholder="2"
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
            name="baseRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Base Rate</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="750000"
                    {...field}
                    className={inputClassName}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Menyimpan..."
              : isEditing
                ? "Simpan Perubahan"
                : "Tambah Tipe"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
