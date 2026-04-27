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
      toast.success(isEditing ? "Menu item updated" : "Menu item created");
      form.reset(emptyValues);
      onSaved();
      return;
    }

    toast.error(result.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input placeholder="COFFEE" {...field} />
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
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Coffee" {...field} />
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
                <FormLabel>Category</FormLabel>
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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
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
                      className="mt-2"
                      placeholder="Custom category"
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

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Menu Item"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
