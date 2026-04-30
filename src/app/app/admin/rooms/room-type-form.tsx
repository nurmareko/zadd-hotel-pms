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
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input placeholder="DLX" {...field} />
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
                <Input placeholder="Deluxe Room" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional room type notes"
                  {...field}
                  value={field.value ?? ""}
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
                <FormLabel>Capacity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="2"
                    {...field}
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
                <FormLabel>Base Rate</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="750000"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Room Type"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
