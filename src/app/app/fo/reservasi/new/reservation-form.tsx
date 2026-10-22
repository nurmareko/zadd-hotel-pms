"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ArrangementType } from "@prisma/client";
import { addDays, formatISO, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { toast } from "sonner";

import { CountryCombobox } from "@/components/country-combobox";
import { PinnedActionFooter } from "@/components/pinned-action-footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

import { countries, findCountryByName } from "@/lib/countries";
import { formatDateID, formatIDR } from "@/lib/format";
import { findOverlappingRoomBlock, roomBlockedMessage, type RoomBlockSummary } from "@/lib/room-blocks/overlap";
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
import { GuestLookupDialog } from "./guest-lookup-dialog";
import { safelyRunReservationAction } from "./reservation-errors";
import {
  firstReservationErrorField,
  normalizeReservationFieldPath,
} from "./reservation-form-fields";
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
  mealPlanPrices: Record<ArrangementType, number>;
  roomTypes: RoomTypeOption[];
  rooms: RoomOption[];
  activeReservations: ActiveReservation[];
  activeRoomBlocks: RoomBlockSummary[];
  mode?: "create" | "edit" | "view";
  reservationId?: number;
  createOrigin?: FoReservasiView;
  returnHref?: string;
  submitLabel?: string;
  viewFooterActions?: ReactNode;
  readOnlyStayTotal?: string;
  readOnlyInclusionTotal?: string;
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
  { value: "COMPANY", label: "Corporate" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "OTA", label: "Online Travel Agency (OTA)" },
  { value: "WALK_IN", label: "Walk-in" },
] as const;

const arrangementTypeLabels = {
  RO: "RO — Room Only",
  BB: "BB — Bed & Breakfast",
  HB: "HB — Breakfast + One Main Meal",
  FB: "FB — Breakfast, Lunch & Dinner",
} as const;

const roomOperationalStatusLabels: Record<string, string> = {
  VC: "VC - Vacant Clean",
  VD: "VD - Vacant Dirty",
  OC: "OC - Occupied Clean",
  OD: "OD - Occupied Dirty",
  VCU: "VCU - Awaiting Inspection",
  OOO: "OOO - Out of Order",
};
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
  arrangementType: string,
  rooms: Array<{ roomTypeId: string; adults: string; children: string; customRate?: string }>,
) {
  const roomKey = rooms
    .map((room) => `${room.roomTypeId}:${room.adults}:${room.children}:${room.customRate ?? ""}`)
    .join(",");

  return `${arrivalDate}|${departureDate}|${arrangementType}|${roomKey}`;
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
      <span className="sr-only"> (required)</span>
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

function unifiedDefaultValues(
  defaultValues: CreateReservationInput,
): UnifiedReservationInput {
  return {
    guestId: defaultValues.guestId ?? null,
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
    guestId: values.guestId ?? null,
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
  mealPlanPrices,
  roomTypes,
  rooms,
  activeReservations,
  activeRoomBlocks,
  mode = "create",
  reservationId,
  createOrigin = "list",
  returnHref = FO_RESERVASI_VIEW_PATHS.list,
  submitLabel = "Save Reservation",
  viewFooterActions,
  readOnlyStayTotal,
  readOnlyInclusionTotal,
  readOnlyDeposit,
  readOnlyNightlySchedule = [],
}: ReservationFormProps) {
  const router = useRouter();
  const arrangementTypeOptions = (["RO", "BB", "HB", "FB"] as const).map((value) => ({
    value, label: arrangementTypeLabels[value], price: mealPlanPrices[value],
  }));
  const hasMountedRoomValidation = useRef(false);

  const isViewMode = mode === "view";
  const isCreateMode = mode === "create";

  const reservationAsideStyle = {
    "--reservation-aside-top-offset": "1.25rem",
    "--reservation-aside-bottom-clearance": "1.25rem",
    "--reservation-aside-max-height":
      "calc(100dvh - var(--reservation-aside-top-offset) - var(--reservation-aside-bottom-clearance))",
  } as CSSProperties;
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
    shouldFocusError: false,
    defaultValues: unifiedDefaultValues(defaultValues),
  });

  const guestId = useWatch({ control: form.control, name: "guestId" });
  const roomsFieldArray = useFieldArray({
    control: form.control,
    name: "rooms",
  });
  const [
    arrivalDate,
    departureDate,
    arrangementType,
    roomRows,
  ] = useWatch({
    control: form.control,
    name: [
      "arrivalDate",
      "departureDate",
      "arrangementType",
      "rooms",
    ],
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
    arrangementType,
    watchedRoomRows,
  );
  const initialPricingKey = pricingKey(
    defaultValues.arrivalDate,
    defaultValues.departureDate,
    defaultValues.arrangementType,
    [
      {
        roomTypeId: defaultValues.roomTypeId,
        adults: defaultValues.adults,
        children: defaultValues.children,
      },
    ],
  );
  const pricingChanged = mode === "edit" && currentPricingKey !== initialPricingKey;
  // Guest-count changes update inclusions, not the saved room-rate snapshot.
  const roomPricingChanged = mode === "edit" && (
    arrivalDate !== defaultValues.arrivalDate ||
    departureDate !== defaultValues.departureDate ||
    watchedRoomRows[0]?.roomTypeId !== defaultValues.roomTypeId
  );
  const [resolvedQuote, setResolvedQuote] = useState<{
    key: string;
    roomTotal: number | null;
    inclusionTotal: number;
    reservationTotal: number | null;
    deposits: number[];
    standardFirstNightRates: number[];
    inclusionRooms: Array<{
      pax: number;
      nights: number;
      unitPrice: number;
      total: number;
    }>;
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

    void safelyRunReservationAction(
      () =>
        getReservationQuote({
          rooms: watchedRoomRows,
          arrangementType,
          arrivalDate,
          departureDate,
        }),
      "quote",
    ).then((result) => {
      if (ignore) {
        return;
      }

      setResolvedQuote(
        result.ok
          ? {
              key: quoteKey,
              roomTotal: Number(result.roomTotal),
              inclusionTotal: Number(result.inclusionTotal),
              reservationTotal: Number(result.reservationTotal),
              deposits: result.deposits.map(Number),
              standardFirstNightRates: result.standardFirstNightRates,
              inclusionRooms: result.inclusionRooms.map((room) => ({
                ...room,
                unitPrice: Number(room.unitPrice),
                total: Number(room.total),
              })),
              error: null,
            }
          : {
              key: quoteKey,
              roomTotal: null,
              inclusionTotal: 0,
              reservationTotal: null,
              deposits: [],
              standardFirstNightRates: [],
              inclusionRooms: [],
              error: result.error,
            },
      );
    });

    return () => {
      ignore = true;
    };
  }, [
    arrangementType,
    arrivalDate,
    canResolveQuote,
    currentPricingKey,
    departureDate,
    mode,
    pricingChanged,
    watchedRoomRows,
  ]);

  const activeQuote =
    resolvedQuote?.key === currentPricingKey ? resolvedQuote : null;
  const quoteRequested =
    canResolveQuote && !(mode === "edit" && !pricingChanged);
  const isQuotePending = quoteRequested && activeQuote === null;
  const quoteError = activeQuote?.error ?? null;
  const resolvedRoomTotal = activeQuote?.roomTotal ?? null;
  const resolvedInclusionTotal = activeQuote?.inclusionTotal ?? 0;

  const inclusionRooms = activeQuote?.inclusionRooms ?? [];
  const resolvedDeposits = activeQuote?.deposits ?? [];
  const displayedDeposits =
    isViewMode || (mode === "edit" && !roomPricingChanged)
      ? [Number(readOnlyDeposit ?? 0)]
      : resolvedDeposits;
  const totalDeposit = displayedDeposits.reduce(
    (total, deposit) => total + deposit,
    0,
  );

  const roomSubtotal = isViewMode
    ? Number(readOnlyStayTotal ?? 0)
    : mode === "edit" && !roomPricingChanged
      ? Number(readOnlyStayTotal ?? 0)
      : resolvedRoomTotal;
  const { errors, isSubmitting, submitCount } = form.formState;
  const hasBlockingErrors = submitCount > 0 && Object.keys(errors).length > 0;
  const inclusionTotal =
    isViewMode || (mode === "edit" && !pricingChanged)
      ? Number(readOnlyInclusionTotal ?? 0)
      : resolvedInclusionTotal;

  const totalReceived = 0;
  const reservationTotal = roomSubtotal;
  const netRoomTotal = roomSubtotal === null
    ? null
    : roomSubtotal - inclusionTotal;
  const totalOutstanding =
    reservationTotal === null ? null : reservationTotal - totalReceived;
  const summaryAmountDisplay = (amount: number | null) =>
    quoteError
      ? "Unavailable"
      : isQuotePending
        ? "Calculating…"
        : amount === null
          ? "-"
          : formatIDR(amount);
  const showFooter = !isViewMode || Boolean(viewFooterActions);
  const nationality = useWatch({ control: form.control, name: "nationality" }) ?? "";
  const selectedNationality = findCountryByName(nationality);

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
        activeRoomBlocks,
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
    activeRoomBlocks,
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

    const formValues = form.getValues();
    const values = {
      ...formValues,
      rooms: formValues.rooms.map((room) => ({
        ...room,
        occupantName:
          isCreateMode && formValues.rooms.length > 1
            ? room.occupantName
            : undefined,
      })),
    };
    const operation = mode === "edit" ? "edit" : "create";
    const result = await safelyRunReservationAction<
      Awaited<ReturnType<typeof createReservation | typeof updateReservation>>
    >(
      () =>
        mode === "edit" && reservationId
          ? updateReservation(reservationId, firstRoomReservationValues(values))
          : createReservation(values, createOrigin),
      operation,
    );

    if (result.ok) {
      if ("reservationNumbers" in result.data) {
        const { reservationNumbers, guestName } = result.data;
        const resLabel =
          reservationNumbers.length > 1
            ? `${reservationNumbers.length} reservations (${reservationNumbers.join(", ")})`
            : `Reservation ${reservationNumbers[0]}`;
        toast.success(`${resLabel} created for ${guestName}`);
      } else {
        toast.success("Reservation changes saved");
      }
      router.push(result.data.redirectUrl);
      return;
    }

    if (!result.ok) {
      const message = result.error;

      if (result.field) {
        const normalizedField = normalizeReservationFieldPath(result.field);
        if (normalizedField) {
          const field = normalizedField as FieldPath<UnifiedReservationInput>;

          form.setError(field, { type: "server", message });
          form.setFocus(field);
        } else {
          toast.error(message);
        }
      } else {
        toast.error(message);
      }
    }
  }

  function onInvalidSubmit(errors: FieldErrors<UnifiedReservationInput>) {
    const firstErrorField = firstReservationErrorField(errors);
    if (firstErrorField) {
      form.setFocus(firstErrorField as FieldPath<UnifiedReservationInput>);
    }
  }

  const reservationActionHint = hasBlockingErrors ? (
    <p className="font-medium text-red-600">
      Check the fields highlighted in red.
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
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
          <Link
            href={returnHref}
            className={`${buttonVariants({ variant: "outline" })} border-slate-300! bg-slate-100! text-slate-900! hover:bg-slate-200! desktop:lg:h-11! desktop:lg:text-sm`}
          >
            Cancel
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
      arrangementTypeLabels[defaultValues.arrangementType];
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <ReadOnlySection title="Guest Details">
            <ReadOnlyField label="Full Name" value={defaultValues.fullName} />
            <ReadOnlyField
              label="ID Type"
              value={guestIdTypeLabel(defaultValues.idType || null)}
            />
            <ReadOnlyField
              label="ID Number"
              value={defaultValues.idNumber}
            />
            <ReadOnlyField label="Phone" value={defaultValues.phone} />
            <ReadOnlyField label="Email" value={defaultValues.email} />
            <ReadOnlyField
              label="Nationality"
              value={defaultValues.nationality}
            />
            <ReadOnlyField
              label="Address"
              value={defaultValues.address}
              wide
            />
            <ReadOnlyField
              label="Notes"
              value={defaultValues.notes}
              wide
            />
          </ReadOnlySection>

          <ReadOnlySection title="Stay Dates">
            <ReadOnlyField
              label="Reservation Type"
              value={reservationTypeLabel}
            />
            <ReadOnlyField label="Arrangement" value={arrangementTypeLabel} />
            <ReadOnlyField
              label="Check-in"
              value={defaultValues.arrivalDate}
            />
            <ReadOnlyField
              label="Check-out"
              value={defaultValues.departureDate}
            />
            <ReadOnlyField
              label="Length of Stay"
              value={`${nights} nights`}
            />
          </ReadOnlySection>

          <ReadOnlySection title="Room">
            <ReadOnlyField
              label="Room Type"
              value={
                roomType ? `${roomType.code} — ${roomType.name}` : "Not selected"
              }
            />
            <ReadOnlyField
              label="Room Number"
              value={
                allocatedRoom
                  ? `${allocatedRoom.number} · Floor ${allocatedRoom.floor}`
                  : "Not assigned"
              }
            />
            <ReadOnlyField
              label="Adults"
              value={roomValue?.adults ?? defaultValues.adults}
            />
            <ReadOnlyField
              label="Children"
              value={roomValue?.children ?? defaultValues.children}
            />
            <ReadOnlyField
              label="Room Type Capacity"
              value={roomType ? `${roomType.capacity} guests` : "—"}
            />
          </ReadOnlySection>

          <ReadOnlySection title="Financial Information">
            <ReadOnlyField
              label="Stay Total"
              value={
                readOnlyStayTotal ? formatIDR(readOnlyStayTotal) : "—"
              }
            />
            <ReadOnlyField
              label="Deposit (= first night's rate)"
              value={formatIDR(totalDeposit)}
            />
          </ReadOnlySection>

          <ReadOnlySection title="Nightly Rate Breakdown">
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
                label="Nightly schedule"
                value="Nightly details are unavailable; the total uses a fixed rate."
                wide
              />
            )}
          </ReadOnlySection>
        </div>

        {showFooter ? (
          <PinnedActionFooter
            hint={
              <p className="text-slate-500">
                Reservation details are displayed in view mode.
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
      ? "Unavailable"
      : isQuotePending
        ? "Calculating…"
        : displayedDeposits[index] !== undefined
          ? formatIDR(displayedDeposits[index])
          : "—";
  const reservationSummary = (
    <section
      className={`${cardClassName} desktop:lg:rounded-none desktop:lg:border-0 desktop:lg:shadow-none`}
    >
      <div className={cardHeaderClassName}>
        <h2 className={sectionTitleClassName}>Reservation Summary</h2>
      </div>
      <div className={cardContentClassName}>
        <dl aria-label="Reservation cost breakdown" className="text-sm">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Room Total (Net)</dt>
              <dd className="num text-right font-medium text-slate-900">
                {summaryAmountDisplay(netRoomTotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Arrangement allocation</dt>
              <dd className="num text-right font-medium text-slate-900">
                {summaryAmountDisplay(inclusionTotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Total Extras</dt>
              <dd className="num text-right font-medium text-slate-900">
                {formatIDR(0)}
              </dd>
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold text-slate-900">Package Total</dt>
              <dd className="num text-right font-semibold text-slate-900">
                {summaryAmountDisplay(reservationTotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-600">Total Received</dt>
              <dd className="num text-right font-medium text-slate-900">
                {formatIDR(totalReceived)}
              </dd>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold text-slate-900">Balance Due</dt>
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
            <span>Previously locked total</span>
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
          <div className="grid gap-4 desktop:lg:grid-cols-[minmax(0,1fr)_360px] desktop:lg:items-start">
            <div className="flex min-w-0 flex-col gap-4 desktop:lg:pt-px">
                <section className={cardClassName} aria-labelledby="stay-details-title">
              <div className={cardHeaderClassName}>
                <h2 id="stay-details-title" className={sectionTitleClassName}>
                  Stay Details
                </h2>
              </div>
              <div className={cardContentClassName}>
                <div className="grid items-start gap-3.5 desktop:xl:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)]">
                  <FormField
                    control={form.control}
                    name="reservationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Reservation Type <RequiredMark />
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

                  <div className="grid items-start gap-3.5 desktop:xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <FormField
                    control={form.control}
                    name="arrivalDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Arrival <RequiredMark />
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

                  <div className="flex h-11 items-center justify-center self-end desktop:h-10">
                    <span className="num rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-slate-600">
                      {nights} nights
                    </span>
                  </div>

                  <FormField
                    control={form.control}
                    name="departureDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Departure <RequiredMark />
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
                  </div>
                </div>
              </div>
            </section>

            <section className={cardClassName} aria-labelledby="guest-data-title">
              <div className={cardHeaderClassName}>
                <h2 id="guest-data-title" className={sectionTitleClassName}>
                  Guest Details
                </h2>
                {isCreateMode && (
                  <GuestLookupDialog
                    disabled={isSubmitting}
                    onSelect={(guest) => {
                      const options = { shouldDirty: true, shouldValidate: true };
                      form.setValue("guestId", guest.id, options);
                      form.setValue("fullName", guest.fullName, options);
                      form.setValue("idType", guest.idType ?? "", options);
                      form.setValue("idNumber", guest.idNumber ?? "", options);
                      form.setValue("phone", guest.phone ?? "", options);
                      form.setValue("email", guest.email ?? "", options);
                      form.setValue("address", guest.address ?? "", options);
                      form.setValue("nationality", guest.nationality ?? "", options);
                    }}
                  />
                )}
              </div>
              <div className={cardContentClassName}>
                {isCreateMode && guestId != null && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span role="status" className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Selected existing guest (#{guestId})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => form.setValue("guestId", null, { shouldDirty: true, shouldValidate: true })}
                    >
                      Unlink (create new guest)
                    </Button>
                    <p className="w-full text-xs text-slate-600">
                      Changes below will update the existing guest profile when the reservation is saved. Unlink to create a new guest without changing that profile.
                    </p>
                  </div>
                )}
                <div className="grid gap-3.5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Full Name <RequiredMark />
                        </FormLabel>
                        <FormControl>
                          <Input
                            className={fieldClassName}
                            placeholder="Name as shown on ID"
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
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            className={fieldClassName}
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Example: 0812 3456 7890"
                            readOnly={isViewMode}
                            {...field}
                            value={field.value ?? ""}
                          />
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
                          ID Type {isCreateMode ? <RequiredMark /> : null}
                        </FormLabel>
                        <FormControl>
                          <select className={selectClassName} {...field}>
                            <option value="">
                              {isCreateMode ? "Select ID type" : "Not selected"}
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
                        <FormLabel>ID Number</FormLabel>
                        <FormControl>
                          <Input
                            className={fieldClassName}
                            placeholder="ID number"
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
                            placeholder="name@example.com"
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
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Nationality</FormLabel>
                        <FormControl>
                          <CountryCombobox
                            ariaLabel="Nationality"
                            countries={countries}
                            value={selectedNationality}
                            invalid={fieldState.invalid}
                            onValueChangeAction={(country) => field.onChange(country.name)}
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
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea
                              className={textareaClassName}
                              placeholder="Address as shown on ID"
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
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              className={textareaClassName}
                              placeholder="Special requests, late arrival, or reservation notes."
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
                  Room
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
                    activeRoomBlocks,
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
                          Room {index + 1}
                          {rowRoomType ? (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {rowTotalGuests || 0}/{rowRoomType.capacity} guests
                            </span>
                          ) : null}
                        </div>
                        {isCreateMode ? (
                          <button
                            type="button"
                            className={iconButtonClassName}
                            disabled={roomsFieldArray.fields.length <= 1}
                            aria-label={`Remove room ${index + 1}`}
                            title={`Remove room ${index + 1}`}
                            onClick={() => {
                              if (roomsFieldArray.fields.length === 2) {
                                const remainingIndex = index === 0 ? 1 : 0;
                                form.setValue(`rooms.${remainingIndex}.occupantName`, "", {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }
                              roomsFieldArray.remove(index);
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>

                      {isCreateMode && roomsFieldArray.fields.length > 1 ? (
                        <FormField
                          control={form.control}
                          name={`rooms.${index}.occupantName`}
                          render={({ field }) => (
                            <FormItem className="mb-4">
                              <FormLabel>Guest / Room Occupant Name</FormLabel>
                              <FormControl>
                                <Input
                                  className={fieldClassName}
                                  placeholder="Leave blank if the same as the lead guest"
                                  maxLength={100}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}

                      <div className="grid items-start gap-3.5 md:grid-cols-2 desktop:min-[1400px]:grid-cols-12">
                        <FormField
                          control={form.control}
                          name={`rooms.${index}.roomTypeId`}
                          render={({ field }) => (
                            <FormItem className="desktop:min-[1400px]:col-span-3">
                              <FormLabel>
                                Room Type <RequiredMark />
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
                                  <option value="">Select room type</option>
                                  {roomTypes.map((roomType) => (
                                    <option key={roomType.id} value={String(roomType.id)}>
                                      {roomType.code} - {roomType.name} - {roomType.capacity} guests -{" "}
                                      {formatIDR(roomType.baseRate)}/night
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
                          render={({ field }) => {
                            const selectedRoomOption = rowRoomOptions.find(
                              (opt) => String(opt.id) === String(field.value),
                            );

                            return (
                              <FormItem className="desktop:min-[1400px]:col-span-3">
                                <FormLabel>Room</FormLabel>
                                <FormControl>
                                  <select
                                    className={selectClassName}
                                    disabled={isViewMode || !rowRoomTypeId}
                                    {...field}
                                  >
                                    <option value="">Not assigned</option>
                                    {rowRoomOptions.map((room) => {
                                      const reason = room.block
                                        ? ` / 🚫 ${roomBlockedMessage(room.block)}`
                                        : !room.isAvailable
                                        ? " / ⚠️ Occupied by another reservation"
                                        : room.status === "VC"
                                        ? " / Ready for Use"
                                        : room.status === "VD"
                                        ? " / Cleaning Required"
                                        : "";

                                      return (
                                        <option
                                          key={room.id}
                                          value={String(room.id)}
                                          disabled={!room.isAvailable}
                                        >
                                          Room {room.number} · Floor {room.floor} · [{room.status}]{reason}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </FormControl>
                                {selectedRoomOption?.status ? (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                                    <span className="text-slate-500">Physical status:</span>
                                    <span
                                      className={cn(
                                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                                        selectedRoomOption.status === "VC" &&
                                          "border-emerald-200 bg-emerald-50 text-emerald-700",
                                        selectedRoomOption.status === "VD" &&
                                          "border-amber-200 bg-amber-50 text-amber-700",
                                        (selectedRoomOption.status === "OC" ||
                                          selectedRoomOption.status === "OD") &&
                                          "border-blue-200 bg-blue-50 text-blue-700",
                                        selectedRoomOption.status === "OOO" &&
                                          "border-red-200 bg-red-50 text-red-700",
                                      )}
                                    >
                                      {roomOperationalStatusLabels[selectedRoomOption.status] ??
                                        selectedRoomOption.status}
                                    </span>
                                    {selectedRoomOption.status === "VD" && (
                                      <span className="text-[11px] text-amber-700">
                                        (Housekeeping cleaning required)
                                      </span>
                                    )}
                                  </div>
                                ) : null}
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

                        <FormField
                          control={form.control}
                          name={`rooms.${index}.adults`}
                          render={({ field }) => (
                            <FormItem className="desktop:min-[1400px]:col-span-2">
                              <FormLabel>
                                Adults <RequiredMark />
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
                                Children <RequiredMark />
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

                        {isCreateMode ? (
                          <>
                            <FormField
                              control={form.control}
                              name={`rooms.${index}.customRate`}
                              render={({ field }) => {
                                const standardRate = activeQuote?.standardFirstNightRates[index] ?? 0;
                                const customRateNum = Number(field.value);
                                const validCustomRate = Boolean(field.value?.trim()) && Number.isInteger(customRateNum) && customRateNum >= 0 && customRateNum <= 100_000_000;
                                const discountPct = validCustomRate && standardRate > 0
                                  ? Math.round(((standardRate - customRateNum) / standardRate) * 100)
                                  : 0;
                                return (
                                <FormItem className="md:col-span-2 desktop:min-[1400px]:col-span-6">
                                  <FormLabel>Custom Room Rate (Rp / night)</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      value={field.value ?? ""}
                                      type="number"
                                      min={0}
                                      max={100_000_000}
                                      step={1}
                                      placeholder="Automatically uses the standard rate"
                                      className={fieldClassName}
                                      aria-describedby={`custom-rate-hint-${index}`}
                                    />
                                  </FormControl>
                                  <p id={`custom-rate-hint-${index}`} className="text-xs text-slate-500" role="status">
                                    {activeQuote?.standardFirstNightRates[index] !== undefined ? (
                                      <>
                                        Standard first-night rate: {formatIDR(activeQuote.standardFirstNightRates[index])}.
                                        {field.value?.trim() && Number.isFinite(Number(field.value)) ? (
                                          <> Difference: {formatIDR(Number(field.value) - activeQuote.standardFirstNightRates[index])} / night compared with the first night. The custom rate applies to all nights.</>
                                        ) : " Standard rates may vary by night."}
                                      </>
                                    ) : isQuotePending ? "Calculating standard rate…" : "Select a room type and dates to see the standard rate."}
                                  </p>
                                  {discountPct >= 30 && (
                                    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800" role="alert">
                                      <span className="font-semibold">High Discount Warning:</span> This custom rate represents a {discountPct}% discount from the standard first-night rate ({formatIDR(standardRate)}). Ensure supervisor approval is documented in the reason field.
                                    </div>
                                  )}
                                  <FormMessage />
                                </FormItem>
                                );
                              }}
                            />
                            <FormField
                              control={form.control}
                              name={`rooms.${index}.customRateReason`}
                              render={({ field }) => (
                                <FormItem className="md:col-span-2 desktop:min-[1400px]:col-span-6">
                                  <FormLabel>Custom rate reason (optional)</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      value={field.value ?? ""}
                                      maxLength={255}
                                      placeholder="Example: contracted rate"
                                      className={fieldClassName}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        ) : null}
                        <div className="md:col-span-2 desktop:min-[1400px]:col-span-2">
                          <p className="text-sm font-medium text-slate-700">Room rate</p>
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
                      Add Room
                    </Button>
                  </div>
                ) : null}
              </div>
                </section>

              {isCreateMode ? (
                  <section className={cardClassName} aria-labelledby="meal-inclusion-title">
                    <div className={cardHeaderClassName}>
                      <div>
                        <h2 id="meal-inclusion-title" className={sectionTitleClassName}>
                          Arrangement
                        </h2>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          One arrangement applies to all rooms in this reservation. The arrangement allocation is included in the room package rate.
                        </p>
                      </div>
                    </div>
                    <div className={cardContentClassName}>
                      <FormField
                        control={form.control}
                        name="arrangementType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Arrangement (Room Package) <RequiredMark />
                            </FormLabel>
                            <FormControl>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {arrangementTypeOptions.map((option, index) => {
                                  const selected = field.value === option.value;

                                  return (
                                    <label
                                      key={option.value}
                                      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                                        selected
                                          ? "border-emerald-500 bg-emerald-50"
                                          : "border-slate-200 bg-white hover:border-slate-300"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        className="sr-only"
                                        name={field.name}
                                        value={option.value}
                                        checked={selected}
                                        onBlur={field.onBlur}
                                        onChange={() => field.onChange(option.value)}
                                        ref={index === 0 ? field.ref : undefined}
                                      />
                                      <span className="block text-sm font-semibold text-slate-900">
                                        {option.label}
                                      </span>
                                      <span className="num mt-1 block text-sm text-slate-600">
                                        Allocation {formatIDR(option.price)} per guest per night
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className={cardHeaderClassName}>
                      <div>
                        <h3 id="meal-preview-title" className={sectionTitleClassName}>
                          Estimated Arrangement Allocation
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Guest count is the total number of adults and children in each room.
                        </p>
                      </div>
                      <span className="num text-sm font-bold text-slate-900">
                        {summaryAmountDisplay(inclusionTotal)}
                      </span>
                    </div>
                    <div className={cardContentClassName}>
                      {isQuotePending ? (
                        <p role="status" className="text-sm text-slate-500">Calculating estimate…</p>
                      ) : quoteError ? (
                        <p className="text-sm font-medium text-red-600">{quoteError}</p>
                      ) : inclusionRooms.length > 0 ? (
                        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                          {inclusionRooms.map((room, index) => (
                            <div
                              key={`${index}-${room.pax}-${room.nights}`}
                              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  Room {index + 1}
                                </p>
                                <p className="num mt-0.5 text-xs text-slate-500">
                                  {room.pax} pax × {formatIDR(room.unitPrice)} × {room.nights} nights
                                </p>
                              </div>
                              <p className="num text-sm font-semibold text-slate-900">
                                {formatIDR(room.total)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Enter dates, room type, and guest count to see an estimate.
                        </p>
                      )}
                    </div>
                  </section>
              ) : null}
            </div>

            <aside
              className="contents desktop:lg:sticky desktop:lg:top-(--reservation-aside-top-offset) desktop:lg:flex desktop:lg:max-h-(--reservation-aside-max-height) desktop:lg:min-w-0 desktop:lg:self-start desktop:lg:flex-col desktop:lg:overflow-hidden desktop:lg:rounded-lg desktop:lg:border desktop:lg:border-slate-200 desktop:lg:bg-white desktop:lg:shadow-sm"
              style={reservationAsideStyle}
            >
              <div className="desktop:lg:hidden">{reservationSummary}</div>
              <div className="hidden desktop:lg:block desktop:lg:min-h-0 desktop:lg:flex-1 desktop:lg:overflow-y-auto">
                {reservationSummary}
              </div>

              {showFooter ? (
                <PinnedActionFooter
                  hint={reservationActionHint}
                  actions={reservationActions}
                  actionsClassName="desktop:lg:flex-col desktop:lg:gap-3 desktop:lg:px-5 desktop:lg:py-5 desktop:lg:[&>*]:w-full desktop:lg:[&>*]:flex-none"
                  className="desktop:lg:shrink-0 desktop:lg:border-t desktop:lg:border-slate-200 desktop:lg:[&>div]:rounded-none desktop:lg:[&>div]:border-0 desktop:lg:[&>div]:shadow-none"
                  desktopPanel
                />
              ) : null}
            </aside>
          </div>
      </form>
    </Form>
  );
}

function getRoomOptions({
  activeRoomBlocks,
  activeReservations,
  allRooms,
  arrivalDate,
  departureDate,
  roomTypeId,
  selectedRoomIds,
  currentRoomId,
}: {
  activeRoomBlocks: RoomBlockSummary[];
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

      const block = findOverlappingRoomBlock(activeRoomBlocks, room.id, { startDate: arrivalDate, endDate: departureDate });
      return {
        ...room,
        block,
        isAvailable: !block && !isOverlapping && !isSelectedElsewhere,
      };
    });
}
