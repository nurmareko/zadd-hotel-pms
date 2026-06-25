"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
import { createMenuItem, updateMenuItem } from "./actions";
import {
  MenuItemCreateSchema,
  type MenuItemFormInput,
  type MenuItemFormValues,
} from "./schema";

const COMMON_CATEGORIES = [
  "Main",
  "Beverage",
  "Dessert",
  "Appetizer",
  "Snack",
] as const;

const OTHER_CATEGORY = "__other";

type MenuFormDefaultValues = MenuItemFormValues & {
  id: number;
};

type MenuFormProps = {
  defaultValues?: MenuFormDefaultValues;
  onCancel: () => void;
  onSaved: () => void;
};

const emptyValues: MenuItemFormInput = {
  code: "",
  name: "",
  category: "",
  price: "",
};

const inputClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const labelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.06em]";

const buttonClassName = "h-9 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground";

const primaryButtonClassName = "h-9 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-600/90";

export function MenuForm({
  defaultValues,
  onCancel,
  onSaved,
}: MenuFormProps) {
  const isEditing = Boolean(defaultValues);
  const initialValues = defaultValues ?? emptyValues;
  const startsWithCustomCategory = useMemo(
    () =>
      Boolean(
        initialValues.category &&
          !COMMON_CATEGORIES.some(
            (category) => category === initialValues.category,
          ),
      ),
    [initialValues.category],
  );
  const [usesCustomCategory, setUsesCustomCategory] = useState(
    startsWithCustomCategory,
  );
  const form = useForm<MenuItemFormInput, unknown, MenuItemFormValues>({
    resolver: zodResolver(MenuItemCreateSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: MenuItemFormValues) {
    const result = isEditing
      ? await updateMenuItem({ ...values, id: defaultValues?.id })
      : await createMenuItem(values);

    if (result.ok) {
      toast.success(isEditing ? "Menu diperbarui" : "Menu dibuat");
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
                  <Input
                    placeholder="COFFEE"
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
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Harga</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="25000"
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

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Nama Menu</FormLabel>
              <FormControl>
                <Input placeholder="Coffee" {...field} className={inputClassName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => {
            const selectValue = usesCustomCategory
              ? OTHER_CATEGORY
              : field.value || null;

            return (
              <FormItem>
                <FormLabel className={labelClassName}>Kategori</FormLabel>
                <Select
                  value={selectValue}
                  onValueChange={(value) => {
                    if (typeof value !== "string") {
                      return;
                    }

                    if (value === OTHER_CATEGORY) {
                      setUsesCustomCategory(true);
                      field.onChange(
                        COMMON_CATEGORIES.some(
                          (category) => category === field.value,
                        )
                          ? ""
                          : field.value,
                      );
                      return;
                    }

                    setUsesCustomCategory(false);
                    field.onChange(value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={`${inputClassName} w-full`}>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent align="start">
                    {COMMON_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_CATEGORY}>Other</SelectItem>
                  </SelectContent>
                </Select>
                {usesCustomCategory ? (
                  <FormControl>
                    <Input
                      className={`${inputClassName} mt-2`}
                      placeholder="Kategori khusus"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                  </FormControl>
                ) : null}
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
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
                : "Tambah Menu"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
