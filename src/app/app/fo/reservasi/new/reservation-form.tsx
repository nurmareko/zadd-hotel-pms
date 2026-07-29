"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, formatISO, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateID, formatIDR } from "@/lib/format";
import {
  guestIdTypeLabel,
  guestIdTypeOptions,
} from "@/lib/guest-id-type";
import {
  FO_RESERVASI_VIEW_PATHS,
  type FoReservasiView,
} from "@/lib/nav-preferences";
import {
  createReservation,
  getReservationQuote,
  updateReservation,
} from "./actions";
import {
  createUnifiedEditReservationSchema,
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
  readOnlyStayTotal?: string;
  readOnlyDeposit?: string;
  readOnlyNightlySchedule?: Array<{ date: string; rateAmount: string }>;
};

const fieldScrollMarginClassName = "scroll-mt-24 scroll-mb-40";
const fieldClassName = `h-11 desktop:h-10 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const textareaClassName = `min-h-20 rounded-md border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const selectClassName = `h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${fieldScrollMarginClassName}`;
const sectionTitleClassName = "text-base font-semibold text-slate-900";
const cardClassName =
  "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm";
const cardHeaderClassName =
  "flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 desktop:px-5";
const cardContentClassName = "p-4 desktop:p-5";
const iconButtonClassName =
  "inline-flex size-11 desktop:size-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

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

const reservationTabs = [
  { value: "detail", label: "Detail" },
  { value: "inclusions", label: "Inklusi" },
  { value: "extras", label: "Extra" },
  { value: "payments", label: "Pembayaran" },
  { value: "billing", label: "Tagihan" },
] as const;

type ReservationTab = (typeof reservationTabs)[number]["value"];

function dayAfter(dateValue: string) {
  const parsed = parseISO(dateValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return formatISO(addDays(parsed, 1), { representation: "date" });
}

function pricingKey(
  arrivalDate: string,
  departureDate: string,
  roomTypeIds: string[],
) {
  return `${arrivalDate}|${departureDate}|${roomTypeIds.join(",")}`;
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



function RequiredMark() {
  return (
    <>
      <span className="text-red-500" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (wajib)</span>
    </>
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
  return typeof error === "string" ? error : "Reservasi tidak dapat dibuat";
}

function unifiedDefaultValues(
  defaultValues: CreateReservationInput,
): UnifiedReservationInput {
  return {
    fullName: defaultValues.fullName,
    idType: defaultValues.idType,
    idNumber: defaultValues.idNumber,
    phone: defaultValues.phone,
    email: defaultValues.email,
    address: defaultValues.address,
    nationality: defaultValues.nationality,
    arrivalDate: defaultValues.arrivalDate,
    departureDate: defaultValues.departureDate,
    reservationType: defaultValues.reservationType,
    arrangementType: defaultValues.arrangementType,
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
    idType: values.idType,
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
    notes: values.notes,
  };
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
  readOnlyStayTotal,
  readOnlyDeposit,
  readOnlyNightlySchedule = [],
}: ReservationFormProps) {
  const hasMountedRoomValidation = useRef(false);
  const [activeTab, setActiveTab] = useState<ReservationTab>("detail");
  const isViewMode = mode === "view";
  const isCreateMode = mode === "create";
  const reservationSchema = useMemo(
    () =>
      isCreateMode
        ? createUnifiedReservationSchema(roomTypes)
        : createUnifiedEditReservationSchema(roomTypes),
    [isCreateMode, roomTypes],
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
  const [arrivalDate, departureDate, roomRows] = useWatch({
    control: form.control,
    name: ["arrivalDate", "departureDate", "rooms"],
  });
  const watchedRoomRows = useMemo(() => roomRows ?? [], [roomRows]);
  const selectedRoomIds = useMemo(
    () =>
      watchedRoomRows
        .map((room) => Number(room.roomId || 0))
        .filter((roomId) => roomId > 0),
    [watchedRoomRows],
  );
  const nights = nightsBetween(arrivalDate, departureDate);
  const minDeparture = arrivalDate ? dayAfter(arrivalDate) : undefined;
  const roomTypeIds = useMemo(
    () => watchedRoomRows.map((room) => room.roomTypeId),
    [watchedRoomRows],
  );
  const currentPricingKey = pricingKey(
    arrivalDate,
    departureDate,
    roomTypeIds,
  );
  const initialPricingKey = pricingKey(
    defaultValues.arrivalDate,
    defaultValues.departureDate,
    [defaultValues.roomTypeId],
  );
  const pricingChanged = mode === "edit" && currentPricingKey !== initialPricingKey;
  const [resolvedQuote, setResolvedQuote] = useState<{
    key: string;
    total: number | null;
    deposits: number[];
    error: string | null;
  } | null>(null);
  const canResolveQuote =
    !isViewMode &&
    nights > 0 &&
    roomTypeIds.length > 0 &&
    roomTypeIds.every((roomTypeId) => Number(roomTypeId) > 0);

  useEffect(() => {
    if (!canResolveQuote || (mode === "edit" && !pricingChanged)) {
      return;
    }

    let ignore = false;
    const quoteKey = currentPricingKey;

    void getReservationQuote({
      roomTypeIds,
      arrivalDate,
      departureDate,
    })
      .then((result) => {
        if (ignore) {
          return;
        }

        setResolvedQuote(
          result.ok
            ? {
                key: quoteKey,
                total: Number(result.total),
                deposits: result.deposits.map(Number),
                error: null,
              }
            : { key: quoteKey, total: null, deposits: [], error: result.error },
        );
      })
      .catch(() => {
        if (!ignore) {
          setResolvedQuote({
            key: quoteKey,
            total: null,
            deposits: [],
            error: "Gagal menghitung estimasi harga.",
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [
    arrivalDate,
    canResolveQuote,
    currentPricingKey,
    departureDate,
    mode,
    pricingChanged,
    roomTypeIds,
  ]);

  const activeQuote =
    resolvedQuote?.key === currentPricingKey ? resolvedQuote : null;
  const quoteRequested =
    canResolveQuote && !(mode === "edit" && !pricingChanged);
  const isQuotePending = quoteRequested && activeQuote === null;
  const quoteError = activeQuote?.error ?? null;
  const resolvedQuoteTotal = activeQuote?.total ?? null;
  const resolvedDeposits = activeQuote?.deposits ?? [];
  const displayedDeposits =
    isViewMode || (mode === "edit" && !pricingChanged)
      ? [Number(readOnlyDeposit ?? 0)]
      : resolvedDeposits;
  const totalDeposit = displayedDeposits.reduce(
    (total, deposit) => total + deposit,
    0,
  );

  const roomSubtotal = isViewMode
    ? Number(readOnlyStayTotal ?? 0)
    : mode === "edit" && !pricingChanged
      ? Number(readOnlyStayTotal ?? 0)
      : resolvedQuoteTotal;
  const { errors, isSubmitting, submitCount } = form.formState;
  const hasBlockingErrors = submitCount > 0 && Object.keys(errors).length > 0;
  const inclusionTotal = 0;
  const extrasTotal = 0;
  const totalReceived = 0;
  const reservationTotal =
    roomSubtotal === null ? null : roomSubtotal + inclusionTotal + extrasTotal;
  const totalOutstanding =
    reservationTotal === null ? null : reservationTotal - totalReceived;
  const summaryAmountDisplay = (amount: number | null) =>
    quoteError
      ? "Tidak tersedia"
      : isQuotePending
        ? "Menghitung…"
        : amount === null
          ? "-"
          : formatIDR(amount);
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

  function onInvalidSubmit() {
    setActiveTab("detail");
  }

  const reservationActionHint = hasBlockingErrors ? (
    <p className="font-medium text-red-600">
      Periksa kembali isian yang ditandai merah.
    </p>
  ) : null;
  const reservationActions = (
    <>
      {viewFooterActions}
      {!isViewMode ? (
        <>
          <Button
            type="submit"
            disabled={isSubmitting || isQuotePending || Boolean(quoteError)}
            className="desktop:lg:h-11! desktop:lg:text-sm disabled:opacity-70"
          >
            {isSubmitting ? "Menyimpan..." : submitLabel}
          </Button>
          <Link
            href={returnHref}
            className={`${buttonVariants({ variant: "outline" })} border-slate-300! bg-slate-100! text-slate-900! hover:bg-slate-200! desktop:lg:h-11! desktop:lg:text-sm`}
          >
            Batal
          </Link>
        </>
      ) : null}
    </>
  );

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
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <ReadOnlySection title="Data Tamu">
            <ReadOnlyField label="Nama Lengkap" value={defaultValues.fullName} />
            <ReadOnlyField
              label="Jenis Identitas"
              value={guestIdTypeLabel(defaultValues.idType || null)}
            />
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
            <ReadOnlyField
              label="Deposit (= tarif malam pertama)"
              value={formatIDR(totalDeposit)}
            />
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
                value="Rincian malam tidak tersedia; total menggunakan tarif tetap."
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

  const roomRateDisplay = (index: number) =>
    quoteError
      ? "Tidak tersedia"
      : isQuotePending
        ? "Menghitung…"
        : displayedDeposits[index]
          ? formatIDR(displayedDeposits[index])
          : "—";
  const reservationSummary = (
    <section
      className={`${cardClassName} desktop:lg:rounded-none desktop:lg:border-0 desktop:lg:shadow-none`}
    >
      <div className={cardHeaderClassName}>
        <h2 className={sectionTitleClassName}>Ringkasan Reservasi</h2>
      </div>
      <div className={cardContentClassName}>
        <dl aria-label="Rincian biaya reservasi" className="text-sm">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Total Kamar</dt>
              <dd className="num text-right font-medium text-slate-900">
                {summaryAmountDisplay(roomSubtotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Inklusi</dt>
              <dd className="num text-right font-medium text-slate-900">
                {formatIDR(inclusionTotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Total Extras</dt>
              <dd className="num text-right font-medium text-slate-900">
                {formatIDR(extrasTotal)}
              </dd>
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold text-slate-900">Total</dt>
              <dd className="num text-right font-semibold text-slate-900">
                {summaryAmountDisplay(reservationTotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Total Diterima</dt>
              <dd className="num text-right font-medium text-slate-900">
                {formatIDR(totalReceived)}
              </dd>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold text-slate-900">Sisa Tagihan</dt>
              <dd className="num text-right font-bold text-slate-900">
                {summaryAmountDisplay(totalOutstanding)}
              </dd>
            </div>
          </div>
        </dl>

        {quoteError ? (
          <p className="mt-4 text-sm font-medium text-red-600">{quoteError}</p>
        ) : null}
        {pricingChanged && readOnlyStayTotal ? (
          <div className="mt-4 flex items-baseline justify-between gap-3 text-xs text-slate-500">
            <span>Total terkunci sebelumnya</span>
            <span className="num font-medium text-slate-700">
              {formatIDR(readOnlyStayTotal)}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );

  return (
    <Form {...form}>
      <form
        id="reservation-form"
        onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}
        className="flex flex-col gap-4"
      >
        <Tabs
          value={isCreateMode ? activeTab : "detail"}
          onValueChange={(value) => setActiveTab(value as ReservationTab)}
          className="gap-4"
        >
          {isCreateMode ? (
            <TabsList className="-mx-5 -mt-4 sticky top-14.25 z-30 flex h-auto w-[calc(100%+2.5rem)] max-w-none flex-wrap items-stretch justify-start overflow-clip rounded-none border-x-0 border-t-0 border-b border-slate-200 bg-white px-5 py-0 shadow-none md:-mx-6 md:-mt-5 md:w-[calc(100%+3rem)] md:px-6 desktop:top-0">
              {reservationTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-13 min-w-24 flex-none rounded-none border-b-4 border-transparent bg-transparent px-4 text-sm font-medium text-slate-600 shadow-none hover:bg-transparent hover:text-slate-900 data-active:border-black data-active:bg-transparent data-active:font-semibold data-active:text-slate-950 data-active:shadow-none sm:min-w-28"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : null}

          <div className="grid gap-4 desktop:lg:grid-cols-[minmax(0,1fr)_360px] desktop:lg:items-start">
            <div className="min-w-0 desktop:lg:pt-px">
              <TabsContent
                value="detail"
                keepMounted
                className="flex flex-col gap-4"
              >
                <section className={cardClassName} aria-labelledby="stay-details-title">
              <div className={cardHeaderClassName}>
                <h2 id="stay-details-title" className={sectionTitleClassName}>
                  Detail Menginap
                </h2>
              </div>
              <div className={cardContentClassName}>
                <div className="grid items-start gap-3.5 md:grid-cols-2 desktop:min-[1400px]:grid-cols-[1.1fr_1.1fr_auto_1fr_1.1fr]">
                  <FormField
                    control={form.control}
                    name="reservationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Tipe Reservasi <RequiredMark />
                        </FormLabel>
                        <FormControl>
                          <select className={selectClassName} disabled={isViewMode} {...field}>
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
                        <FormLabel>
                          Kedatangan <RequiredMark />
                        </FormLabel>
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

                              const currentDeparture = form.getValues("departureDate");

                              if (!currentDeparture || currentDeparture <= nextArrival) {
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

                  <div className="flex h-11 items-center justify-center self-end md:col-span-2 desktop:h-10 desktop:min-[1400px]:col-span-1">
                    <span className="num rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-slate-600">
                      {nights} malam
                    </span>
                  </div>

                  <FormField
                    control={form.control}
                    name="departureDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Keberangkatan <RequiredMark />
                        </FormLabel>
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
                        <FormLabel>
                          Paket Menginap <RequiredMark />
                        </FormLabel>
                        <FormControl>
                          <select className={selectClassName} disabled={isViewMode} {...field}>
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
                </div>
              </div>
            </section>

            <section className={cardClassName} aria-labelledby="guest-data-title">
              <div className={cardHeaderClassName}>
                <div>
                  <h2 id="guest-data-title" className={sectionTitleClassName}>
                    Data Tamu
                  </h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Data sesuai identitas tamu utama
                  </p>
                </div>
              </div>
              <div className={cardContentClassName}>
                <div className="grid gap-3.5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Nama Lengkap <RequiredMark />
                        </FormLabel>
                        <FormControl>
                          <Input
                            className={fieldClassName}
                            placeholder="Nama sesuai identitas"
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
                        <FormLabel>Nomor Telepon</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <span
                              className="flex h-11 shrink-0 items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-600 desktop:h-10"
                              aria-hidden="true"
                            >
                              +62
                            </span>
                            <Input
                              className={`${fieldClassName} rounded-l-none`}
                              inputMode="tel"
                              placeholder="812 3456 7890"
                              readOnly={isViewMode}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="idType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Jenis Identitas {isCreateMode ? <RequiredMark /> : null}
                        </FormLabel>
                        <FormControl>
                          <select className={selectClassName} {...field}>
                            <option value="">
                              {isCreateMode ? "Pilih jenis identitas" : "Belum dipilih"}
                            </option>
                            {guestIdTypeOptions.map((option) => (
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
                    name="idNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Identitas</FormLabel>
                        <FormControl>
                          <Input
                            className={fieldClassName}
                            placeholder="Nomor identitas"
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
                            placeholder="nama@email.com"
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
                          <Input className={fieldClassName} readOnly={isViewMode} {...field} />
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
                          <FormLabel>
                            Alamat <RequiredMark />
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className={textareaClassName}
                              placeholder="Alamat sesuai identitas"
                              readOnly={isViewMode}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catatan (opsional)</FormLabel>
                          <FormControl>
                            <Textarea
                              className={textareaClassName}
                              placeholder="Permintaan khusus, kedatangan terlambat, atau catatan reservasi."
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
            </section>

            <section className={cardClassName} aria-labelledby="rooms-title">
              <div className={cardHeaderClassName}>
                <h2 id="rooms-title" className={sectionTitleClassName}>
                  Kamar
                </h2>

              </div>

              <div className={`${cardContentClassName} flex flex-col gap-3`}>
                {roomsFieldArray.fields.map((roomField, index) => {
                  const rowValue = watchedRoomRows[index];
                  const rowRoomTypeId = Number(rowValue?.roomTypeId || 0);
                  const rowRoomId = Number(rowValue?.roomId || 0);
                  const rowRoomType = roomTypes.find(
                    (roomType) => roomType.id === rowRoomTypeId,
                  );
                  const rowTotalGuests =
                    Number(rowValue?.adults || 0) + Number(rowValue?.children || 0);
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
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-800">
                          Kamar {index + 1}
                          {rowRoomType ? (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {rowTotalGuests || 0}/{rowRoomType.capacity} tamu
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

                      <div className="grid items-start gap-3.5 md:grid-cols-2 desktop:min-[1400px]:grid-cols-12">
                        <FormField
                          control={form.control}
                          name={`rooms.${index}.roomTypeId`}
                          render={({ field }) => (
                            <FormItem className="desktop:min-[1400px]:col-span-3">
                              <FormLabel>
                                Tipe Kamar <RequiredMark />
                              </FormLabel>
                              <FormControl>
                                <select
                                  className={selectClassName}
                                  disabled={isViewMode}
                                  {...field}
                                  onChange={(event) => {
                                    field.onChange(event.target.value);

                                    if (!isViewMode) {
                                      form.setValue(`rooms.${index}.roomId`, "", {
                                        shouldValidate: true,
                                      });
                                    }
                                  }}
                                >
                                  <option value="">Pilih tipe kamar</option>
                                  {roomTypes.map((roomType) => (
                                    <option key={roomType.id} value={String(roomType.id)}>
                                      {roomType.code} - {roomType.name} - {roomType.capacity} tamu -{" "}
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
                            <FormItem className="desktop:min-[1400px]:col-span-3">
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
                                      {!room.isAvailable ? " / tidak tersedia" : ""}
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
                            <FormItem className="desktop:min-[1400px]:col-span-2">
                              <FormLabel>
                                Dewasa <RequiredMark />
                              </FormLabel>
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
                            <FormItem className="desktop:min-[1400px]:col-span-2">
                              <FormLabel>
                                Anak <RequiredMark />
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

                        <div className="md:col-span-2 desktop:min-[1400px]:col-span-2">
                          <p className="text-sm font-medium text-slate-700">Tarif kamar</p>
                          <div
                            role="status"
                            className="num mt-2 flex min-h-11 items-center text-sm font-semibold text-slate-900 desktop:min-h-10"
                          >
                            {roomRateDisplay(index)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isCreateMode ? (
                  <div className="flex justify-center pt-1">
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
                      Tambah Kamar
                    </Button>
                  </div>
                ) : null}
              </div>
                </section>
              </TabsContent>

              {isCreateMode
                ? reservationTabs.slice(1).map((tab) => (
                    <TabsContent key={tab.value} value={tab.value} keepMounted>
                      <section
                        className={`${cardClassName} flex min-h-64 items-center justify-center p-6 text-center`}
                        aria-labelledby={`${tab.value}-placeholder-title`}
                      >
                        <div className="max-w-sm">
                          <h2
                            id={`${tab.value}-placeholder-title`}
                            className={sectionTitleClassName}
                          >
                            {tab.label}
                          </h2>
                          <p className="mt-2 text-sm text-slate-500">
                            Fitur ini akan tersedia setelah reservasi dibuat.
                          </p>
                        </div>
                      </section>
                    </TabsContent>
                  ))
                : null}
            </div>

            <aside className="contents desktop:lg:sticky desktop:lg:top-14.25 desktop:lg:flex desktop:lg:h-[calc(100dvh-5.5625rem)] desktop:lg:max-h-[calc(100dvh-5.5625rem)] desktop:lg:min-w-0 desktop:lg:self-start desktop:lg:flex-col desktop:lg:overflow-clip desktop:lg:rounded-lg desktop:lg:border desktop:lg:border-slate-200 desktop:lg:bg-white desktop:lg:shadow-sm">
            <div className="desktop:lg:hidden">{reservationSummary}</div>
            <div className="hidden desktop:lg:block">
              {reservationSummary}
            </div>

            {showFooter ? (
              <PinnedActionFooter
                hint={reservationActionHint}
                actions={reservationActions}
                actionsClassName="desktop:lg:flex-col desktop:lg:gap-3 desktop:lg:px-5 desktop:lg:py-5 desktop:lg:[&>*]:w-full desktop:lg:[&>*]:flex-none"
                className="desktop:lg:border-t desktop:lg:border-slate-200 desktop:lg:[&>div]:rounded-none desktop:lg:[&>div]:border-0 desktop:lg:[&>div]:shadow-none"
                desktopPanel
              />
            ) : null}
            </aside>
          </div>
        </Tabs>
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
