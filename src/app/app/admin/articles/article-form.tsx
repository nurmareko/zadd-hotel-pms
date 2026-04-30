"use client";

import { ArticleType } from "@prisma/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  async function onSubmit(values: ArticleFormInput) {
    const result = isEditing
      ? await updateArticle({ ...values, id: defaultValues?.id })
      : await createArticle(values);

    if (result.ok) {
      toast.success(isEditing ? "Article updated" : "Article created");
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
                <Input placeholder="ROOM" {...field} />
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
                <Input placeholder="Room Charge" {...field} />
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
              <FormLabel>Type</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (isArticleType(value)) {
                    field.onChange(value);
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
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

        <FormField
          control={form.control}
          name="defaultPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Optional"
                  {...field}
                  value={field.value ?? ""}
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
                : "Create Article"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
