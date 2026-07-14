"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, formatISO, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { toast } from "sonner";

import { PinnedActionFooter } from "@/components/pinned-action-footer";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { ARRANGEMENT_INCLUSION_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import { formatDateID, formatIDR } from "@/lib/format";
import { dateOnlyRange } from "@/lib/stay-date-range";
import {
  FO_RESERVASI_VIEW_PATHS,
  type FoReservasiView,
} from "@/lib/nav-preferences";
import { createReservation, updateReservation } from "./actions";
import {
  createUnifiedReservationSchema,
  type CreateReservationInput,
  type UnifiedReservationInput,
} from "./schema";

type RoomTypeOption = {
  id: number;
  code: string;
  name: string;
  capacity: number;
  baseRate: string;
  nightlyRateQuote: string;
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

type InclusionArticle = {
  code: string;
  name: string;
};

type ReservationFormProps = {
  defaultValues: CreateReservationInput;
  roomTypes: RoomTypeOption[];
  rooms: RoomOption[];
  activeReservations: ActiveReservation[];
  inclusionArticles?: InclusionArticle[];
  mode?: "create" | "edit" | "view";
  reservationId?: number;
  createOrigin?: FoReservasiView;
  returnHref?: string;
  submitLabel?: string;
  viewFooterActions?: ReactNode;
  readOnlyStayTotal?: string;
  readOnlyNightlySchedule?: Array<{ date: string; rateAmount: string }>;
};

const fieldScrollMarginClassName = "scroll-mt-24 scroll-mb-40";
const fieldClassName = `h-11 desktop:h-10 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const textareaClassName = `min-h-20 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const selectClassName = `h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const sectionTitleClassName =
  "mb-4 text-sm font-semibold tracking-tight text-slate-900";
const iconButtonClassName =
  "inline-flex size-11 desktop:size-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"

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
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 wrap-break-word whitespace-pre-wrap text-sm font-medium text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}

function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
        {title}
      </h2>
      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function ArrangementInclusionHint({
  arrangementType,
  articleNamesByCode,
}: {
  arrangementType: keyof typeof ARRANGEMENT_INCLUSION_ARTICLE_CODES;
  articleNamesByCode: Map<string, string>;
}) {
  const inclusionCodes = ARRANGEMENT_INCLUSION_ARTICLE_CODES[arrangementType];

  if (inclusionCodes.length === 0) {
    return <p className="text-xs text-slate-500">Tanpa inklusi makan.</p>;
  }

  return (
    <p className="text-xs text-slate-500">
      <span className="font-medium text-slate-600">Termasuk:</span>{" "}
      {inclusionCodes
        .map((code) => articleNamesByCode.get(code) ?? code)
        .join(", ")}
      .
    </p>
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

function unifiedDefaultValues(
  defaultValues: CreateReservationInput,
): UnifiedReservationInput {
  return {
    fullName: defaultValues.fullName,
    idNumber: defaultValues.idNumber,
    phone: defaultValues.phone,
    email: defaultValues.email,
    address: defaultValues.address,
    nationality: defaultValues.nationality,
    arrivalDate: defaultValues.arrivalDate,
    departureDate: defaultValues.departureDate,
    reservationType: defaultValues.reservationType,
    arrangementType: defaultValues.arrangementType,
    deposit: defaultValues.deposit,
    notes: defaultValues.notes,
    rooms: [
      {
        roomTypeId: defaultValues.roomTypeId,
        roomId: defaultValues.roomId,
        adults: defaultValues.adults,
        children: defaultValues.children,
      },
    ],
  };
}

function firstRoomReservationValues(
  values: UnifiedReservationInput,
): CreateReservationInput {
  const firstRoom = values.rooms[0] ?? {
    roomTypeId: "",
    roomId: "",
    adults: "1",
    children: "0",
  };

  return {
    fullName: values.fullName,
    idNumber: values.idNumber,
    phone: values.phone,
    email: values.email,
    address: values.address,
    nationality: values.nationality,
    roomTypeId: firstRoom.roomTypeId,
    roomId: firstRoom.roomId,
    arrivalDate: values.arrivalDate,
    departureDate: values.departureDate,
    adults: firstRoom.adults,
    children: firstRoom.children,
    reservationType: values.reservationType,
    arrangementType: values.arrangementType,
    deposit: values.deposit,
    notes: values.notes,
  };
}

export function ReservationForm({
  defaultValues,
  roomTypes,
  rooms,
  activeReservations,
  inclusionArticles = [],
  mode = "create",
  reservationId,
  createOrigin = "list",
  returnHref = FO_RESERVASI_VIEW_PATHS.list,
  submitLabel = "Simpan Reservasi",
  viewFooterActions,
  readOnlyStayTotal,
  readOnlyNightlySchedule = [],
}: ReservationFormProps) {
  const hasMountedRoomValidation = useRef(false);
  const isViewMode = mode === "view";
  const isCreateMode = mode === "create";
  const reservationSchema = useMemo(
    () => createUnifiedReservationSchema(roomTypes),
    [roomTypes],
  );
  const form = useForm<UnifiedReservationInput>({
    resolver: zodResolver(reservationSchema) as unknown as Resolver<
      UnifiedReservationInput
    >,
    mode: "onChange",
    defaultValues: unifiedDefaultValues(defaultValues),
  });
  const roomsFieldArray = useFieldArray({
    control: form.control,
    name: "rooms",
  });
  const [arrivalDate, departureDate, depositValue, arrangementTypeValue, roomRows] =
    useWatch({
      control: form.control,
      name: ["arrivalDate", "departureDate", "deposit", "arrangementType", "rooms"],
    });
  const watchedRoomRows = useMemo(() => roomRows ?? [], [roomRows]);
  const articleNamesByCode = useMemo(
    () => new Map(inclusionArticles.map((article) => [article.code, article.name])),
    [inclusionArticles],
  );
  const selectedRoomIds = useMemo(
    () =>
      watchedRoomRows
        .map((room) => Number(room.roomId || 0))
        .filter((roomId) => roomId > 0),
    [watchedRoomRows],
  );
  const nights = nightsBetween(arrivalDate, departureDate);
  const minDeparture = arrivalDate ? dayAfter(arrivalDate) : undefined;
  const depositAmount = Number(depositValue || 0);
  const quotedStayDates = useMemo(
    () => dateOnlyRange(arrivalDate, departureDate),
    [arrivalDate, departureDate],
  );
  const quotedRoomSubtotal = watchedRoomRows.reduce((total, room) => {
    const roomType = roomTypes.find(
      (option) => option.id === Number(room.roomTypeId || 0),
    );
    const nightlyQuote = roomType
      ? quotedStayDates.map((date) => ({
          date,
          rateAmount: roomType.nightlyRateQuote,
        }))
      : [];

    return total + nightlyQuote.reduce((sum, night) => sum + Number(night.rateAmount), 0);
  }, 0);
  const roomSubtotal =
    !isCreateMode && readOnlyStayTotal
      ? Number(readOnlyStayTotal)
      : quotedRoomSubtotal;
  const firstSelectedRoomTypeId = Number(watchedRoomRows[0]?.roomTypeId || 0);
  const firstRoomOptions = getRoomOptions({
    activeReservations,
    allRooms: rooms,
    arrivalDate,
    departureDate,
    roomTypeId: firstSelectedRoomTypeId,
    selectedRoomIds,
    currentRoomId: Number(watchedRoomRows[0]?.roomId || 0),
  });
  const availableRoomCount = firstRoomOptions.filter(
    (room) => room.isAvailable,
  ).length;
  const { errors, isSubmitting, submitCount } = form.formState;
  const hasBlockingErrors = submitCount > 0 && Object.keys(errors).length > 0;
  const estimatedTotal = roomSubtotal ? formatIDR(roomSubtotal) : "-";
  const showFooter = !isViewMode || Boolean(viewFooterActions);

  useEffect(() => {
    if (isViewMode) {
      return;
    }

    watchedRoomRows.forEach((room, index) => {
      const selectedRoomId = Number(room.roomId || 0);

      if (!selectedRoomId) {
        return;
      }

      const rowOptions = getRoomOptions({
        activeReservations,
        allRooms: rooms,
        arrivalDate,
        departureDate,
        roomTypeId: Number(room.roomTypeId || 0),
        selectedRoomIds,
        currentRoomId: selectedRoomId,
      });
      const selectedRoom = rowOptions.find(
        (option) => option.id === selectedRoomId,
      );

      if (!selectedRoom || !selectedRoom.isAvailable) {
        form.setValue(`rooms.${index}.roomId`, "", { shouldValidate: true });
      }
    });
  }, [
    activeReservations,
    arrivalDate,
    departureDate,
    form,
    isViewMode,
    rooms,
    selectedRoomIds,
    watchedRoomRows,
  ]);

  useEffect(() => {
    if (isViewMode) {
      return;
    }

    if (!hasMountedRoomValidation.current) {
      hasMountedRoomValidation.current = true;
      return;
    }

    void form.trigger("rooms");
  }, [form, isViewMode, watchedRoomRows]);

  async function onSubmit() {
    if (isViewMode) {
      return;
    }

    const values = form.getValues();
    const result =
      mode === "edit" && reservationId
        ? await updateReservation(reservationId, firstRoomReservationValues(values))
        : await createReservation(values, createOrigin);

    if (!result.ok) {
      const message = resultErrorMessage(result.error);

      if (result.field) {
        const field =
          result.field === "roomTypeId"
            ? "rooms.0.roomTypeId"
            : result.field === "roomId"
              ? "rooms.0.roomId"
              : result.field;

        form.setError(
          field as FieldPath<UnifiedReservationInput>,
          { type: "server", message },
          { shouldFocus: true },
        );
      }

      toast.error(message);
    }
  }

  if (isViewMode) {
    const roomValue = watchedRoomRows[0];
    const roomType = roomTypes.find(
      (option) => option.id === Number(roomValue?.roomTypeId || 0),
    );
    const allocatedRoom = rooms.find(
      (option) => option.id === Number(roomValue?.roomId || 0),
    );
    const reservationTypeLabel =
      reservationTypeOptions.find(
        (option) => option.value === defaultValues.reservationType,
      )?.label ?? defaultValues.reservationType;
    const arrangementTypeLabel =
      arrangementTypeOptions.find(
        (option) => option.value === defaultValues.arrangementType,
      )?.label ?? defaultValues.arrangementType;
    const totalDeposit = Number.isFinite(depositAmount)
      ? depositAmount * watchedRoomRows.length
      : 0;

    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <ReadOnlySection title="Data Tamu">
            <ReadOnlyField label="Nama Lengkap" value={defaultValues.fullName} />
            <ReadOnlyField
              label="Nomor Identitas"
              value={defaultValues.idNumber}
            />
            <ReadOnlyField label="Telepon" value={defaultValues.phone} />
            <ReadOnlyField label="Email" value={defaultValues.email} />
            <ReadOnlyField
              label="Kewarganegaraan"
              value={defaultValues.nationality}
            />
            <ReadOnlyField
              label="Alamat"
              value={defaultValues.address}
              wide
            />
            <ReadOnlyField
              label="Catatan"
              value={defaultValues.notes}
              wide
            />
          </ReadOnlySection>

          <ReadOnlySection title="Masa Menginap">
            <ReadOnlyField
              label="Tipe Reservasi"
              value={reservationTypeLabel}
            />
            <ReadOnlyField
              label="Tipe Arrangement"
              value={arrangementTypeLabel}
            />
            <ReadOnlyField
              label="Check-in"
              value={defaultValues.arrivalDate}
            />
            <ReadOnlyField
              label="Check-out"
              value={defaultValues.departureDate}
            />
            <ReadOnlyField
              label="Durasi"
              value={`${nights} malam`}
            />
          </ReadOnlySection>

          <ReadOnlySection title="Kamar">
            <ReadOnlyField
              label="Tipe Kamar"
              value={
                roomType ? `${roomType.code} — ${roomType.name}` : "Belum dipilih"
              }
            />
            <ReadOnlyField
              label="Nomor Kamar"
              value={
                allocatedRoom
                  ? `${allocatedRoom.number} · Lantai ${allocatedRoom.floor}`
                  : "Belum dialokasikan"
              }
            />
            <ReadOnlyField
              label="Dewasa"
              value={roomValue?.adults ?? defaultValues.adults}
            />
            <ReadOnlyField
              label="Anak"
              value={roomValue?.children ?? defaultValues.children}
            />
            <ReadOnlyField
              label="Kapasitas Tipe"
              value={roomType ? `${roomType.capacity} tamu` : "—"}
            />
          </ReadOnlySection>

          <ReadOnlySection title="Informasi Finansial">
            <ReadOnlyField
              label="Total Menginap"
              value={
                readOnlyStayTotal ? formatIDR(readOnlyStayTotal) : "—"
              }
            />
            <ReadOnlyField label="Deposit" value={formatIDR(totalDeposit)} />
          </ReadOnlySection>

          <ReadOnlySection title="Rincian Tarif per Malam">
            {readOnlyNightlySchedule.length > 0 ? (
              readOnlyNightlySchedule.map((night) => (
                <ReadOnlyField
                  key={night.date}
                  label={formatDateID(new Date(`${night.date}T00:00:00.000Z`))}
                  value={formatIDR(night.rateAmount)}
                />
              ))
            ) : (
              <ReadOnlyField
                label="Jadwal malam"
                value="Snapshot malam tidak tersedia; total menggunakan tarif flat."
                wide
              />
            )}
          </ReadOnlySection>
        </div>

        {showFooter ? (
          <PinnedActionFooter
            hint={
              <p className="text-slate-500">
                Data reservasi ditampilkan dalam mode lihat.
              </p>
            }
            actions={viewFooterActions}
          />
        ) : null}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        id="reservation-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <span className="text-sm font-semibold text-slate-700">
                Formulir Reservasi
              </span>
              <span className="text-xs text-slate-500 num">
                {nights > 0
                  ? `${arrivalDate} -> ${departureDate} · ${watchedRoomRows.length} kamar · ${nights} malam`
                  : "Pilih tanggal menginap"}
              </span>
            </div>

            <div className="flex flex-col p-5">
              <section className="order-2 mt-6 border-t border-slate-100 pt-6">
                <h2 className={sectionTitleClassName}>Data Tamu</h2>
                <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
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

                  <div className="md:col-span-2 xl:col-span-4">
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

                  <div className="md:col-span-2 xl:col-span-4">
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
              </section>

              <section className="order-1 rounded-lg bg-slate-50/80 p-4 ring-1 ring-slate-100">
                <h2 className={sectionTitleClassName}>Detail Reservasi</h2>
                <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deposit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Deposit{watchedRoomRows.length > 1 ? " per kamar" : ""}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
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
              </section>

              <section className="order-3 mt-6 border-t border-slate-100 pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className={sectionTitleClassName}>Kamar</h2>
                  {isCreateMode ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        roomsFieldArray.append({
                          roomTypeId: "",
                          roomId: "",
                          adults: "1",
                          children: "0",
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Tambah kamar
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  {roomsFieldArray.fields.map((roomField, index) => {
                    const rowValue = watchedRoomRows[index];
                    const rowRoomTypeId = Number(rowValue?.roomTypeId || 0);
                    const rowRoomId = Number(rowValue?.roomId || 0);
                    const rowRoomType = roomTypes.find(
                      (roomType) => roomType.id === rowRoomTypeId,
                    );
                    const rowTotalGuests =
                      Number(rowValue?.adults || 0) +
                      Number(rowValue?.children || 0);
                    const rowRoomOptions = getRoomOptions({
                      activeReservations,
                      allRooms: rooms,
                      arrivalDate,
                      departureDate,
                      roomTypeId: rowRoomTypeId,
                      selectedRoomIds,
                      currentRoomId: rowRoomId,
                    });

                    return (
                      <div
                        key={roomField.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-800">
                            Kamar {index + 1}
                            {rowRoomType ? (
                              <span className="ml-2 text-xs font-normal text-slate-500">
                                {rowTotalGuests || 0}/{rowRoomType.capacity} pax
                              </span>
                            ) : null}
                          </div>
                          {isCreateMode ? (
                            <button
                              type="button"
                              className={iconButtonClassName}
                              disabled={roomsFieldArray.fields.length <= 1}
                              aria-label={`Hapus kamar ${index + 1}`}
                              title={`Hapus kamar ${index + 1}`}
                              onClick={() => roomsFieldArray.remove(index)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>

                        <ArrangementInclusionHint
                          arrangementType={arrangementTypeValue}
                          articleNamesByCode={articleNamesByCode}
                        />

                        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-5">
                          <FormField
                            control={form.control}
                            name={`rooms.${index}.roomTypeId`}
                            render={({ field }) => (
                              <FormItem className="xl:col-span-2">
                                <FormLabel>Tipe Kamar</FormLabel>
                                <FormControl>
                                  <select
                                    className={selectClassName}
                                    disabled={isViewMode}
                                    {...field}
                                    onChange={(event) => {
                                      field.onChange(event.target.value);

                                      if (!isViewMode) {
                                        form.setValue(
                                          `rooms.${index}.roomId`,
                                          "",
                                          { shouldValidate: true },
                                        );
                                      }
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
                            name={`rooms.${index}.roomId`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Kamar</FormLabel>
                                <FormControl>
                                  <select
                                    className={selectClassName}
                                    disabled={isViewMode || !rowRoomTypeId}
                                    {...field}
                                  >
                                    <option value="">Belum dialokasikan</option>
                                    {rowRoomOptions.map((room) => (
                                      <option
                                        key={room.id}
                                        value={String(room.id)}
                                        disabled={!room.isAvailable}
                                      >
                                        {room.number} / Lantai {room.floor}
                                        {!room.isAvailable ? " / unavailable" : ""}
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
                            name={`rooms.${index}.adults`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Dewasa</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
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
                            name={`rooms.${index}.children`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Anak</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
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
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[4.75rem] desktop:top-5">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
                Ringkasan Tarif
              </div>
              <div className="p-5">
                <SummaryRow
                  label="Jumlah kamar"
                  value={String(watchedRoomRows.length)}
                />
                <SummaryRow label="Jumlah malam" value={String(nights)} />
                <SummaryRow
                  label="Subtotal kamar"
                  value={roomSubtotal ? formatIDR(roomSubtotal) : "-"}
                />
                <SummaryRow
                  label="Deposit"
                  value={formatIDR(
                    Number.isFinite(depositAmount)
                      ? depositAmount * watchedRoomRows.length
                      : 0,
                  )}
                />
                <div className="my-3 border-t border-slate-100" />
                <SummaryRow label="Estimasi tagihan" value={estimatedTotal} strong />
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
                Ketersediaan
              </div>
              <div className="p-5 text-sm">
                {firstSelectedRoomTypeId ? (
                  <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    {availableRoomCount} kamar tersedia untuk tipe pertama
                    pada periode ini.
                  </div>
                ) : (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                    Pilih tipe kamar untuk melihat ketersediaan awal.
                  </div>
                )}
                {watchedRoomRows.length > 1 ? (
                  <p className="mt-2 text-xs leading-4 text-slate-500">
                    Semua kamar dalam booking grup dibuat atau ditolak sebagai
                    satu transaksi.
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        {showFooter ? (
          <PinnedActionFooter
            hint={
              hasBlockingErrors ? (
                <p className="font-medium text-red-600">
                  Periksa kembali isian yang ditandai merah.
                </p>
              ) : (
                <p className="text-slate-500 num">
                  <span className="font-semibold text-slate-900">
                    {watchedRoomRows.length} kamar
                  </span>
                  {" · Estimasi tagihan "}
                  <span className="font-semibold text-slate-900">
                    {estimatedTotal}
                  </span>
                </p>
              )
            }
            actions={
              <>
                {viewFooterActions}
                {!isViewMode ? (
                  <>
                    <Link
                      href={returnHref}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Batal
                    </Link>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="disabled:cursor-wait disabled:opacity-70"
                    >
                      {isSubmitting ? "Menyimpan..." : submitLabel}
                    </Button>
                  </>
                ) : null}
              </>
            }
          />
        ) : null}
      </form>
    </Form>
  );
}

function getRoomOptions({
  activeReservations,
  allRooms,
  arrivalDate,
  departureDate,
  roomTypeId,
  selectedRoomIds,
  currentRoomId,
}: {
  activeReservations: ActiveReservation[];
  allRooms: RoomOption[];
  arrivalDate: string;
  departureDate: string;
  roomTypeId: number;
  selectedRoomIds: number[];
  currentRoomId: number;
}) {
  return allRooms
    .filter((room) => room.roomTypeId === roomTypeId)
    .map((room) => {
      const isOverlapping = activeReservations.some(
        (reservation) =>
          reservation.roomId === room.id &&
          overlapsStay(reservation, arrivalDate, departureDate),
      );
      const isSelectedElsewhere =
        currentRoomId !== room.id && selectedRoomIds.includes(room.id);

      return {
        ...room,
        isAvailable:
          room.status !== "OOO" && !isOverlapping && !isSelectedElsewhere,
      };
    });
}
