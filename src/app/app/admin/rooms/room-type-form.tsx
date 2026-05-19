"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
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
  description: "",
  capacity: "",
  baseRate: "",
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

export function RoomTypeForm({
  defaultValues,
  onCancel,
  onSaved,
}: RoomTypeFormProps) {
  const isEditing = Boolean(defaultValues);
  const initialValues = defaultValues
    ? { ...defaultValues, description: defaultValues.description ?? "" }
    : emptyValues;
  const form = useForm<RoomTypeFormInput>({
    resolver: zodResolver(
      isEditing ? RoomTypeUpdateSchema : RoomTypeCreateSchema,
    ) as Resolver<RoomTypeFormInput>,
    defaultValues: initialValues,
  });

  async function onSubmit(values: RoomTypeFormInput) {
    const result = isEditing
      ? await updateRoomType({ ...values, id: defaultValues?.id })
      : await createRoomType(values);

    if (result.ok) {
      toast.success(isEditing ? "Room type updated" : "Room type created");
      form.reset(emptyValues);
      onSaved();
      return;
    }

    toast.error(result.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    min={0}
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
              ? "Saving..."
              : isEditing
                ? "Simpan Perubahan"
                : "Buat Tipe"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
