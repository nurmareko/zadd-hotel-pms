"use client";

import { RoomStatus } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
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
import { createRoom, updateRoom } from "./actions";
import {
  roomStatuses,
  RoomCreateSchema,
  RoomUpdateSchema,
  type RoomStatusValue,
} from "./schema";

export type RoomTypeOption = {
  id: number;
  code: string;
  name: string;
  baseRate?: string;
};

type RoomFormDefaultValues = {
  id: number;
  number: string;
  floor: number;
  roomTypeId: number;
  status: RoomStatus;
};

type RoomFormInput = {
  id?: number;
  number: string;
  floor: number | string;
  roomTypeId: number | string;
  status: RoomStatusValue;
};

type RoomFormProps = {
  defaultValues?: RoomFormDefaultValues;
  roomTypes: RoomTypeOption[];
  onCancel: () => void;
  onSaved: () => void;
};

function emptyValues(roomTypes: RoomTypeOption[]): RoomFormInput {
  return {
    number: "",
    floor: "",
    roomTypeId: roomTypes[0]?.id ?? "",
    status: RoomStatus.VC,
  };
}

function isRoomStatus(value: unknown): value is RoomStatusValue {
  return roomStatuses.some((status) => status === value);
}

const inputClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const labelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.06em]";

const buttonClassName = "h-9 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground";

const primaryButtonClassName = "h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90";

export function RoomForm({
  defaultValues,
  roomTypes,
  onCancel,
  onSaved,
}: RoomFormProps) {
  const isEditing = Boolean(defaultValues);
  const blankValues = emptyValues(roomTypes);
  const roomTypeItems = useMemo(
    () =>
      roomTypes.map((roomType) => ({
        label: `${roomType.code} - ${roomType.name}`,
        value: String(roomType.id),
      })),
    [roomTypes],
  );
  const form = useForm<RoomFormInput>({
    resolver: zodResolver(
      isEditing ? RoomUpdateSchema : RoomCreateSchema,
    ) as Resolver<RoomFormInput>,
    defaultValues: defaultValues ?? blankValues,
  });
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  function onInvalid() {
    focusFirstFormError(formElement);
  }

  async function onSubmit(values: RoomFormInput) {
    const result = isEditing
      ? await updateRoom({ ...values, id: defaultValues?.id })
      : await createRoom(values);

    if (result.ok) {
      toast.success(isEditing ? "Kamar diperbarui" : "Kamar dibuat");
      form.reset(blankValues);
      onSaved();
      return;
    }

    if (result.field) {
      form.setError(
        result.field as FieldPath<RoomFormInput>,
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
                <FormLabel className={labelClassName}>Nomor Kamar</FormLabel>
                <FormControl>
                  <Input placeholder="101" {...field} className={inputClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="floor"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClassName}>Lantai</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="1"
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
          name="roomTypeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClassName}>Tipe Kamar</FormLabel>
              <Select
                items={roomTypeItems}
                value={field.value ? String(field.value) : null}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    field.onChange(value);
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger className={`${inputClassName} w-full`}>
                    <SelectValue placeholder="Pilih tipe kamar" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent align="start">
                  {roomTypes.map((roomType) => (
                    <SelectItem key={roomType.id} value={String(roomType.id)}>
                      {roomType.code} - {roomType.name}
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
                value={field.value}
                onValueChange={(value) => {
                  if (isRoomStatus(value)) {
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
                  {roomStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
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
            disabled={form.formState.isSubmitting || roomTypes.length === 0}
          >
            {form.formState.isSubmitting
              ? "Menyimpan..."
              : isEditing
                ? "Simpan Perubahan"
                : "Tambah Kamar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
