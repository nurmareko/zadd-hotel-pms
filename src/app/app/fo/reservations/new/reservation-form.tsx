"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
const sectionTitleClassName =
  "mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500";

function nightsBetween(arrivalDate: string, departureDate: string) {
  const arrival = new Date(`${arrivalDate}T00:00:00Z`);
  const departure = new Date(`${departureDate}T00:00:00Z`);

  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((departure.getTime() - arrival.getTime()) / 86_400_000),
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${
        strong ? "text-[14px] font-semibold" : "text-[13px]"
      }`}
    >
      <span className={strong ? "text-console-ink" : "text-slate-500"}>
        {label}
      </span>
      <span className="num text-right font-medium text-console-ink">
        {value}
      </span>
    </div>
  );
}

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

  const [
    roomTypeIdValue,
    roomIdValue,
    arrivalDate,
    departureDate,
    depositValue,
  ] = useWatch({
    control: form.control,
    name: ["roomTypeId", "roomId", "arrivalDate", "departureDate", "deposit"],
  });
  const selectedRoomTypeId = Number(roomTypeIdValue || 0);
  const selectedRoomId = Number(roomIdValue || 0);

  const selectedRoomType = roomTypes.find(
    (roomType) => roomType.id === selectedRoomTypeId,
  );
  const nights = nightsBetween(arrivalDate, departureDate);
  const rateAmount = selectedRoomType ? Number(selectedRoomType.baseRate) : 0;
  const depositAmount = Number(depositValue || 0);

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

  const availableRoomCount = roomOptions.filter(
    (room) => room.isAvailable,
  ).length;

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
      <form
        id="reservation-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="border border-console-border bg-console-surface">
          <div className="p-5">
            <h2 className={sectionTitleClassName}>Data Tamu</h2>
            <div className="grid gap-3.5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
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
                    <FormLabel>Nomor Identitas</FormLabel>
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
                    <FormLabel>Telepon</FormLabel>
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
                      <Input
                        type="email"
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
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kewarganegaraan</FormLabel>
                    <FormControl>
                      <Input className={fieldClassName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Textarea className={textareaClassName} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="mt-5 border-t border-console-border-soft pt-5">
              <h2 className={sectionTitleClassName}>Detail Reservasi</h2>
              <div className="grid gap-3.5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="arrivalDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrival</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
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
                  name="departureDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departure</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
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
                  name="roomTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe Kamar</FormLabel>
                      <FormControl>
                        <select
                          className={selectClassName}
                          {...field}
                          onChange={(event) => {
                            field.onChange(event.target.value);
                            form.setValue("roomId", "", {
                              shouldValidate: true,
                            });
                          }}
                        >
                          <option value="">Pilih tipe kamar</option>
                          {roomTypes.map((roomType) => (
                            <option
                              key={roomType.id}
                              value={String(roomType.id)}
                            >
                              {roomType.code} - {roomType.name} -{" "}
                              {formatIDR(roomType.baseRate)}/mlm
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
                      <FormLabel>Kamar</FormLabel>
                      <FormControl>
                        <select
                          className={selectClassName}
                          disabled={!selectedRoomTypeId}
                          {...field}
                        >
                          <option value="">Pilih kamar</option>
                          {roomOptions.map((room) => (
                            <option
                              key={room.id}
                              value={String(room.id)}
                              disabled={!room.isAvailable}
                            >
                              {room.number} / Lantai {room.floor}
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
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Jumlah Tamu
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="adults"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="Dewasa"
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
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              placeholder="Anak"
                              className={fieldClassName}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                        <FormLabel>Catatan</FormLabel>
                        <FormControl>
                          <Textarea
                            className={textareaClassName}
                            placeholder="Permintaan khusus, late arrival, atau catatan reservasi."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {actionError ? (
              <p className="mt-4 border border-red-500 bg-status-od-bg px-3 py-2 text-[12px] text-status-od-fg">
                {actionError}
              </p>
            ) : null}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Ringkasan Tarif"}
            </div>
            <div className="p-3.5">
              <SummaryRow
                label="Tipe"
                value={selectedRoomType?.name ?? "-"}
              />
              <SummaryRow
                label="Rate / malam"
                value={rateAmount ? formatIDR(rateAmount) : "-"}
              />
              <SummaryRow label="Jumlah malam" value={String(nights)} />
              <div className="my-2 border-t border-console-border-soft" />
              <SummaryRow
                label="Subtotal kamar"
                value={
                  rateAmount && nights ? formatIDR(rateAmount * nights) : "-"
                }
              />
              <SummaryRow
                label="Deposit"
                value={formatIDR(
                  Number.isFinite(depositAmount) ? depositAmount : 0,
                )}
              />
              <div className="my-2 border-t border-console-border-soft" />
              <SummaryRow
                label="Estimasi tagihan"
                value={
                  rateAmount && nights ? formatIDR(rateAmount * nights) : "-"
                }
                strong
              />
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Pajak dan service charge akan dihitung saat check-out.
              </p>
            </div>
          </section>

          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Ketersediaan"}
            </div>
            <div className="p-3.5 text-[13px]">
              <div className="flex items-center gap-2 bg-status-vc-bg px-2.5 py-2 font-medium text-status-vc-fg">
                <span className="h-2 w-2 bg-status-vc-pip" aria-hidden="true" />
                <span>
                  {selectedRoomType
                    ? `${availableRoomCount} kamar ${selectedRoomType.name} tersedia`
                    : "Pilih tipe kamar"}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Pilih kamar fisik untuk mengunci ketersediaan reservasi.
              </p>
            </div>
          </section>
        </aside>
      </form>
    </Form>
  );
}
