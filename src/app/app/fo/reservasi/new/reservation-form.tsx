"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, formatISO, parseISO } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { toast } from "sonner";

import { consoleButtonClassName } from "@/components/console-button";
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
import {
  FO_RESERVASI_VIEW_PATHS,
  type FoReservasiView,
} from "@/lib/nav-preferences";
import { createReservation, updateReservation } from "./actions";
import {
  createReservationSchema,
  type CreateReservationInput,
} from "./schema";

type RoomTypeOption = {
  id: number;
  code: string;
  name: string;
  capacity: number;
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
  mode?: "create" | "edit" | "view";
  reservationId?: number;
  createOrigin?: FoReservasiView;
  returnHref?: string;
  submitLabel?: string;
  viewFooterActions?: ReactNode;
};

// scroll-m keeps a focused invalid field clear of the pinned action bar
// (bottom) and the sticky mobile top bar when RHF auto-focuses it on submit.
const fieldScrollMarginClassName = "scroll-mt-24 scroll-mb-40";
const fieldClassName = `h-9 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const textareaClassName = `min-h-20 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const selectClassName = `h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${fieldScrollMarginClassName}`;
const sectionTitleClassName =
  "mb-4 text-sm font-semibold tracking-tight text-slate-900";

const reservationTypeOptions = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "COMPANY", label: "Company" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "OTA", label: "Online Travel Agent" },
  { value: "WALK_IN", label: "Walk-in" },
] as const;

const arrangementTypeOptions = [
  { value: "RO", label: "RO (Room Only)" },
  { value: "RB", label: "RB (Room + Breakfast)" },
  { value: "FBM", label: "FBM (Full Board Meeting)" },
] as const;

const arrangementHints: Partial<Record<string, string>> = {
  RB: "Termasuk: Breakfast",
  FBM: "Termasuk: Breakfast, Coffee Break, Lunch, Dinner",
};

function dayAfter(dateValue: string) {
  const parsed = parseISO(dateValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return formatISO(addDays(parsed, 1), { representation: "date" });
}

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
      className={`flex items-center justify-between py-1.5 ${
        strong ? "text-base font-semibold" : "text-sm"
      }`}
    >
      <span className={strong ? "text-slate-900" : "text-slate-500"}>
        {label}
      </span>
      <span className="text-right font-medium text-slate-900">
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
  mode = "create",
  reservationId,
  createOrigin = "list",
  returnHref = FO_RESERVASI_VIEW_PATHS.list,
  submitLabel = "Simpan Reservasi",
  viewFooterActions,
}: ReservationFormProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const hasMountedRoomTypeValidation = useRef(false);
  const isViewMode = mode === "view";
  const reservationSchema = useMemo(
    () => createReservationSchema(roomTypes),
    [roomTypes],
  );
  const form = useForm<CreateReservationInput>({
    resolver: zodResolver(reservationSchema) as unknown as Resolver<
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
    arrangementTypeValue,
    adultsValue,
    childrenValue,
  ] = useWatch({
    control: form.control,
    name: [
      "roomTypeId",
      "roomId",
      "arrivalDate",
      "departureDate",
      "deposit",
      "arrangementType",
      "adults",
      "children",
    ],
  });
  const selectedRoomTypeId = Number(roomTypeIdValue || 0);
  const selectedRoomId = Number(roomIdValue || 0);
  const totalGuests = Number(adultsValue || 0) + Number(childrenValue || 0);

  const selectedRoomType = roomTypes.find(
    (roomType) => roomType.id === selectedRoomTypeId,
  );
  const nights = nightsBetween(arrivalDate, departureDate);
  const minDeparture = arrivalDate ? dayAfter(arrivalDate) : undefined;
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
    if (isViewMode) {
      return;
    }

    if (!selectedRoomId) {
      return;
    }

    const selectedRoom = roomOptions.find((room) => room.id === selectedRoomId);

    if (!selectedRoom || !selectedRoom.isAvailable) {
      form.setValue("roomId", "", { shouldValidate: true });
    }
  }, [form, isViewMode, roomOptions, selectedRoomId]);

  useEffect(() => {
    if (isViewMode) {
      return;
    }

    if (!hasMountedRoomTypeValidation.current) {
      hasMountedRoomTypeValidation.current = true;
      return;
    }

    void form.trigger(["adults", "children", "roomTypeId"]);
  }, [adultsValue, childrenValue, form, isViewMode, selectedRoomTypeId]);

  const availableRoomCount = roomOptions.filter(
    (room) => room.isAvailable,
  ).length;
  const { errors, isSubmitting, submitCount } = form.formState;
  const hasBlockingErrors = submitCount > 0 && Object.keys(errors).length > 0;
  const estimatedTotal =
    rateAmount && nights ? formatIDR(rateAmount * nights) : "-";
  const showFooter = !isViewMode || Boolean(viewFooterActions);

  async function onSubmit() {
    if (isViewMode) {
      return;
    }

    setActionError(null);
    const result =
      mode === "edit" && reservationId
        ? await updateReservation(reservationId, form.getValues())
        : await createReservation(form.getValues(), createOrigin);

    if (!result.ok) {
      const message = resultErrorMessage(result.error);

      if (result.field) {
        form.setError(
          result.field as FieldPath<CreateReservationInput>,
          { type: "server", message },
          { shouldFocus: true },
        );
      }

      setActionError(message);
      toast.error(message);
    }
  }

  return (
    <Form {...form}>
      <form
        id="reservation-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-sm font-semibold text-slate-700">
              Formulir Reservasi
            </span>
            <span className="text-xs text-slate-500 num">
              {nights > 0
                ? `${arrivalDate} → ${departureDate} · Lama menginap: ${nights} malam`
                : "Pilih tanggal menginap"}
            </span>
          </div>
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
                      <Input
                        className={fieldClassName}
                        readOnly={isViewMode}
                        {...field}
                      />
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
                      <Input
                        className={fieldClassName}
                        readOnly={isViewMode}
                        {...field}
                      />
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
                      <Input
                        className={fieldClassName}
                        readOnly={isViewMode}
                        {...field}
                      />
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
                        readOnly={isViewMode}
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
                      <Input
                        className={fieldClassName}
                        readOnly={isViewMode}
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
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Textarea
                          className={textareaClassName}
                          readOnly={isViewMode}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h2 className={sectionTitleClassName}>Detail Reservasi</h2>
              <div className="grid gap-3.5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="reservationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe Reservasi</FormLabel>
                      <FormControl>
                        <select
                          className={selectClassName}
                          disabled={isViewMode}
                          {...field}
                        >
                          {reservationTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
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
                  name="arrivalDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrival</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className={fieldClassName}
                          readOnly={isViewMode}
                          {...field}
                          onChange={(event) => {
                            const nextArrival = event.target.value;
                            field.onChange(nextArrival);

                            if (isViewMode || !nextArrival) {
                              return;
                            }

                            const currentDeparture =
                              form.getValues("departureDate");

                            if (
                              !currentDeparture ||
                              currentDeparture <= nextArrival
                            ) {
                              const bumped = dayAfter(nextArrival);

                              if (bumped) {
                                form.setValue("departureDate", bumped, {
                                  shouldValidate: true,
                                });
                              }
                            }
                          }}
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
                          readOnly={isViewMode}
                          min={minDeparture}
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
                          disabled={isViewMode}
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
                              {roomType.capacity} pax -{" "}
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
                          disabled={isViewMode || !selectedRoomTypeId}
                          {...field}
                        >
                          <option value="">Belum dialokasikan</option>
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
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    Jumlah Tamu
                    {selectedRoomType ? (
                      <span className="ml-2 font-normal text-slate-500">
                        {totalGuests || 0}/{selectedRoomType.capacity} pax
                      </span>
                    ) : null}
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
                              readOnly={isViewMode}
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
                              readOnly={isViewMode}
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
                  name="arrangementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe Arrangement</FormLabel>
                      <FormControl>
                        <select
                          className={selectClassName}
                          disabled={isViewMode}
                          {...field}
                        >
                          {arrangementTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      {arrangementHints[arrangementTypeValue] ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {arrangementHints[arrangementTypeValue]}
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          readOnly={isViewMode}
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
                            readOnly={isViewMode}
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

          </div>
        </div>

        {/* lg offset clears the sticky mobile top bar on coarse-pointer
            tablets; desktop (fine pointer) has no top bar, so hug the top. */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[4.75rem] desktop:top-5">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
              {"Ringkasan Tarif"}
            </div>
            <div className="p-5">
              <SummaryRow
                label="Tipe"
                value={selectedRoomType?.name ?? "-"}
              />
              <SummaryRow
                label="Rate / malam"
                value={rateAmount ? formatIDR(rateAmount) : "-"}
              />
              <SummaryRow label="Jumlah malam" value={String(nights)} />
              <div className="my-3 border-t border-slate-100" />
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
              <div className="my-3 border-t border-slate-100" />
              <SummaryRow
                label="Estimasi tagihan"
                value={
                  rateAmount && nights ? formatIDR(rateAmount * nights) : "-"
                }
                strong
              />
              <p className="mt-2 text-xs leading-4 text-slate-500">
                Pajak dan service charge akan dihitung saat check-out.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
              {"Ketersediaan"}
            </div>
            <div className="p-5 text-sm">
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 border border-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>
                  {selectedRoomType
                    ? `${availableRoomCount} kamar ${selectedRoomType.name} tersedia`
                    : "Pilih tipe kamar"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-4 text-slate-500">
                Reservasi dapat dibuat tanpa kamar fisik; kamar wajib dipilih
                saat check-in.
              </p>
            </div>
          </section>

        </aside>
        </div>

        {showFooter ? (
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 desktop:bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur">
              <div className="min-w-0 text-sm">
                {actionError ? (
                  <p className="font-medium text-red-600">{actionError}</p>
                ) : hasBlockingErrors ? (
                  <p className="font-medium text-red-600">
                    Periksa kembali isian yang ditandai merah.
                  </p>
                ) : (
                  <p className="text-slate-500 num">
                    <span className="font-semibold text-slate-900">
                      {nights} malam
                    </span>
                    {" · Estimasi tagihan "}
                    <span className="font-semibold text-slate-900">
                      {estimatedTotal}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isViewMode ? (
                  viewFooterActions
                ) : (
                  <>
                    <Link
                      href={returnHref}
                      className={consoleButtonClassName("secondary")}
                    >
                      Batal
                    </Link>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={consoleButtonClassName(
                        "primary",
                        "disabled:cursor-wait disabled:opacity-70",
                      )}
                    >
                      {isSubmitting ? "Menyimpan..." : submitLabel}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </Form>
  );
}
