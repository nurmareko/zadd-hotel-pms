"use server";

import {
  ArrangementType,
  DepositStatus,
  GuestIdType,
  PaymentPurpose,
  Prisma,
  ReservationStatus,
  ReservationType,
  RoomStatus,
} from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  logActionFailure,
  rethrowFrameworkErrors,
  runPostCommitSideEffects,
} from "@/lib/action-errors";
import { logActivity } from "@/lib/activity-log";
// Prisma @db.Date filters require dateOnlyBoundary (UTC midnight).
// Timestamp filters (createdAt, receivedAt, etc.) use startOfDay (local midnight).
import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
import { formatDateID } from "@/lib/format";
import {
  buildGrcSnapshot,
  GRC_SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/grc-snapshot";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  postPendingReservationStayFees,
  ReservationStayFeeError,
} from "@/lib/reservation-stay-fees";
import {
  CHECK_IN_FAILURE_MESSAGES,
  checkInAuthorizationFailure,
  checkInFailure,
  type CheckInActionField,
  type CheckInFailure,
  type CheckInFailureCode,
} from "./errors";
import {
  CheckInSchema,
  DepositCollectionSchema,
  type CheckInValues,
  type DepositCollectionValues,
} from "./schema";

export type ActionResult = { ok: true } | CheckInFailure;

export type CollectDepositResult =
  | {
      ok: true;
      payment: {
        amount: string;
        method: string;
        reference: string | null;
      };
      alreadyCollected: boolean;
    }
  | CheckInFailure;

export type CheckInReviewData = {
  snapshotVersion: string;
  reservationId: number;
  reservationNo: string;
  reservationType: ReservationType;
  arrangementType: ArrangementType;
  status: ReservationStatus;
  arrivalDue: boolean;
  guest: {
    fullName: string;
    idType: GuestIdType | null;
    idNumber: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
  };
  stay: {
    arrivalLabel: string;
    departureLabel: string;
    nights: number;
    adults: number;
    children: number;
    total: string;
    nightlySchedule: Array<{
      dateLabel: string;
      rateAmount: string;
    }>;
  };
  room: {
    id: number;
    number: string;
    status: RoomStatus;
    typeName: string;
  } | null;
  roomReady: boolean;
  deposit: {
    status: DepositStatus;
    requiredAmount: string | null;
    payment: {
      amount: string;
      method: string;
      reference: string | null;
    } | null;
  };
};

export type CheckInReviewResult =
  | { ok: true; review: CheckInReviewData }
  | CheckInFailure;

type CompleteCheckInOptions = {
  /**
   * Individual check-in redirects to `/app/fo/reservasi`. Batch orchestration
   * suppresses that redirect to remain on the group summary.
   */
  redirectAfterCheckIn?: boolean;
};

const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

type CheckInContext = {
  reservation: {
    id: number;
    roomTypeId: number;
    guestId: number;
    arrivalDate: Date;
    departureDate: Date;
    status: ReservationStatus;
  };
  room: {
    id: number;
    number: string;
    roomTypeId: number;
    status: RoomStatus;
  };
  arrivalDate: Date;
  departureDate: Date;
};

class CheckInDomainError extends Error {
  readonly code: CheckInFailureCode;
  readonly field?: CheckInActionField;

  constructor(
    code: CheckInFailureCode,
    options?: { field?: CheckInActionField; message?: string },
  ) {
    super(options?.message ?? CHECK_IN_FAILURE_MESSAGES[code]);
    this.name = "CheckInDomainError";
    this.code = code;
    this.field = options?.field;
  }
}

function isRetryableFolioNumberError(error: unknown) {
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

export async function getCheckInReviewData(
  input: number | { reservationId: number },
): Promise<CheckInReviewResult> {
  const session = await auth();
  const authFailure = checkInAuthorizationFailure(session, ["FO"]);
  if (authFailure) {
    return authFailure;
  }

  const reservationId =
    typeof input === "number" ? input : input?.reservationId;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return checkInFailure("INVALID_INPUT", {
      field: "reservationId",
      message: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
    });
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        reservationNo: true,
        reservationType: true,
        arrangementType: true,
        roomTypeId: true,
        arrivalDate: true,
        departureDate: true,
        adults: true,
        children: true,
        status: true,
        depositStatus: true,
        rateAmount: true,
        updatedAt: true,
        guest: {
          select: {
            fullName: true,
            idType: true,
            idNumber: true,
            phone: true,
            email: true,
            nationality: true,
          },
        },
        room: {
          select: {
            id: true,
            number: true,
            status: true,
            roomTypeId: true,
          },
        },
        roomType: { select: { name: true } },
        folio: {
          select: {
            payments: {
              where: { purpose: PaymentPurpose.DEPOSIT },
              select: { amount: true, method: true, reference: true },
              orderBy: { receivedAt: "asc" },
              take: 1,
            },
          },
        },
        reservationNights: {
          select: { date: true, rateAmount: true },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!reservation) {
      return checkInFailure("RESERVATION_NOT_FOUND");
    }

    const roomOverlap = reservation.room
      ? await prisma.reservation.findFirst({
          where: {
            id: { not: reservation.id },
            roomId: reservation.room.id,
            status: {
              in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
            },
            arrivalDate: { lt: reservation.departureDate },
            departureDate: { gt: reservation.arrivalDate },
          },
          select: { id: true },
        })
      : null;
    const stayTotal = flatReservationNightStayTotal({
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      rateAmount: reservation.rateAmount,
      reservationNights: reservation.reservationNights,
    });
    const depositPayment = reservation.folio?.payments[0] ?? null;
    const firstNight = reservation.reservationNights[0] ?? null;
    const { today } = todayDateOnly();
    const roomReady = Boolean(
      reservation.room &&
        reservation.room.roomTypeId === reservation.roomTypeId &&
        reservation.room.status !== RoomStatus.OOO &&
        !roomOverlap,
    );

    return {
      ok: true,
      review: {
        snapshotVersion: reservation.updatedAt.toISOString(),
        reservationId: reservation.id,
        reservationNo: reservation.reservationNo,
        reservationType: reservation.reservationType,
        arrangementType: reservation.arrangementType,
        status: reservation.status,
        arrivalDue: dateOnlyBoundary(reservation.arrivalDate) <= today,
        guest: reservation.guest,
        stay: {
          arrivalLabel: formatDateID(reservation.arrivalDate),
          departureLabel: formatDateID(reservation.departureDate),
          nights: differenceInCalendarDays(
            reservation.departureDate,
            reservation.arrivalDate,
          ),
          adults: reservation.adults,
          children: reservation.children,
          total: stayTotal.total.toString(),
          nightlySchedule: stayTotal.nightlySchedule.map((night) => ({
            dateLabel: formatDateID(night.date),
            rateAmount: night.rateAmount.toString(),
          })),
        },
        room: reservation.room
          ? {
              id: reservation.room.id,
              number: reservation.room.number,
              status: reservation.room.status,
              typeName: reservation.roomType.name,
            }
          : null,
        roomReady,
        deposit: {
          status: reservation.depositStatus,
          requiredAmount: firstNight?.rateAmount.toString() ?? null,
          payment: depositPayment
            ? {
                amount: depositPayment.amount.toString(),
                method: depositPayment.method,
                reference: depositPayment.reference,
              }
            : null,
        },
      },
    };
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("getCheckInReviewData", error, {
      action: "getCheckInReviewData",
      stage: "review",
      reservationId,
    });
    return checkInFailure("REVIEW_UNEXPECTED");
  }
}

export const getFreshCheckInReview = getCheckInReviewData;

async function prepareCheckInContext(
  input: CheckInValues,
): Promise<
  | { ok: true; context: CheckInContext }
  | CheckInFailure
> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      id: true,
      roomTypeId: true,
      guestId: true,
      arrivalDate: true,
      departureDate: true,
      status: true,
    },
  });

  if (!reservation) {
    return checkInFailure("RESERVATION_NOT_FOUND");
  }

  if (reservation.status !== ReservationStatus.CONFIRMED) {
    return checkInFailure("RESERVATION_NOT_ELIGIBLE");
  }

  const arrivalDate = dateOnlyBoundary(reservation.arrivalDate);
  const departureDate = dateOnlyBoundary(reservation.departureDate);
  const { today } = todayDateOnly();

  if (arrivalDate > today) {
    return checkInFailure("ARRIVAL_NOT_DUE");
  }

  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: { id: true, number: true, roomTypeId: true, status: true },
  });

  if (!room) {
    return checkInFailure("ROOM_REQUIRED", { field: "roomId" });
  }

  if (room.roomTypeId !== reservation.roomTypeId) {
    return checkInFailure("ROOM_TYPE_MISMATCH", { field: "roomId" });
  }

  if (room.status === RoomStatus.OOO) {
    return checkInFailure("ROOM_OOO", { field: "roomId" });
  }

  const overlappingReservation = await prisma.reservation.findFirst({
    where: {
      id: { not: reservation.id },
      roomId: room.id,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      arrivalDate: { lt: departureDate },
      departureDate: { gt: arrivalDate },
    },
    select: { id: true },
  });

  if (overlappingReservation) {
    return checkInFailure("ROOM_UNAVAILABLE", { field: "roomId" });
  }

  return {
    ok: true,
    context: { reservation, room, arrivalDate, departureDate },
  };
}

async function nextFolioNumber(now: Date) {
  const folioPrefix = `FOL-${format(now, "ddMM")}-`;
  const folioCount = await prisma.folio.count({
    where: { folioNo: { startsWith: folioPrefix } },
  });

  return `${folioPrefix}${String(folioCount + 1).padStart(4, "0")}`;
}

async function runCheckInTransaction(
  input: CheckInValues,
  context: CheckInContext,
  userId: number,
) {
  const { reservation, room, arrivalDate, departureDate } = context;
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const overlappingReservation = await tx.reservation.findFirst({
        where: {
          id: { not: reservation.id },
          roomId: room.id,
          status: { in: ACTIVE_RESERVATION_STATUSES },
          arrivalDate: { lt: departureDate },
          departureDate: { gt: arrivalDate },
        },
        select: { id: true },
      });

      if (overlappingReservation) {
        throw new CheckInDomainError("ROOM_UNAVAILABLE", {
          field: "roomId",
        });
      }

      const firstNight = await tx.reservationNight.findFirst({
        where: { reservationId: reservation.id },
        orderBy: { date: "asc" },
        select: { rateAmount: true },
      });

      if (!firstNight) {
        throw new CheckInDomainError("DEPOSIT_RATE_UNAVAILABLE");
      }

      const depositAmount = firstNight.rateAmount;
      const currentReservation = await tx.reservation.findUnique({
        where: { id: reservation.id },
        select: {
          status: true,
          depositStatus: true,
          folio: {
            select: {
              id: true,
              payments: {
                where: { purpose: PaymentPurpose.DEPOSIT },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });

      if (!currentReservation) {
        throw new CheckInDomainError("RESERVATION_NOT_FOUND");
      }

      if (currentReservation.status !== ReservationStatus.CONFIRMED) {
        throw new CheckInDomainError("RESERVATION_NOT_ELIGIBLE");
      }

      if (currentReservation.depositStatus === DepositStatus.PENDING) {
        throw new CheckInDomainError("DEPOSIT_REQUIRED");
      }

      if (!currentReservation.folio) {
        throw new CheckInDomainError("DEPOSIT_FOLIO_MISSING");
      }

      if (currentReservation.folio.payments.length === 0) {
        throw new CheckInDomainError("DEPOSIT_STATE_INCONSISTENT");
      }

      await tx.guest.update({
        where: { id: reservation.guestId },
        data: {
          fullName: input.guestFullName,
          idType: input.guestIdType,
          idNumber: input.guestIdNumber || null,
          phone: input.guestPhone || null,
          email: input.guestEmail || null,
          nationality: input.guestNationality || null,
        },
      });

      const updatedReservation = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.COLLECTED,
        },
        data: {
          status: ReservationStatus.CHECKED_IN,
          roomId: room.id,
          grcFilledAt: now,
          purposeOfVisit: input.grcPurposeOfVisit,
          signatureDataUrl: input.signatureDataUrl,
          signedAt: now,
          deposit: depositAmount,
        },
      });

      if (updatedReservation.count === 0) {
        throw new CheckInDomainError("CHECK_IN_CONFLICT");
      }

      const [snapshotReservation, checkInOperator, hotelSettings] =
        await Promise.all([
          tx.reservation.findUniqueOrThrow({
            where: { id: reservation.id },
            select: {
              reservationNo: true,
              arrivalDate: true,
              departureDate: true,
              arrangementType: true,
              reservationType: true,
              adults: true,
              children: true,
              rateAmount: true,
              purposeOfVisit: true,
              grcFilledAt: true,
              signatureDataUrl: true,
              signedAt: true,
              grcSnapshot: true,
              folio: { select: { folioNo: true } },
              guest: {
                select: {
                  fullName: true,
                  idType: true,
                  idNumber: true,
                  phone: true,
                  email: true,
                  nationality: true,
                },
              },
              room: { select: { number: true } },
              roomType: { select: { name: true } },
              reservationNights: {
                select: { date: true, rateAmount: true },
                orderBy: { date: "asc" },
              },
            },
          }),
          tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { fullName: true },
          }),
          tx.hotelSettings.findUnique({
            where: { id: 1 },
            select: { address: true },
          }),
        ]);

      if (snapshotReservation.grcSnapshot === null) {
        const snapshot = buildGrcSnapshot({
          reservation: snapshotReservation,
          hotelAddress: hotelSettings?.address ?? null,
          filledByName: checkInOperator.fullName,
          capturedAt: now,
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            grcSnapshot: snapshot as Prisma.InputJsonValue,
            grcSnapshotVersion: GRC_SNAPSHOT_SCHEMA_VERSION,
          },
        });
      }

      const updatedRoom = await tx.room.updateMany({
        where: {
          id: room.id,
          roomTypeId: reservation.roomTypeId,
          status: { not: RoomStatus.OOO },
        },
        data: { status: RoomStatus.OC },
      });

      if (updatedRoom.count === 0) {
        throw new CheckInDomainError("ROOM_OOO", {
          field: "roomId",
        });
      }

      try {
        await postPendingReservationStayFees(tx, {
          reservationId: reservation.id,
          folioId: currentReservation.folio.id,
          postedById: userId,
          postedAt: now,
        });
      } catch (stayFeeError) {
        if (stayFeeError instanceof ReservationStayFeeError) {
          logActionFailure("completeCheckIn:stay-fee", stayFeeError, {
            action: "completeCheckIn",
            stage: "stay-fee",
            reservationId: reservation.id,
            committed: false,
          });
          throw new CheckInDomainError("STAY_FEE_UNAVAILABLE");
        }
        throw stayFeeError;
      }

      return { ok: true as const, folioId: currentReservation.folio.id };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

async function runDepositCollectionTransaction(
  input: DepositCollectionValues,
  userId: number,
  expectedGroupBookingId?: string,
) {
  const now = new Date();
  const folioNo = await nextFolioNumber(now);

  return prisma.$transaction(
    async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          status: true,
          depositStatus: true,
          arrivalDate: true,
          groupBookingId: true,
          folio: {
            select: {
              id: true,
              payments: {
                where: { purpose: PaymentPurpose.DEPOSIT },
                select: { amount: true, method: true, reference: true },
                take: 1,
              },
            },
          },
          reservationNights: {
            orderBy: { date: "asc" },
            select: { rateAmount: true },
            take: 1,
          },
        },
      });

      if (!reservation) {
        throw new CheckInDomainError("RESERVATION_NOT_FOUND");
      }

      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new CheckInDomainError("DEPOSIT_NOT_ELIGIBLE");
      }

      if (
        expectedGroupBookingId !== undefined &&
        reservation.groupBookingId !== expectedGroupBookingId
      ) {
        throw new CheckInDomainError("DEPOSIT_NOT_ELIGIBLE");
      }

      const existingPayment = reservation.folio?.payments[0];
      if (reservation.depositStatus === DepositStatus.COLLECTED) {
        if (!existingPayment) {
          throw new CheckInDomainError("DEPOSIT_STATE_INCONSISTENT");
        }

        return {
          payment: {
            amount: existingPayment.amount,
            method: existingPayment.method,
            reference: existingPayment.reference,
          },
          alreadyCollected: true,
        };
      }

      const { today } = todayDateOnly();
      if (dateOnlyBoundary(reservation.arrivalDate) > today) {
        throw new CheckInDomainError("ARRIVAL_NOT_DUE");
      }

      const firstNight = reservation.reservationNights[0];
      if (!firstNight) {
        throw new CheckInDomainError("DEPOSIT_RATE_UNAVAILABLE");
      }

      if (!firstNight.rateAmount.isPositive()) {
        throw new CheckInDomainError("DEPOSIT_RATE_UNAVAILABLE");
      }

      if (existingPayment) {
        throw new CheckInDomainError("DEPOSIT_STATE_INCONSISTENT");
      }

      const folio = reservation.folio
        ? { id: reservation.folio.id }
        : await tx.folio.create({
            data: {
              folioNo,
              reservationId: input.reservationId,
              status: "OPEN",
              openedAt: now,
            },
            select: { id: true },
          });
      const payment = await tx.payment.create({
        data: {
          folioId: folio.id,
          amount: firstNight.rateAmount,
          method: input.depositMethod,
          purpose: PaymentPurpose.DEPOSIT,
          reference: input.depositReference,
          receivedById: userId,
          receivedAt: now,
        },
        select: { amount: true, method: true, reference: true },
      });
      const collectedReservation = await tx.reservation.updateMany({
        where: {
          id: input.reservationId,
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.PENDING,
        },
        data: {
          deposit: firstNight.rateAmount,
          depositStatus: DepositStatus.COLLECTED,
        },
      });

      if (collectedReservation.count === 0) {
        throw new CheckInDomainError("DEPOSIT_CONFLICT");
      }

      return { payment, alreadyCollected: false };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

async function collectValidatedDeposit(
  input: DepositCollectionValues,
  userId: number,
  expectedGroupBookingId?: string,
): Promise<CollectDepositResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await runDepositCollectionTransaction(
        input,
        userId,
        expectedGroupBookingId,
      );

      return {
        ok: true,
        payment: {
          amount: result.payment.amount.toString(),
          method: result.payment.method,
          reference: result.payment.reference,
        },
        alreadyCollected: result.alreadyCollected,
      };
    } catch (error) {
      if (error instanceof CheckInDomainError) {
        return checkInFailure(error.code, {
          field: error.field,
          message: error.message,
        });
      }

      if (attempt < 2 && isRetryableFolioNumberError(error)) {
        continue;
      }

      if (isSerializationConflict(error)) {
        return checkInFailure("DEPOSIT_CONFLICT");
      }

      rethrowFrameworkErrors(error);
      logActionFailure("collectCheckInDeposit", error, {
        action: "collectCheckInDeposit",
        stage: "transaction",
        reservationId: input.reservationId,
        attempt,
        committed: false,
      });

      return checkInFailure("DEPOSIT_UNEXPECTED");
    }
  }

  return checkInFailure("DEPOSIT_UNEXPECTED");
}

export async function collectCheckInDepositForGroup(input: {
  reservationId: number;
  depositMethod: string;
  depositReference?: string;
  groupBookingId: string;
}): Promise<CollectDepositResult> {
  const session = await auth();
  const authFailure = checkInAuthorizationFailure(session, ["FO"]);
  if (authFailure || !session?.user) {
    return authFailure ?? checkInFailure("SESSION_EXPIRED");
  }

  const parsed = DepositCollectionSchema.safeParse(input);
  const groupBookingId =
    typeof input.groupBookingId === "string"
      ? input.groupBookingId.trim()
      : "";
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return checkInFailure("INVALID_INPUT", {
      field,
      message: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
    });
  }
  if (!groupBookingId) {
    return checkInFailure("INVALID_INPUT", {
      field: "groupBookingId",
      message: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
    });
  }

  return collectValidatedDeposit(
    parsed.data,
    Number(session.user.id),
    groupBookingId,
  );
}

export async function collectCheckInDeposit(
  formData: FormData,
): Promise<CollectDepositResult> {
  const session = await auth();
  const authFailure = checkInAuthorizationFailure(session, ["FO"]);
  if (authFailure || !session?.user) {
    return authFailure ?? checkInFailure("SESSION_EXPIRED");
  }

  const parsed = DepositCollectionSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return checkInFailure("INVALID_INPUT", {
      field,
      message: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
    });
  }

  const result = await collectValidatedDeposit(
    parsed.data,
    Number(session.user.id),
  );
  if (!result.ok) {
    return result;
  }

  await runPostCommitSideEffects(
    [
      {
        name: "revalidate:reservation",
        run: () =>
          revalidatePath(`/app/fo/reservasi/${parsed.data.reservationId}`),
      },
    ],
    {
      action: "collectCheckInDeposit",
      stage: "post-commit",
      reservationId: parsed.data.reservationId,
      committed: true,
    },
  );

  return result;
}

export async function completeCheckIn(
  formData: FormData,
  options: CompleteCheckInOptions = {},
): Promise<ActionResult> {
  const session = await auth();
  const authFailure = checkInAuthorizationFailure(session, ["FO"]);
  if (authFailure || !session?.user) {
    return authFailure ?? checkInFailure("SESSION_EXPIRED");
  }

  const parsed = CheckInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    if (
      field === "signatureDataUrl" ||
      field === "arrivalConfirmation" ||
      field === "purposeOfVisit" ||
      field === "purposeOfVisitOther"
    ) {
      return checkInFailure("GRC_INCOMPLETE", { field });
    }
    if (field === "roomId") {
      return checkInFailure("ROOM_REQUIRED", { field: "roomId" });
    }
    return checkInFailure("INVALID_INPUT", {
      field,
      message: CHECK_IN_FAILURE_MESSAGES.INVALID_INPUT,
    });
  }

  const userId = Number(session.user.id);
  let prepared: Awaited<ReturnType<typeof prepareCheckInContext>>;
  try {
    prepared = await prepareCheckInContext(parsed.data);
  } catch (error) {
    rethrowFrameworkErrors(error);
    logActionFailure("completeCheckIn", error, {
      action: "completeCheckIn",
      stage: "prepare",
      reservationId: parsed.data.reservationId,
      committed: false,
    });
    return checkInFailure("CHECK_IN_UNEXPECTED");
  }

  if (!prepared.ok) {
    return prepared;
  }

  let result: { ok: true; folioId: number } | null = null;
  let retriedAfterConflict = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCheckInTransaction(
        parsed.data,
        prepared.context,
        userId,
      );
      break;
    } catch (error) {
      if (error instanceof CheckInDomainError) {
        return checkInFailure(error.code, {
          field: error.field,
          message: error.message,
        });
      }

      if (error instanceof ReservationStayFeeError) {
        logActionFailure("completeCheckIn", error, {
          action: "completeCheckIn",
          stage: "stay-fee",
          reservationId: parsed.data.reservationId,
          attempt,
          committed: false,
        });
        return checkInFailure("STAY_FEE_UNAVAILABLE");
      }

      if (attempt < 2 && isRetryableFolioNumberError(error)) {
        retriedAfterConflict = true;
        continue;
      }

      if (retriedAfterConflict || isSerializationConflict(error)) {
        return checkInFailure("CHECK_IN_CONFLICT");
      }

      rethrowFrameworkErrors(error);
      logActionFailure("completeCheckIn", error, {
        action: "completeCheckIn",
        stage: "transaction",
        reservationId: parsed.data.reservationId,
        attempt,
        committed: false,
      });

      return checkInFailure("CHECK_IN_UNEXPECTED");
    }
  }

  if (!result) {
    return checkInFailure("CHECK_IN_UNEXPECTED");
  }

  await runPostCommitSideEffects(
    [
      {
        name: "logActivity",
        run: () =>
          logActivity({
            userId,
            action: "CHECK_IN_COMPLETED",
            reservationId: parsed.data.reservationId,
            folioId: result.folioId,
            roomId: parsed.data.roomId,
          }),
      },
      {
        name: "revalidate:kalender",
        run: () => revalidatePath("/app/fo/reservasi/kalender"),
      },
      {
        name: "revalidate:list",
        run: () => revalidatePath("/app/fo/reservasi/list"),
      },
      {
        name: "revalidate:reservation",
        run: () =>
          revalidatePath(`/app/fo/reservasi/${parsed.data.reservationId}`),
      },
    ],
    {
      action: "completeCheckIn",
      stage: "post-commit",
      reservationId: parsed.data.reservationId,
      folioId: result.folioId,
      committed: true,
    },
  );

  if (options.redirectAfterCheckIn !== false) {
    redirect("/app/fo/reservasi");
  }

  return { ok: true };
}
