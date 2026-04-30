"use client";

import { RoomStatus } from "@prisma/client";
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

export function RoomForm({
  defaultValues,
  roomTypes,
  onCancel,
  onSaved,
}: RoomFormProps) {
  const isEditing = Boolean(defaultValues);
  const blankValues = emptyValues(roomTypes);
  const form = useForm<RoomFormInput>({
    resolver: zodResolver(
      isEditing ? RoomUpdateSchema : RoomCreateSchema,
    ) as Resolver<RoomFormInput>,
    defaultValues: defaultValues ?? blankValues,
  });

  async function onSubmit(values: RoomFormInput) {
    const result = isEditing
      ? await updateRoom({ ...values, id: defaultValues?.id })
      : await createRoom(values);

    if (result.ok) {
      toast.success(isEditing ? "Room updated" : "Room created");
      form.reset(blankValues);
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
          name="number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number</FormLabel>
              <FormControl>
                <Input placeholder="101" {...field} />
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
              <FormLabel>Floor</FormLabel>
              <FormControl>
                <Input type="number" step={1} placeholder="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="roomTypeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Room Type</FormLabel>
              <Select
                value={field.value ? String(field.value) : null}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    field.onChange(value);
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select room type" />
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
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (isRoomStatus(value)) {
                    field.onChange(value);
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
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

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || roomTypes.length === 0}
          >
            {form.formState.isSubmitting
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Room"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
