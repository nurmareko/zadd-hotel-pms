"use server";

import {
  Prisma,
  ReservationStatus,
  ReservationUsageType,
  RoomStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { formatISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity-log";
import { dateOnlyBoundary, hotelTodayISO } from "@/lib/date-only";
import {
  FO_RESERVASI_VIEW_COOKIE,
  FO_RESERVASI_VIEW_PATHS,
  type FoReservasiView,
  parseFoReservasiView,
} from "@/lib/nav-preferences";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { validateRoomTypeCapacity } from "@/lib/reservation-capacity";
import {
  createReservationSchema,
  createUnifiedReservationSchema,
  type EditReservationValues,
  type UnifiedReservationValues,
  reservationCapacityError,
} from "./schema";

type ReservationActionField = "roomTypeId" | "roomId";
type ActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: ReservationActionField };

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

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid reservation data";
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

async function selectedRoomLabel(roomId: number | null) {
  if (roomId === null) {
    return "unallocated reservation";
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { number: true },
  });

  return room?.number ?? String(roomId);
}

async function reservationConflictMessage(roomId: number | null) {
  if (roomId === null) {
    return "Reservation changed while saving. Try again.";
  }

  return `Room ${await selectedRoomLabel(
    roomId,
  )} is no longer available for those dates.`;
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
  | { ok: false; error: string }
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
    return { ok: false, error: "Room type is invalid for this booking" };
  }

  const totalGuests = input.adults + input.children;

  if (totalGuests > roomType.capacity) {
    return {
      ok: false,
      error: reservationCapacityError(totalGuests, roomType.capacity),
    };
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
    return { ok: false, error: "Room is invalid for this booking" };
  }

  if (room.status === RoomStatus.OOO) {
    return {
      ok: false,
      error: `Room ${room.number} is out of order. Choose another.`,
    };
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
    return {
      ok: false,
      error: `Room ${room.number} is no longer available for those dates.`,
    };
  }

  return { ok: true, assignment: { roomType, room } };
}

async function currentReservationSchema() {
  const roomTypes = await prisma.roomType.findMany({
    select: { id: true, capacity: true },
  });

  return createReservationSchema(roomTypes);
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

      for (const room of input.rooms) {
        const validatedAssignment = await validateReservationRoomAssignment(
          tx,
          {
            ...room,
            arrivalDate: input.arrivalDate,
            departureDate: input.departureDate,
          },
        );

        if (!validatedAssignment.ok) {
          return validatedAssignment;
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
          return validatedCapacity;
        }
      }

      const guest = await tx.guest.create({
        data: {
          fullName: input.fullName,
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
        const { roomType, room: selectedRoom } = assignments[index];
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
            rateAmount: roomType.baseRate,
            deposit: input.deposit,
            notes: input.notes,
            createdById: userId,
          },
          select: { id: true },
        });

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
      const existingReservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          guestId: true,
          roomTypeId: true,
          arrivalDate: true,
          departureDate: true,
          status: true,
        },
      });

      if (!existingReservation) {
        return { ok: false as const, error: "Reservation not found" };
      }

      if (
        input.roomId === null &&
        existingReservation.status !== ReservationStatus.CONFIRMED
      ) {
        return {
          ok: false as const,
          error: "Room is required after check-in",
        };
      }

      const validatedAssignment = await validateReservationRoomAssignment(
        tx,
        input,
        reservationId,
      );

      if (!validatedAssignment.ok) {
        return validatedAssignment;
      }

      const { roomType, room } = validatedAssignment.assignment;
      const stayChanged =
        existingReservation.roomTypeId !== input.roomTypeId ||
        !sameDateOnly(existingReservation.arrivalDate, input.arrivalDate) ||
        !sameDateOnly(existingReservation.departureDate, input.departureDate);

      if (stayChanged) {
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
          return validatedCapacity;
        }
      }

      await tx.guest.update({
        where: { id: existingReservation.guestId },
        data: {
          fullName: input.fullName,
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
          rateAmount: roomType.baseRate,
          deposit: input.deposit,
          notes: input.notes,
          arrangementType: input.arrangementType,
          reservationType: input.reservationType,
        },
      });

      return { ok: true as const };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

export async function createReservation(
  input: unknown,
  originView: unknown = "list",
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = (await currentUnifiedReservationSchema()).safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const userId = Number(session.user.id);
  let result: Awaited<ReturnType<typeof runCreateReservationTransaction>> | null =
    null;
  let retriedAfterConflict = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCreateReservationTransaction(parsed.data, userId);
      break;
    } catch (error) {
      if (attempt < 2 && isRetryableReservationNumberError(error)) {
        retriedAfterConflict = true;
        continue;
      }

      if (retriedAfterConflict || isSerializationConflict(error)) {
        const firstRoomId = parsed.data.rooms[0]?.roomId ?? null;

        return {
          ok: false,
          error:
            parsed.data.rooms.length === 1
              ? await reservationConflictMessage(firstRoomId)
              : "Ketersediaan berubah saat menyimpan booking grup. Coba lagi.",
        };
      }

      return { ok: false, error: "Something went wrong creating reservation" };
    }
  }

  if (!result) {
    return { ok: false, error: "Something went wrong creating reservation" };
  }

  if (!result.ok) {
    return result;
  }

  const arrival = formatISO(parsed.data.arrivalDate, { representation: "date" });
  const origin =
    parseFoReservasiView(typeof originView === "string" ? originView : undefined) ??
    "list";

  for (const reservationId of result.reservationIds) {
    await logActivity({
      userId,
      action: "RESERVATION_CREATED",
      reservationId,
    });
  }

  await persistFoReservasiView(origin);
  revalidatePath(FO_RESERVASI_VIEW_PATHS.list);
  revalidatePath(FO_RESERVASI_VIEW_PATHS.kalender);
  redirect(reservationCreateRedirectPath(origin, arrival));
}

export async function cancelReservation(
  reservationId: number,
): Promise<ActionResult> {
  const session = await auth();

  // Cancel is permitted for FO (who own the screen) and ADMIN.
  if (session?.user.role !== "FO" && session?.user.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { ok: false, error: "Invalid reservation" };
  }

  const userId = Number(session.user.id);
  let result: { ok: true } | { ok: false; error: string };

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
          return { ok: false as const, error: "Reservasi tidak ditemukan" };
        }

        // Re-verify server-side; never trust the client's view of status.
        if (reservation.status !== ReservationStatus.CONFIRMED) {
          return {
            ok: false as const,
            error: "Hanya reservasi berstatus CONFIRMED yang bisa dibatalkan.",
          };
        }

        // A CONFIRMED reservation should have no folio (created at check-in).
        // If one somehow exists, do NOT cancel and do NOT delete it.
        if (reservation.folio) {
          return {
            ok: false as const,
            error:
              "Reservasi ini sudah memiliki folio. Pembatalan dibatalkan; periksa folio terlebih dahulu.",
          };
        }

        const updated = await tx.reservation.updateMany({
          where: { id: reservationId, status: ReservationStatus.CONFIRMED },
          data: { status: ReservationStatus.CANCELLED },
        });

        if (updated.count === 0) {
          return {
            ok: false as const,
            error: "Status reservasi berubah saat membatalkan. Coba lagi.",
          };
        }

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      return {
        ok: false,
        error: "Status reservasi berubah saat membatalkan. Coba lagi.",
      };
    }

    return { ok: false, error: "Something went wrong cancelling reservation" };
  }

  if (!result.ok) {
    return result;
  }

  await logActivity({
    userId,
    action: "RESERVATION_CANCELLED",
    reservationId,
  });

  revalidatePath(FO_RESERVASI_VIEW_PATHS.list);
  revalidatePath(`/app/fo/reservasi/${reservationId}`);
  revalidatePath(FO_RESERVASI_VIEW_PATHS.kalender);
  return { ok: true };
}

export async function updateReservation(
  reservationId: number,
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return { ok: false, error: "Invalid reservation" };
  }

  const parsed = (await currentReservationSchema()).safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const userId = Number(session.user.id);
  let result: Awaited<ReturnType<typeof runUpdateReservationTransaction>> | null =
    null;

  try {
    result = await runUpdateReservationTransaction(reservationId, parsed.data);
  } catch (error) {
    if (isSerializationConflict(error)) {
      return {
        ok: false,
        error: await reservationConflictMessage(parsed.data.roomId),
      };
    }

    return { ok: false, error: "Something went wrong updating reservation" };
  }

  if (!result.ok) {
    return result;
  }

  await logActivity({
    userId,
    action: "RESERVATION_UPDATED",
    reservationId,
  });

  revalidatePath(FO_RESERVASI_VIEW_PATHS.list);
  revalidatePath(`/app/fo/reservasi/${reservationId}`);
  revalidatePath(FO_RESERVASI_VIEW_PATHS.kalender);
  redirect(`/app/fo/reservasi/${reservationId}?mode=view`);
}
