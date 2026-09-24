"use server";

import {
  FBOrderServiceType,
  FBOrderStatus,
  FolioStatus,
  Prisma,
  ReservationStatus,
  TableStatus,
} from "@prisma/client";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  CreateOrderSchema,
  CreateRoomServiceOrderSchema,
  LookupRoomForChargeSchema,
} from "@/app/app/fb/orders/[orderId]/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ChargeLookupResult =
  | {
    ok: true;
    guestName: string;
    roomNumber: string;
    folioNo: string;
    folioId: number;
    reservationId: number;
  }
  | { ok: false; error: string };

type RoomChargeDb = Pick<typeof prisma, "room" | "reservation" | "folio"> & {
  $queryRaw?: Prisma.TransactionClient["$queryRaw"];
};

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid order data";
}

function isRetryableOrderNoError(error: unknown) {
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

async function canManageFbOrders() {
  const session = await auth();

  if (!session?.user || !can(session.user.role as AppRole, "orders:write")) {
    return null;
  }

  return Number(session.user.id);
}

function revalidateOrderPaths(orderId?: number) {
  revalidatePath("/app/fb");

  if (orderId) {
    revalidatePath(`/app/fb/orders/${orderId}`);
  }
}

async function resolveRoomForCharge(
  db: RoomChargeDb,
  roomNumber: string,
  options: { lockRows?: boolean } = {},
): Promise<ChargeLookupResult> {
  const normalizedRoomNumber = roomNumber.trim();

  if (options.lockRows && db.$queryRaw) {
    await db.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "room" WHERE "number" = ${normalizedRoomNumber} FOR UPDATE
    `;
  }

  const room = await db.room.findUnique({
    where: { number: normalizedRoomNumber },
    select: { id: true, number: true },
  });

  if (!room) {
    return {
      ok: false,
      error: `Kamar ${normalizedRoomNumber} tidak ditemukan`,
    };
  }

  const reservation = await db.reservation.findFirst({
    where: {
      roomId: room.id,
      status: ReservationStatus.CHECKED_IN,
    },
    include: {
      guest: { select: { fullName: true } },
      folio: { select: { id: true, folioNo: true, status: true } },
    },
    orderBy: { id: "desc" },
  });

  if (!reservation) {
    return {
      ok: false,
      error: `Kamar ${room.number} tidak memiliki tamu yang sedang menginap`,
    };
  }

  if (!reservation.folio) {
    return { ok: false, error: "Folio tidak terbuka" };
  }

  if (options.lockRows && db.$queryRaw) {
    await db.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "folio" WHERE id = ${reservation.folio.id} FOR UPDATE
    `;
  }

  const folio = await db.folio.findUnique({
    where: { id: reservation.folio.id },
    select: { id: true, folioNo: true, status: true },
  });

  if (!folio || folio.status !== FolioStatus.OPEN) {
    return { ok: false, error: "Folio tidak terbuka" };
  }

  return {
    ok: true,
    guestName: reservation.guest.fullName,
    roomNumber: room.number,
    folioNo: folio.folioNo,
    folioId: folio.id,
    reservationId: reservation.id,
  };
}

async function runCreateOrderTransaction(
  input: { tableId: number; guestCount: number },
  userId: number,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "restaurant_table" WHERE id = ${input.tableId} FOR UPDATE
      `;

      const table = await tx.restaurantTable.findUnique({
        where: { id: input.tableId },
        select: { id: true, number: true, status: true, capacity: true },
      });

      if (!table) {
        return { ok: false as const, error: "Table not found" };
      }

      if (
        table.status !== TableStatus.AVAILABLE &&
        table.status !== TableStatus.RESERVED
      ) {
        return {
          ok: false as const,
          error: `Meja ${table.number} tidak tersedia untuk order baru.`,
        };
      }

      if (input.guestCount > table.capacity) {
        return {
          ok: false as const,
          error: `Jumlah tamu tidak boleh melebihi kapasitas meja ${table.capacity}.`,
        };
      }

      const existingOpenOrder = await tx.fBOrder.findFirst({
        where: { tableId: table.id, status: FBOrderStatus.OPEN },
        select: { id: true },
      });

      if (existingOpenOrder) {
        return {
          ok: false as const,
          error: `Meja ${table.number} sudah memiliki order terbuka.`,
        };
      }

      const now = new Date();
      const orderPrefix = `FB-${format(now, "ddMM")}-`;
      const orderCount = await tx.fBOrder.count({
        where: { orderNo: { startsWith: orderPrefix } },
      });
      const orderNo = `${orderPrefix}${String(orderCount + 1).padStart(4, "0")}`;

      const order = await tx.fBOrder.create({
        data: {
          orderNo,
          tableId: table.id,
          tableNo: table.number,
          guestCount: input.guestCount,
          waitedById: userId,
          status: FBOrderStatus.OPEN,
        },
        select: { id: true },
      });

      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: TableStatus.OCCUPIED },
      });

      return { ok: true as const, orderId: order.id };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

export async function createOrder(input: unknown): Promise<ActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = CreateOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  let result: Awaited<ReturnType<typeof runCreateOrderTransaction>> | null =
    null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCreateOrderTransaction(parsed.data, userId);
      break;
    } catch (error) {
      if (attempt < 2 && isRetryableOrderNoError(error)) {
        continue;
      }

      if (isSerializationConflict(error)) {
        return { ok: false, error: "Table was updated by another cashier." };
      }

      return { ok: false, error: "Something went wrong creating order" };
    }
  }

  if (!result) {
    return { ok: false, error: "Something went wrong creating order" };
  }

  if (!result.ok) {
    return result;
  }

  revalidateOrderPaths(result.orderId);
  redirect(`/app/fb/orders/${result.orderId}`);
}

async function runCreateRoomServiceOrderTransaction(
  input: { roomNumber: string; guestCount: number },
  userId: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const roomLookup = await resolveRoomForCharge(tx, input.roomNumber, {
        lockRows: true,
      });

      if (!roomLookup.ok) {
        return roomLookup;
      }

      const now = new Date();
      const orderPrefix = `FB-${format(now, "ddMM")}-`;
      const orderCount = await tx.fBOrder.count({
        where: { orderNo: { startsWith: orderPrefix } },
      });
      const orderNo = `${orderPrefix}${String(orderCount + 1).padStart(4, "0")}`;

      const order = await tx.fBOrder.create({
        data: {
          orderNo,
          tableId: null,
          tableNo: null,
          serviceType: FBOrderServiceType.ROOM_SERVICE,
          chargedFolioId: roomLookup.folioId,
          guestCount: input.guestCount,
          waitedById: userId,
          status: FBOrderStatus.OPEN,
        },
        select: { id: true },
      });

      return { ok: true as const, orderId: order.id };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      ...TRANSACTION_OPTIONS,
    },
  );
}

export async function createRoomServiceOrder(
  input: unknown,
): Promise<ActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = CreateRoomServiceOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  let result: Awaited<
    ReturnType<typeof runCreateRoomServiceOrderTransaction>
  > | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runCreateRoomServiceOrderTransaction(parsed.data, userId);
      break;
    } catch (error) {
      if (attempt < 2 && isRetryableOrderNoError(error)) {
        continue;
      }

      if (isSerializationConflict(error)) {
        return {
          ok: false,
          error: "Data kamar atau folio berubah. Coba lagi.",
        };
      }

      return {
        ok: false,
        error: "Something went wrong creating room service order",
      };
    }
  }

  if (!result) {
    return {
      ok: false,
      error: "Something went wrong creating room service order",
    };
  }

  if (!result.ok) {
    return result;
  }

  revalidateOrderPaths(result.orderId);
  redirect(`/app/fb/orders/${result.orderId}`);
}

export async function lookupRoomForCharge(
  input: unknown,
): Promise<ChargeLookupResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = LookupRoomForChargeSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  return prisma.$transaction(
    (tx) => resolveRoomForCharge(tx, parsed.data.roomNumber),
    TRANSACTION_OPTIONS,
  );
}
