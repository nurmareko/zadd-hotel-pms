"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";

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
import { formatIDR } from "@/lib/format";
import { createReservation } from "./actions";
import {
  CreateReservationSchema,
  type CreateReservationInput,
} from "./schema";

type RoomTypeOption = {
  id: number;
  code: string;
  name: string;
  baseRate: string;
};

type RoomOption = {
  id: number;
  number: string;
  floor: number;
  status: string;
  roomTypeId: number;
};

type ActiveReservation = {
  id: number;
  roomId: number;
  arrivalDate: string;
  departureDate: string;
};

type ReservationFormProps = {
  defaultValues: CreateReservationInput;
  roomTypes: RoomTypeOption[];
  rooms: RoomOption[];
  activeReservations: ActiveReservation[];
};

const fieldClassName =
  "h-8 rounded-none border-console-border bg-console-surface text-[12px]";
const textareaClassName =
  "min-h-20 rounded-none border-console-border bg-console-surface text-[12px]";
const selectClassName =
  "h-8 w-full rounded-none border border-console-border bg-console-surface px-2 text-[12px] outline-none focus:border-console-ink focus:ring-3 focus:ring-slate-500/20";

function overlapsStay(
  reservation: ActiveReservation,
  arrivalDate: string,
  departureDate: string,
) {
  return (
    reservation.arrivalDate < departureDate &&
    reservation.departureDate > arrivalDate
  );
}

function resultErrorMessage(error: unknown) {
  return typeof error === "string" ? error : "Unable to create reservation";
}

export function ReservationForm({
  defaultValues,
  roomTypes,
  rooms,
  activeReservations,
}: ReservationFormProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const form = useForm<CreateReservationInput>({
    resolver: zodResolver(CreateReservationSchema) as unknown as Resolver<
      CreateReservationInput
    >,
    mode: "onChange",
    defaultValues,
  });

  const [roomTypeIdValue, roomIdValue, arrivalDate, departureDate] = useWatch({
    control: form.control,
    name: ["roomTypeId", "roomId", "arrivalDate", "departureDate"],
  });
  const selectedRoomTypeId = Number(roomTypeIdValue || 0);
  const selectedRoomId = Number(roomIdValue || 0);

  const selectedRoomType = roomTypes.find(
    (roomType) => roomType.id === selectedRoomTypeId,
  );

  const roomOptions = useMemo(() => {
    return rooms
      .filter((room) => room.roomTypeId === selectedRoomTypeId)
      .map((room) => {
        const isOverlapping = activeReservations.some(
          (reservation) =>
            reservation.roomId === room.id &&
            overlapsStay(reservation, arrivalDate, departureDate),
        );

        return {
          ...room,
          isAvailable: room.status !== "OOO" && !isOverlapping,
        };
      });
  }, [activeReservations, arrivalDate, departureDate, rooms, selectedRoomTypeId]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }

    const selectedRoom = roomOptions.find((room) => room.id === selectedRoomId);

    if (!selectedRoom || !selectedRoom.isAvailable) {
      form.setValue("roomId", "", { shouldValidate: true });
    }
  }, [form, roomOptions, selectedRoomId]);

  async function onSubmit() {
    setActionError(null);
    const result = await createReservation(form.getValues());

    if (!result.ok) {
      const message = resultErrorMessage(result.error);
      setActionError(message);
      toast.error(message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"// Guest"}
          </div>
          <div className="grid gap-3.5 p-3.5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Name</FormLabel>
                  <FormControl>
                    <Input className={fieldClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="idNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Number</FormLabel>
                  <FormControl>
                    <Input className={fieldClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input className={fieldClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" className={fieldClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality</FormLabel>
                  <FormControl>
                    <Input className={fieldClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea className={textareaClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"// Stay"}
          </div>
          <div className="grid gap-3.5 p-3.5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="arrivalDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arrival</FormLabel>
                  <FormControl>
                    <Input type="date" className={fieldClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departureDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departure</FormLabel>
                  <FormControl>
                    <Input type="date" className={fieldClassName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adults"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adults</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      className={fieldClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="children"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Children</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className={fieldClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="border border-console-border bg-console-surface">
          <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"// Room"}
          </div>
          <div className="grid gap-3.5 p-3.5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Type</FormLabel>
                  <FormControl>
                    <select
                      className={selectClassName}
                      {...field}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        form.setValue("roomId", "", { shouldValidate: true });
                      }}
                    >
                      <option value="">Select room type</option>
                      {roomTypes.map((roomType) => (
                        <option key={roomType.id} value={String(roomType.id)}>
                          {roomType.code} - {roomType.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room</FormLabel>
                  <FormControl>
                    <select
                      className={selectClassName}
                      disabled={!selectedRoomTypeId}
                      {...field}
                    >
                      <option value="">Select room</option>
                      {roomOptions.map((room) => (
                        <option
                          key={room.id}
                          value={String(room.id)}
                          disabled={!room.isAvailable}
                        >
                          {room.number} / Floor {room.floor}
                          {!room.isAvailable ? ` / unavailable` : ""}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                Rate / Night
              </div>
              <div className="mt-1 flex h-8 items-center border border-console-border bg-console-bg px-2 text-[12px] font-medium text-console-ink">
                {selectedRoomType ? formatIDR(selectedRoomType.baseRate) : "-"}
              </div>
            </div>

            <FormField
              control={form.control}
              name="deposit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      className={fieldClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea className={textareaClassName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </section>

        {actionError ? (
          <p className="border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
            {actionError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border border-console-border bg-console-surface p-3.5 sm:flex-row sm:justify-end">
          <Link
            href="/app/fo/reservations"
            className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={
              !form.formState.isValid ||
              form.formState.isSubmitting ||
              roomTypes.length === 0
            }
            className="h-8 rounded-none border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:opacity-50"
          >
            {form.formState.isSubmitting ? "Saving..." : "Buat Reservasi"}
          </button>
        </div>
      </form>
    </Form>
  );
}
