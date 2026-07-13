"use client";

import { ArticleType } from "@prisma/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { focusFirstFormError } from "@/lib/form-error-focus";
import { createArticle, updateArticle } from "./actions";
import {
  articleTypes,
  ArticleCreateSchema,
  ArticleUpdateSchema,
  type ArticleTypeValue,
} from "./schema";

type ArticleFormDefaultValues = {
  id: number;
  code: string;
  name: string;
  type: ArticleType;
  defaultPrice: number | null;
};

type ArticleFormInput = {
  id?: number;
  code: string;
  name: string;
  type: ArticleTypeValue;
  defaultPrice?: number | string | null;
};

type ArticleFormProps = {
  defaultValues?: ArticleFormDefaultValues;
  onCancel: () => void;
  onSaved: () => void;
};

const emptyValues: ArticleFormInput = {
  code: "",
  name: "",
  type: ArticleType.ROOM,
  defaultPrice: "",
};

const inputClassName = "flex h-11 desktop:h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const labelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.06em]";

function isArticleType(value: unknown): value is ArticleTypeValue {
  return articleTypes.some((type) => type === value);
}

export function ArticleForm({
  defaultValues,
  onCancel,
  onSaved,
}: ArticleFormProps) {
  const isEditing = Boolean(defaultValues);
  const initialValues = defaultValues
    ? { ...defaultValues, defaultPrice: defaultValues.defaultPrice ?? "" }
    : emptyValues;
  const form = useForm<ArticleFormInput>({
    resolver: zodResolver(
      isEditing ? ArticleUpdateSchema : ArticleCreateSchema,
    ) as Resolver<ArticleFormInput>,
    defaultValues: initialValues,
  });
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  function onInvalid() {
    focusFirstFormError(formElement);
  }

  async function onSubmit(values: ArticleFormInput) {
    const result = isEditing
      ? await updateArticle({ ...values, id: defaultValues?.id })
      : await createArticle(values);

    if (result.ok) {
      toast.success(isEditing ? "Artikel diperbarui" : "Artikel dibuat");
      form.reset(emptyValues);
      onSaved();
      return;
    }

    if (result.field) {
      form.setError(
        result.field as FieldPath<ArticleFormInput>,
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
                  <Input placeholder="ROOM" {...field} className={inputClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Tipe</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (isArticleType(value)) {
                      field.onChange(value);
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={`${inputClassName} w-full`}>
                      <SelectValue placeholder="Pilih tipe" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent align="start">
                    {articleTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Nama</FormLabel>
              <FormControl>
                <Input
                  placeholder="Room Charge"
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
          name="defaultPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Default Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  {...field}
                  value={field.value ?? ""}
                  className={inputClassName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                : "Tambah Article"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
