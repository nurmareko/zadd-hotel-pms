"use server";

import {
  ArrangementType,
  Prisma,
  ReservationStatus,
  ReservationUsageType,
  RoomStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { formatISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import type { Session } from "next-auth";
import { z } from "zod";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity-log";
import { MEAL_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import {
  dateOnlyBoundary,
  hotelTodayDateOnly,
  hotelTodayISO,
} from "@/lib/date-only";
import {
  PricingResolutionError,
  resolveNightlySchedule,
} from "@/lib/pricing-resolver";
import {
  createReservationNightMealSnapshot,
  createReservationNightSchedule,
} from "@/lib/reservation-night-schedule";
import {
  FO_RESERVASI_VIEW_COOKIE,
  FO_RESERVASI_VIEW_PATHS,
  type FoReservasiView,
  parseFoReservasiView,
} from "@/lib/nav-preferences";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { validateRoomTypeCapacity } from "@/lib/reservation-capacity";
import {
  cancelPendingReservationStayFees,
  createPendingReservationStayFees,
  ReservationStayFeeError,
} from "@/lib/reservation-stay-fees";
import {
  reservationAuthorizationFailure,
  reservationFailure,
  unexpectedReservationFailure,
  type ReservationActionField,
  type ReservationActionResult,
  type ReservationFailure,
} from "./reservation-errors";
import {
  createEditReservationSchema,
  createUnifiedReservationSchema,
  type EditReservationValues,
  type UnifiedReservationValues,
  reservationCapacityError,
} from "./schema";

type ReservationQuoteResult =
  | {
      ok: true;
      roomTotal: string;
      inclusionTotal: string;
      reservationTotal: string;
      deposits: string[];
      inclusionRooms: Array<{
        pax: number;
        nights: number;
        unitPrice: string;
        total: string;
      }>;
    }
  | ReservationFailure;

const ReservationQuoteSchema = z
  .object({
    rooms: z
      .array(
        z.object({
          roomTypeId: z.coerce.number().int().positive(),
          adults: z.coerce.number().int().min(1),
          children: z.coerce.number().int().min(0),
        }),
      )
      .min(1)
      .max(20),
    arrangementType: z.nativeEnum(ArrangementType),
    arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((value, context) => {
    const arrival = Date.parse(`${value.arrivalDate}T00:00:00.000Z`);
    const departure = Date.parse(`${value.departureDate}T00:00:00.000Z`);
    const nights = (departure - arrival) / 86_400_000;

    if (!Number.isFinite(nights) || nights < 1 || nights > 366) {
      context.addIssue({
        code: "custom",
        path: ["departureDate"],
        message: "Periode estimasi harus antara 1 dan 366 malam.",
      });
    }
  });

const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

function reservationCreateRedirectPath(
  origin: FoReservasiView,
  arrival: string,
) {
  if (origin === "kalender") {
    return FO_RESERVASI_VIEW_PATHS.kalender;
  }

  return `${FO_RESERVASI_VIEW_PATHS.list}?from=${arrival}&to=${arrival}`;
}

async function persistFoReservasiView(view: FoReservasiView) {
  const cookieStore = await cookies();

  cookieStore.set(FO_RESERVASI_VIEW_COOKIE, view, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/app/fo/reservasi",
    sameSite: "lax",
  });
}

const RESERVATION_VALIDATION_FIELDS = new Set<ReservationActionField>([
  "fullName",
  "idType",
  "idNumber",
  "phone",
  "email",
  "address",
  "nationality",
  "roomTypeId",
  "roomId",
  "arrivalDate",
  "departureDate",
  "adults",
  "children",
  "reservationType",
  "arrangementType",
  "notes",
  "stayFeeKinds",
  "rooms",
]);

const SAFE_VALIDATION_MESSAGE_PREFIXES = [
  "Alamat maksimal",
  "Email maksimal",
  "Fleksibilitas menginap",
  "Format email",
  "Jenis biaya fleksibilitas",
  "Jenis identitas",
  "Jumlah",
  "Kamar fisik",
  "Kamar tidak valid",
  "Keberangkatan",
  "Kewarganegaraan maksimal",
  "Maksimal",
  "Minimal",
  "Nama tamu",
  "Nomor telepon maksimal",
  "Tambahkan minimal",
  "Tanggal",
  "Tipe kamar",
];

function reservationValidationField(path: PropertyKey[]) {
  const fieldPath = path.map(String).join(".");

  if (RESERVATION_VALIDATION_FIELDS.has(fieldPath as ReservationActionField)) {
    return fieldPath as ReservationActionField;
  }

  return /^rooms\.\d+\.(roomTypeId|roomId|adults|children)$/.test(fieldPath)
    ? (fieldPath as ReservationActionField)
    : undefined;
}

function validationFailure(
  error: { issues: { message: string; path: PropertyKey[] }[] },
): ReservationFailure {
  const issue = error.issues[0];
  const field = issue ? reservationValidationField(issue.path) : undefined;
  const safeMessage = issue?.message
    ? SAFE_VALIDATION_MESSAGE_PREFIXES.some((prefix) =>
        issue.message.startsWith(prefix),
      )
      ? issue.message
      : undefined
    : undefined;

  return reservationFailure("INVALID_RESERVATION_DATA", {
    ...(safeMessage ? { message: safeMessage } : {}),
    ...(field ? { field } : {}),
  });
}

type ReservationMutationAction = "create" | "edit" | "cancel";

type ReservationPostCommitSideEffect =
  | "activity-log"
  | "preference-cookie"
  | "revalidate-list"
  | "revalidate-detail"
  | "revalidate-calendar";

function logUnexpectedReservationAction(
  action: "quote" | ReservationMutationAction,
  error: unknown,
) {
  console.error("Reservation action failed", { action }, error);
}

async function attemptReservationPostCommitSideEffect(
  action: ReservationMutationAction,
  sideEffect: ReservationPostCommitSideEffect,
  operation: () => unknown | Promise<unknown>,
) {
  try {
    await operation();
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Reservation post-commit side effect failed",
      { action, sideEffect },
      error,
    );
  }
}

function isRetryableReservationNumberError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

function reservationConflictFailure(roomId: number | null) {
  return roomId === null
    ? reservationFailure("RESERVATION_CONFLICT")
    : reservationFailure("ROOM_UNAVAILABLE");
}

type ReservationRoomAssignment = {
  roomType: {
    id: number;
    baseRate: Prisma.Decimal;
    capacity: number;
  };
  room: {
    id: number;
    number: string;
    roomTypeId: number;
    status: RoomStatus;
  } | null;
};

type ReservationRoomAssignmentInput = {
  roomTypeId: number;
  roomId: number | null;
  arrivalDate: Date;
  departureDate: Date;
  adults: number;
  children: number;
};

function sameDateOnly(left: Date, right: Date) {
  return (
    formatISO(dateOnlyBoundary(left), { representation: "date" }) ===
    formatISO(dateOnlyBoundary(right), { representation: "date" })
  );
}



async function validateReservationRoomAssignment(
  tx: Prisma.TransactionClient,
  input: ReservationRoomAssignmentInput,
  reservationId?: number,
): Promise<
  | { ok: true; assignment: ReservationRoomAssignment }
  | ReservationFailure
> {
  const roomType = await tx.roomType.findUnique({
    where: { id: input.roomTypeId },
    select: {
      id: true,
      baseRate: true,
      capacity: true,
    },
  });

  if (!roomType) {
    return reservationFailure("INVALID_ROOM_TYPE", { field: "roomTypeId" });
  }

  const totalGuests = input.adults + input.children;

  if (totalGuests > roomType.capacity) {
    return reservationFailure("INVALID_RESERVATION_DATA", {
      message: reservationCapacityError(totalGuests, roomType.capacity),
      field: "children",
    });
  }

  if (input.roomId === null) {
    return { ok: true, assignment: { roomType, room: null } };
  }

  await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "room" WHERE id = ${input.roomId} FOR UPDATE
  `;

  const room = await tx.room.findUnique({
    where: { id: input.roomId },
    select: {
      id: true,
      number: true,
      roomTypeId: true,
      status: true,
    },
  });

  if (!room || room.roomTypeId !== input.roomTypeId) {
    return reservationFailure("INVALID_ROOM", { field: "roomId" });
  }

  if (room.status === RoomStatus.OOO) {
    return reservationFailure("ROOM_OOO", {
      message: `Kamar ${room.number} sedang berstatus OOO dan tidak dapat dipesan.`,
      field: "roomId",
    });
  }

  const overlappingReservation = await tx.reservation.findFirst({
    where: {
      ...(reservationId ? { id: { not: reservationId } } : {}),
      roomId: room.id,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      arrivalDate: { lt: input.departureDate },
      departureDate: { gt: input.arrivalDate },
    },
    select: { id: true },
  });

  if (overlappingReservation) {
    return reservationFailure("ROOM_UNAVAILABLE", {
      message: `Kamar ${room.number} sudah tidak tersedia untuk tanggal tersebut. Pilih kamar lain.`,
      field: "roomId",
    });
  }

  return { ok: true, assignment: { roomType, room } };
}

async function currentReservationSchema() {
  const roomTypes = await prisma.roomType.findMany({
    select: { id: true, capacity: true },
  });

  return createEditReservationSchema(roomTypes);
}

async function currentUnifiedReservationSchema() {
  const roomTypes = await prisma.roomType.findMany({
    select: { id: true, capacity: true },
  });

  return createUnifiedReservationSchema(roomTypes);
}

async function createReservationNumbers(
  tx: Prisma.TransactionClient,
  count: number,
) {
  const now = new Date();
  const reservationDatePart = hotelTodayISO(now).replace(/-/g, "").slice(2);
  const reservationPrefix = `RSV-${reservationDatePart}-`;
  const reservationCount = await tx.reservation.count({
    where: { reservationNo: { startsWith: reservationPrefix } },
  });

  return Array.from(
    { length: count },
    (_, index) =>
      `${reservationPrefix}${String(reservationCount + index + 1).padStart(
        4,
        "0",
      )}`,
  );
}

function createGroupBookingId() {
  const datePart = hotelTodayISO(new Date()).replace(/-/g, "").slice(2);

  return `GRP-${datePart}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

async function runCreateReservationTransaction(
  input: UnifiedReservationValues,
  userId: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const assignments: ReservationRoomAssignment[] = [];

      for (const [roomIndex, room] of input.rooms.entries()) {
        const validatedAssignment = await validateReservationRoomAssignment(
          tx,
          {
            ...room,
            arrivalDate: input.arrivalDate,
            departureDate: input.departureDate,
          },
        );

        if (!validatedAssignment.ok) {
          const field = validatedAssignment.field;

          return field && ["roomTypeId", "roomId", "adults", "children"].includes(field)
            ? {
                ...validatedAssignment,
                field: `rooms.${roomIndex}.${field}` as ReservationActionField,
              }
            : validatedAssignment;
        }

        assignments.push(validatedAssignment.assignment);
      }

      const requestedByRoomTypeId = new Map<number, number>();

      for (const room of input.rooms) {
        requestedByRoomTypeId.set(
          room.roomTypeId,
          (requestedByRoomTypeId.get(room.roomTypeId) ?? 0) + 1,
        );
      }

      for (const [roomTypeId, requestedCount] of requestedByRoomTypeId) {
        const validatedCapacity = await validateRoomTypeCapacity(
          {
            roomTypeId,
            arrival: input.arrivalDate,
            departure: input.departureDate,
            requestedCount,
          },
          tx,
        );

        if (!validatedCapacity.ok) {
          const roomIndex = input.rooms.findIndex(
            (room) => room.roomTypeId === roomTypeId,
          );

          return reservationFailure("ROOM_UNAVAILABLE", {
            message: validatedCapacity.error,
            field: `rooms.${roomIndex}.roomTypeId`,
          });
        }
      }

      const arrivalDate = formatISO(input.arrivalDate, { representation: "date" });
      const departureDate = formatISO(input.departureDate, {
        representation: "date",
      });
      const resolvedSchedules = new Map<
        number,
        Awaited<ReturnType<typeof resolveNightlySchedule>>
      >();

      for (const roomTypeId of requestedByRoomTypeId.keys()) {
        resolvedSchedules.set(
          roomTypeId,
          await resolveNightlySchedule(
            { roomTypeId, arrivalDate, departureDate },
            tx,
          ),
        );
      }

      const guest = await tx.guest.create({
        data: {
          fullName: input.fullName,
          idType: input.idType,
          idNumber: input.idNumber,
          phone: input.phone,
          email: input.email,
          address: input.address,
          nationality: input.nationality,
        },
        select: { id: true },
      });
      const reservationNumbers = await createReservationNumbers(
        tx,
        input.rooms.length,
      );
      const groupBookingId =
        input.rooms.length > 1 ? createGroupBookingId() : null;
      const reservationIds: number[] = [];

      for (const [index, room] of input.rooms.entries()) {
        const { room: selectedRoom } = assignments[index];
        const resolvedSchedule = resolvedSchedules.get(room.roomTypeId);

        if (!resolvedSchedule?.[0]) {
          throw new PricingResolutionError("Jadwal harga reservasi tidak tersedia.");
        }

        const reservation = await tx.reservation.create({
          data: {
            reservationNo: reservationNumbers[index],
            type: ReservationUsageType.REGULAR,
            arrangementType: input.arrangementType,
            reservationType: input.reservationType,
            guestId: guest.id,
            roomTypeId: room.roomTypeId,
            roomId: selectedRoom?.id ?? null,
            groupBookingId,
            arrivalDate: input.arrivalDate,
            departureDate: input.departureDate,
            adults: room.adults,
            children: room.children,
            status: ReservationStatus.CONFIRMED,
            rateAmount: resolvedSchedule[0].rate,
            deposit: resolvedSchedule[0].rate,
            notes: input.notes,
            createdById: userId,
          },
          select: { id: true },
        });

        await tx.reservationNight.createMany({
          data: createReservationNightSchedule({
            reservationId: reservation.id,
            resolvedSchedule,
            mealSnapshot: {
              arrangementType: input.arrangementType,
              mealPax: room.adults + room.children,
            },
          }),
        });

        if (input.stayFeeKinds.length > 0) {
          await createPendingReservationStayFees(tx, {
            reservationId: reservation.id,
            kinds: input.stayFeeKinds,
            selectedById: userId,
          });
        }

        reservationIds.push(reservation.id);
      }

      return { ok: true as const, reservationIds, groupBookingId };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

async function runUpdateReservationTransaction(
  reservationId: number,
  input: EditReservationValues,
) {
  return prisma.$transaction(
    async (tx) => {
      const mealSnapshotBoundary = hotelTodayDateOnly();
      const existingReservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          guestId: true,
          roomTypeId: true,
          arrivalDate: true,
          departureDate: true,
          adults: true,
          children: true,
          arrangementType: true,
          status: true,
          reservationNights: {
            where: { date: { gte: mealSnapshotBoundary } },
            select: {
              id: true,
              folioLineItems: {
                where: {
                  article: { code: { in: [...MEAL_ARTICLE_CODES] } },
                },
                take: 1,
                select: { id: true },
              },
            },
          },
          folio: {
            select: {
              lineItems: {
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      });

      if (!existingReservation) {
        return reservationFailure("RESERVATION_NOT_FOUND");
      }

      if (
        existingReservation.status === ReservationStatus.CHECKED_OUT ||
        existingReservation.status === ReservationStatus.CANCELLED ||
        existingReservation.status === ReservationStatus.NO_SHOW
      ) {
        return reservationFailure("POST_CHECK_IN_EDIT_RESTRICTED", {
          message:
            "Reservasi yang sudah check-out, dibatalkan, atau no-show bersifat final dan tidak dapat diubah.",
        });
      }

      if (
        input.roomId === null &&
        existingReservation.status !== ReservationStatus.CONFIRMED
      ) {
        return reservationFailure("POST_CHECK_IN_EDIT_RESTRICTED", {
          message: "Kamar wajib dipilih untuk reservasi yang sudah check-in.",
          field: "roomId",
        });
      }

      const validatedAssignment = await validateReservationRoomAssignment(
        tx,
        input,
        reservationId,
      );

      if (!validatedAssignment.ok) {
        return validatedAssignment;
      }

      const { room } = validatedAssignment.assignment;
      const isMealSnapshotRelevant =
        existingReservation.adults !== input.adults ||
        existingReservation.children !== input.children;
      const isPricingRelevant =
        existingReservation.roomTypeId !== input.roomTypeId ||
        !sameDateOnly(existingReservation.arrivalDate, input.arrivalDate) ||
        !sameDateOnly(existingReservation.departureDate, input.departureDate);

      if (isPricingRelevant) {
        if (existingReservation.status === ReservationStatus.CHECKED_IN) {
          return reservationFailure("POST_CHECK_IN_EDIT_RESTRICTED", {
            message:
              "Tipe kamar dan tanggal menginap tidak dapat diubah setelah check-in.",
          });
        }

        if (existingReservation.status !== ReservationStatus.CONFIRMED) {
          return reservationFailure("POST_CHECK_IN_EDIT_RESTRICTED", {
            message:
              "Perubahan tipe kamar atau tanggal menginap hanya dapat dilakukan pada reservasi berstatus CONFIRMED.",
          });
        }

        if (existingReservation.folio?.lineItems.length) {
          return reservationFailure("POST_CHECK_IN_EDIT_RESTRICTED", {
            message:
              "Tipe kamar dan tanggal menginap tidak dapat diubah setelah tagihan folio diposting.",
          });
        }
      }

      let resolvedSchedule: Awaited<ReturnType<typeof resolveNightlySchedule>> | null =
        null;

      if (isPricingRelevant) {
        const validatedCapacity = await validateRoomTypeCapacity(
          {
            roomTypeId: input.roomTypeId,
            arrival: input.arrivalDate,
            departure: input.departureDate,
            excludeReservationId: reservationId,
          },
          tx,
        );

        if (!validatedCapacity.ok) {
          return reservationFailure("ROOM_UNAVAILABLE", {
            message: validatedCapacity.error,
            field: validatedCapacity.field,
          });
        }

        resolvedSchedule = await resolveNightlySchedule(
          {
            roomTypeId: input.roomTypeId,
            arrivalDate: formatISO(input.arrivalDate, { representation: "date" }),
            departureDate: formatISO(input.departureDate, {
              representation: "date",
            }),
          },
          tx,
        );

        if (!resolvedSchedule[0]) {
          throw new PricingResolutionError("Jadwal harga reservasi tidak tersedia.");
        }
      }

      await tx.guest.update({
        where: { id: existingReservation.guestId },
        data: {
          fullName: input.fullName,
          idType: input.idType,
          idNumber: input.idNumber,
          phone: input.phone,
          email: input.email,
          address: input.address,
          nationality: input.nationality,
        },
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          roomTypeId: input.roomTypeId,
          roomId: room?.id ?? null,
          arrivalDate: input.arrivalDate,
          departureDate: input.departureDate,
          adults: input.adults,
          children: input.children,
          ...(resolvedSchedule
            ? {
                rateAmount: resolvedSchedule[0].rate,
                deposit: resolvedSchedule[0].rate,
              }
            : {}),
          notes: input.notes,
          reservationType: input.reservationType,
        },
      });

      if (resolvedSchedule) {
        await tx.reservationNight.deleteMany({
          where: { reservationId },
        });
        await tx.reservationNight.createMany({
          data: createReservationNightSchedule({
            reservationId,
            resolvedSchedule,
            mealSnapshot: {
              arrangementType: existingReservation.arrangementType,
              mealPax: input.adults + input.children,
            },
          }),
        });
      } else if (isMealSnapshotRelevant) {
        const eligibleNightIds = existingReservation.reservationNights
          .filter((night) => night.folioLineItems.length === 0)
          .map((night) => night.id);

        if (eligibleNightIds.length > 0) {
          await tx.reservationNight.updateMany({
            where: {
              id: { in: eligibleNightIds },
              reservationId,
              date: { gte: mealSnapshotBoundary },
              folioLineItems: {
                none: {
                  article: { code: { in: [...MEAL_ARTICLE_CODES] } },
                },
              },
            },
            data: createReservationNightMealSnapshot(
              existingReservation.arrangementType,
              input.adults + input.children,
            ),
          });
        }
      }

      return { ok: true as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

export async function getReservationQuote(
  input: unknown,
): Promise<ReservationQuoteResult> {
  let session: Session | null;

  try {
    session = await auth();
  } catch (error) {
    unstable_rethrow(error);
    logUnexpectedReservationAction("quote", error);
    return unexpectedReservationFailure("quote");
  }

  const authorizationFailure = reservationAuthorizationFailure(session, ["FO"]);

  if (authorizationFailure) {
    return authorizationFailure;
  }

  const parsed = ReservationQuoteSchema.safeParse(input);

  if (!parsed.success) {
    return reservationFailure("INVALID_RESERVATION_DATA", {
      message: "Data ringkasan harga tidak valid. Periksa kembali formulir.",
    });
  }

  try {
    const schedules = new Map<
      number,
      Awaited<ReturnType<typeof resolveNightlySchedule>>
    >();

    for (const roomTypeId of new Set(parsed.data.rooms.map((room) => room.roomTypeId))) {
      schedules.set(
        roomTypeId,
        await resolveNightlySchedule({
          roomTypeId,
          arrivalDate: parsed.data.arrivalDate,
          departureDate: parsed.data.departureDate,
        }),
      );
    }

    const deposits: string[] = [];
    const inclusionRooms: Array<{
      pax: number;
      nights: number;
      unitPrice: string;
      total: string;
    }> = [];
    let roomTotal = new Prisma.Decimal(0);
    let inclusionTotal = new Prisma.Decimal(0);

    for (const room of parsed.data.rooms) {
      const schedule = schedules.get(room.roomTypeId);
      const firstNight = schedule?.[0];

      if (!schedule || !firstNight) {
        throw new PricingResolutionError("Jadwal harga reservasi tidak tersedia.");
      }

      deposits.push(firstNight.rate.toString());
      roomTotal = schedule.reduce(
        (total, night) => total.plus(night.rate),
        roomTotal,
      );

      const pax = room.adults + room.children;
      const nightlyMealSnapshot = createReservationNightMealSnapshot(
        parsed.data.arrangementType,
        pax,
      );
      const unitPrice = new Prisma.Decimal(
        nightlyMealSnapshot.mealUnitPrice ?? 0,
      );
      const nightlyAmount = new Prisma.Decimal(
        nightlyMealSnapshot.mealAmount ?? 0,
      );
      const roomInclusionTotal = nightlyAmount.mul(schedule.length);

      inclusionRooms.push({
        pax,
        nights: schedule.length,
        unitPrice: unitPrice.toString(),
        total: roomInclusionTotal.toString(),
      });
      inclusionTotal = inclusionTotal.plus(roomInclusionTotal);
    }

    return {
      ok: true,
      roomTotal: roomTotal.toString(),
      inclusionTotal: inclusionTotal.toString(),
      reservationTotal: roomTotal.plus(inclusionTotal).toString(),
      deposits,
      inclusionRooms,
    };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof PricingResolutionError)) {
      logUnexpectedReservationAction("quote", error);
    }

    return reservationFailure("PRICING_QUOTE_FAILED");
  }
}

export async function createReservation(
  input: unknown,
  originView: unknown = "list",
): Promise<ReservationActionResult> {
  let session: Session | null;

  try {
    session = await auth();
  } catch (error) {
    unstable_rethrow(error);
    logUnexpectedReservationAction("create", error);
    return unexpectedReservationFailure("create");
  }

  const authorizationFailure = reservationAuthorizationFailure(session, ["FO"]);

  if (authorizationFailure) {
    return authorizationFailure;
  }

  let schema: Awaited<ReturnType<typeof currentUnifiedReservationSchema>>;

  try {
    schema = await currentUnifiedReservationSchema();
  } catch (error) {
    unstable_rethrow(error);
    logUnexpectedReservationAction("create", error);
    return unexpectedReservationFailure("create");
  }

  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const userId = Number(session?.user.id);
  let result: Awaited<ReturnType<typeof runCreateReservationTransaction>> | null =
    null;
  let retriedAfterConflict = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCreateReservationTransaction(parsed.data, userId);
      break;
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof PricingResolutionError) {
        return reservationFailure("PRICING_QUOTE_FAILED");
      }

      if (error instanceof ReservationStayFeeError) {
        return reservationFailure("STAY_FEE_UNAVAILABLE", {
          field: "stayFeeKinds",
        });
      }

      if (attempt < 2 && isRetryableReservationNumberError(error)) {
        retriedAfterConflict = true;
        continue;
      }

      if (retriedAfterConflict || isSerializationConflict(error)) {
        const firstRoomId = parsed.data.rooms[0]?.roomId ?? null;

        return parsed.data.rooms.length === 1
          ? reservationConflictFailure(firstRoomId)
          : reservationFailure("RESERVATION_CONFLICT");
      }

      logUnexpectedReservationAction("create", error);
      return unexpectedReservationFailure("create");
    }
  }

  if (!result) {
    const error = new Error("Reservation create retry loop completed without a result");
    logUnexpectedReservationAction("create", error);
    return unexpectedReservationFailure("create");
  }

  if (!result.ok) {
    return result;
  }

  const arrival = formatISO(parsed.data.arrivalDate, { representation: "date" });
  const origin =
    parseFoReservasiView(typeof originView === "string" ? originView : undefined) ??
    "list";

  for (const reservationId of result.reservationIds) {
    await attemptReservationPostCommitSideEffect(
      "create",
      "activity-log",
      () =>
        logActivity({
          userId,
          action: "RESERVATION_CREATED",
          reservationId,
        }),
    );
  }

  await attemptReservationPostCommitSideEffect(
    "create",
    "preference-cookie",
    () => persistFoReservasiView(origin),
  );
  await attemptReservationPostCommitSideEffect("create", "revalidate-list", () =>
    revalidatePath(FO_RESERVASI_VIEW_PATHS.list),
  );
  await attemptReservationPostCommitSideEffect(
    "create",
    "revalidate-calendar",
    () => revalidatePath(FO_RESERVASI_VIEW_PATHS.kalender),
  );
  redirect(reservationCreateRedirectPath(origin, arrival));
}

export async function cancelReservation(
  reservationId: number,
): Promise<ReservationActionResult> {
  let session: Session | null;

  try {
    session = await auth();
  } catch (error) {
    unstable_rethrow(error);
    logUnexpectedReservationAction("cancel", error);
    return unexpectedReservationFailure("cancel");
  }

  // Cancel is permitted for FO (who own the screen) and ADMIN.
  const authorizationFailure = reservationAuthorizationFailure(session, [
    "FO",
    "ADMIN",
  ]);

  if (authorizationFailure) {
    return authorizationFailure;
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return reservationFailure("INVALID_RESERVATION_DATA");
  }

  const userId = Number(session?.user.id);
  let result: ReservationActionResult;

  try {
    result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: {
            id: true,
            status: true,
            folio: { select: { id: true } },
          },
        });

        if (!reservation) {
          return reservationFailure("RESERVATION_NOT_FOUND");
        }

        // Re-verify server-side; never trust the client's view of status.
        if (reservation.status !== ReservationStatus.CONFIRMED) {
          return reservationFailure("CANCELLATION_FAILED", {
            message:
              "Hanya reservasi berstatus CONFIRMED yang dapat dibatalkan.",
          });
        }

        // A CONFIRMED reservation should have no folio (created at check-in).
        // If one somehow exists, do NOT cancel and do NOT delete it.
        if (reservation.folio) {
          return reservationFailure("CANCELLATION_FAILED", {
            message:
              "Reservasi ini sudah memiliki folio. Periksa folio sebelum mencoba membatalkan reservasi.",
          });
        }

        const updated = await tx.reservation.updateMany({
          where: { id: reservationId, status: ReservationStatus.CONFIRMED },
          data: { status: ReservationStatus.CANCELLED },
        });

        if (updated.count === 0) {
          return reservationFailure("RESERVATION_CONFLICT");
        }

        await cancelPendingReservationStayFees(tx, reservationId);

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );
  } catch (error) {
    unstable_rethrow(error);
    if (isSerializationConflict(error)) {
      return reservationFailure("RESERVATION_CONFLICT");
    }

    logUnexpectedReservationAction("cancel", error);
    return unexpectedReservationFailure("cancel");
  }

  if (!result.ok) {
    return result;
  }

  await attemptReservationPostCommitSideEffect("cancel", "activity-log", () =>
    logActivity({
      userId,
      action: "RESERVATION_CANCELLED",
      reservationId,
    }),
  );
  await attemptReservationPostCommitSideEffect("cancel", "revalidate-list", () =>
    revalidatePath(FO_RESERVASI_VIEW_PATHS.list),
  );
  await attemptReservationPostCommitSideEffect(
    "cancel",
    "revalidate-detail",
    () => revalidatePath(`/app/fo/reservasi/${reservationId}`),
  );
  await attemptReservationPostCommitSideEffect(
    "cancel",
    "revalidate-calendar",
    () => revalidatePath(FO_RESERVASI_VIEW_PATHS.kalender),
  );
  return { ok: true };
}

export async function updateReservation(
  reservationId: number,
  input: unknown,
): Promise<ReservationActionResult> {
  let session: Session | null;

  try {
    session = await auth();
  } catch (error) {
    unstable_rethrow(error);
    logUnexpectedReservationAction("edit", error);
    return unexpectedReservationFailure("edit");
  }

  const authorizationFailure = reservationAuthorizationFailure(session, ["FO"]);

  if (authorizationFailure) {
    return authorizationFailure;
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return reservationFailure("INVALID_RESERVATION_DATA");
  }

  let schema: Awaited<ReturnType<typeof currentReservationSchema>>;

  try {
    schema = await currentReservationSchema();
  } catch (error) {
    unstable_rethrow(error);
    logUnexpectedReservationAction("edit", error);
    return unexpectedReservationFailure("edit");
  }

  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const userId = Number(session?.user.id);
  let result: Awaited<ReturnType<typeof runUpdateReservationTransaction>> | null =
    null;

  try {
    result = await runUpdateReservationTransaction(reservationId, parsed.data);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof PricingResolutionError) {
      return reservationFailure("PRICING_QUOTE_FAILED");
    }

    if (isSerializationConflict(error)) {
      return reservationConflictFailure(parsed.data.roomId);
    }

    logUnexpectedReservationAction("edit", error);
    return unexpectedReservationFailure("edit");
  }

  if (!result.ok) {
    return result;
  }

  await attemptReservationPostCommitSideEffect("edit", "activity-log", () =>
    logActivity({
      userId,
      action: "RESERVATION_UPDATED",
      reservationId,
    }),
  );
  await attemptReservationPostCommitSideEffect("edit", "revalidate-list", () =>
    revalidatePath(FO_RESERVASI_VIEW_PATHS.list),
  );
  await attemptReservationPostCommitSideEffect(
    "edit",
    "revalidate-detail",
    () => revalidatePath(`/app/fo/reservasi/${reservationId}`),
  );
  await attemptReservationPostCommitSideEffect(
    "edit",
    "revalidate-calendar",
    () => revalidatePath(FO_RESERVASI_VIEW_PATHS.kalender),
  );
  redirect(`/app/fo/reservasi/${reservationId}?mode=view`);
}
