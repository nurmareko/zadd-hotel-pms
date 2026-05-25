"use server";

import {
  ArticleType,
  FBOrderStatus,
  FolioStatus,
  PaymentMethod,
  Prisma,
  ReservationStatus,
  TableStatus,
} from "@prisma/client";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  formatFBOrderItemNotes,
  parseFBOrderItemNotes,
} from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

import {
  AddItemToOrderSchema,
  ChargeOrderToRoomSchema,
  CreateOrderSchema,
  LookupRoomForChargeSchema,
  OrderItemIdSchema,
  PayOrderDirectSchema,
  UpdateItemNotesSchema,
  UpdateItemQuantitySchema,
  VoidOrderSchema,
} from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type PaymentActionResult =
  | {
      ok: true;
      paymentMethod: PaymentMethod;
      amountTendered?: string;
      change?: string;
      folioId?: number;
      folioNo?: string;
      alreadyClosed?: boolean;
    }
  | { ok: false; error: string };

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

type OrderTotalDb = Pick<typeof prisma, "fBOrderItem" | "hotelSettings">;
type RoomChargeDb = Pick<typeof prisma, "room" | "reservation" | "folio"> & {
  $queryRaw?: Prisma.TransactionClient["$queryRaw"];
};

class PaymentActionError extends Error {}

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

  if (session?.user.role !== "FB") {
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

async function recalculateOrderTotals(
  tx: Prisma.TransactionClient,
  orderId: number,
): Promise<ActionResult> {
  const [items, settings] = await Promise.all([
    tx.fBOrderItem.findMany({
      where: { fbOrderId: orderId },
      select: { amount: true },
    }),
    tx.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!settings) {
    return { ok: false, error: "Hotel settings not found" };
  }

  const totals = computeFBOrderTotals(items, settings);

  await tx.fBOrder.update({
    where: { id: orderId },
    data: {
      subtotal: totals.subtotal,
      serviceCharge: totals.serviceCharge,
      tax: totals.tax,
      total: totals.total,
    },
  });

  return { ok: true };
}

async function ensureOpenOrderLocked(
  tx: Prisma.TransactionClient,
  orderId: number,
) {
  await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "fb_order" WHERE id = ${orderId} FOR UPDATE
  `;

  return tx.fBOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, tableId: true, guestCount: true },
  });
}

async function computeOrderTotalForPayment(db: OrderTotalDb, orderId: number) {
  const [items, settings] = await Promise.all([
    db.fBOrderItem.findMany({
      where: { fbOrderId: orderId },
      select: { amount: true },
    }),
    db.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!settings) {
    return { ok: false as const, error: "Hotel settings not found" };
  }

  const totals = computeFBOrderTotals(items, settings);

  return { ok: true as const, totals };
}

async function freeOrderTable(
  tx: Prisma.TransactionClient,
  tableId: number | null,
) {
  if (!tableId) {
    return;
  }

  await tx.restaurantTable.updateMany({
    where: { id: tableId, status: TableStatus.OCCUPIED },
    data: { status: TableStatus.AVAILABLE },
  });
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

function revalidatePaymentPaths(
  orderId: number,
  folioId?: number,
  reservationId?: number,
) {
  revalidateOrderPaths(orderId);
  revalidatePath(`/app/fb/orders/${orderId}/bill`);
  revalidatePath(`/app/fb/orders/${orderId}/payment`);

  if (folioId) {
    revalidatePath(`/app/fo/folios/${folioId}`);
    revalidatePath(`/app/fo/check-out/${folioId}`);
    revalidatePath("/app/fo/tape-chart");
  }

  if (reservationId) {
    revalidatePath(`/app/fo/reservations/${reservationId}`);
  }
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
        select: { id: true, number: true, status: true },
      });

      if (!table) {
        return { ok: false as const, error: "Table not found" };
      }

      if (table.status !== TableStatus.AVAILABLE) {
        return {
          ok: false as const,
          error: `Meja ${table.number} tidak tersedia untuk order baru.`,
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

export async function addItemToOrder(input: unknown): Promise<ActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = AddItemToOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await ensureOpenOrderLocked(tx, parsed.data.orderId);

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    if (order.status !== FBOrderStatus.OPEN) {
      return { ok: false as const, error: "Only open orders can be edited" };
    }

    if (parsed.data.guestNumber > order.guestCount) {
      return {
        ok: false as const,
        error: "Guest number is outside this order's guest count",
      };
    }

    const menuItem = await tx.menuItem.findUnique({
      where: { id: parsed.data.menuItemId },
      select: { id: true, price: true, isActive: true, name: true },
    });

    if (!menuItem || !menuItem.isActive) {
      return { ok: false as const, error: "Menu item is not available" };
    }

    const notes = formatFBOrderItemNotes(
      parsed.data.guestNumber,
      parsed.data.notes,
    );

    const existingItem = await tx.fBOrderItem.findFirst({
      where: {
        fbOrderId: order.id,
        menuItemId: menuItem.id,
        notes,
      },
      select: { id: true, quantity: true, unitPrice: true },
    });

    if (existingItem) {
      const quantity = existingItem.quantity + parsed.data.quantity;

      await tx.fBOrderItem.update({
        where: { id: existingItem.id },
        data: {
          quantity,
          amount: existingItem.unitPrice.mul(quantity),
        },
      });
    } else {
      await tx.fBOrderItem.create({
        data: {
          fbOrderId: order.id,
          menuItemId: menuItem.id,
          quantity: parsed.data.quantity,
          unitPrice: menuItem.price,
          amount: menuItem.price.mul(parsed.data.quantity),
          notes,
        },
      });
    }

    return recalculateOrderTotals(tx, order.id);
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidateOrderPaths(parsed.data.orderId);
  }

  return result;
}

export async function removeItemFromOrder(input: unknown): Promise<ActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = OrderItemIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.fBOrderItem.findUnique({
      where: { id: parsed.data.orderItemId },
      select: { id: true, fbOrderId: true },
    });

    if (!item) {
      return { ok: false as const, error: "Order item not found" };
    }

    const order = await ensureOpenOrderLocked(tx, item.fbOrderId);

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    if (order.status !== FBOrderStatus.OPEN) {
      return { ok: false as const, error: "Only open orders can be edited" };
    }

    await tx.fBOrderItem.delete({ where: { id: item.id } });

    return recalculateOrderTotals(tx, order.id);
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidateOrderPaths();
  }

  return result;
}

export async function updateItemQuantity(
  input: unknown,
): Promise<ActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UpdateItemQuantitySchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.fBOrderItem.findUnique({
      where: { id: parsed.data.orderItemId },
      select: { id: true, fbOrderId: true, unitPrice: true },
    });

    if (!item) {
      return { ok: false as const, error: "Order item not found" };
    }

    const order = await ensureOpenOrderLocked(tx, item.fbOrderId);

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    if (order.status !== FBOrderStatus.OPEN) {
      return { ok: false as const, error: "Only open orders can be edited" };
    }

    if (parsed.data.quantity === 0) {
      await tx.fBOrderItem.delete({ where: { id: item.id } });
    } else {
      await tx.fBOrderItem.update({
        where: { id: item.id },
        data: {
          quantity: parsed.data.quantity,
          amount: item.unitPrice.mul(parsed.data.quantity),
        },
      });
    }

    return recalculateOrderTotals(tx, order.id);
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidateOrderPaths();
  }

  return result;
}

export async function updateItemNotes(input: unknown): Promise<ActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UpdateItemNotesSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.fBOrderItem.findUnique({
      where: { id: parsed.data.orderItemId },
      select: { id: true, fbOrderId: true, notes: true },
    });

    if (!item) {
      return { ok: false as const, error: "Order item not found" };
    }

    const order = await ensureOpenOrderLocked(tx, item.fbOrderId);

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    if (order.status !== FBOrderStatus.OPEN) {
      return { ok: false as const, error: "Only open orders can be edited" };
    }

    const parsedNotes = parseFBOrderItemNotes(item.notes);

    await tx.fBOrderItem.update({
      where: { id: item.id },
      data: {
        notes: formatFBOrderItemNotes(
          parsedNotes.guestNumber,
          parsed.data.notes,
        ),
      },
    });

    return { ok: true as const };
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidateOrderPaths();
  }

  return result;
}

export async function voidOrder(input: unknown): Promise<ActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = VoidOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await ensureOpenOrderLocked(tx, parsed.data.orderId);

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    if (order.status !== FBOrderStatus.OPEN) {
      return { ok: false as const, error: "Only open orders can be voided" };
    }

    await tx.fBOrder.update({
      where: { id: order.id },
      data: {
        status: FBOrderStatus.VOIDED,
        closedAt: new Date(),
      },
    });

    if (order.tableId) {
      const otherOpenOrder = await tx.fBOrder.findFirst({
        where: {
          tableId: order.tableId,
          status: FBOrderStatus.OPEN,
          id: { not: order.id },
        },
        select: { id: true },
      });

      if (!otherOpenOrder) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }
    }

    return { ok: true as const };
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidateOrderPaths(parsed.data.orderId);
  }

  return result;
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

export async function payOrderDirect(
  input: unknown,
): Promise<PaymentActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PayOrderDirectSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const order = await prisma.fBOrder.findUnique({
    where: { id: parsed.data.orderId },
    select: {
      id: true,
      status: true,
      tableId: true,
      paymentMethod: true,
    },
  });

  if (!order) {
    return { ok: false, error: "Order not found" };
  }

  if (order.status === FBOrderStatus.CLOSED) {
    return {
      ok: true,
      paymentMethod: order.paymentMethod ?? parsed.data.method,
      alreadyClosed: true,
    };
  }

  if (order.status !== FBOrderStatus.BILLED) {
    return {
      ok: false,
      error:
        order.status === FBOrderStatus.OPEN
          ? "Order harus dibuat bill dahulu sebelum pembayaran"
          : "Order voided tidak dapat dibayar",
    };
  }

  const computed = await computeOrderTotalForPayment(prisma, order.id);

  if (!computed.ok) {
    return computed;
  }

  const total = computed.totals.total;
  let amountTendered: Prisma.Decimal | undefined;
  let change: Prisma.Decimal | undefined;

  if (parsed.data.method === PaymentMethod.CASH) {
    amountTendered = new Prisma.Decimal(parsed.data.amountTendered ?? 0);

    if (amountTendered.lt(total)) {
      return {
        ok: false,
        error: "Uang diterima kurang dari total tagihan",
      };
    }

    change = amountTendered.minus(total);
  }

  const now = new Date();
  const reference =
    parsed.data.method === PaymentMethod.CASH && amountTendered && change
      ? `CASH_TENDERED=${amountTendered.toFixed(2)};CHANGE=${change.toFixed(2)}`
      : parsed.data.reference || null;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const updatedOrder = await tx.fBOrder.updateMany({
          where: { id: order.id, status: FBOrderStatus.BILLED },
          data: {
            status: FBOrderStatus.CLOSED,
            paymentMethod: parsed.data.method,
            subtotal: computed.totals.subtotal,
            serviceCharge: computed.totals.serviceCharge,
            tax: computed.totals.tax,
            total,
            closedAt: now,
          },
        });

        if (updatedOrder.count === 0) {
          throw new PaymentActionError(
            "Status order berubah. Muat ulang halaman.",
          );
        }

        await tx.payment.create({
          data: {
            folioId: null,
            fbOrderId: order.id,
            amount: total,
            method: parsed.data.method,
            reference,
            receivedById: userId,
            receivedAt: now,
          },
        });

        await freeOrderTable(tx, order.tableId);

        return {
          ok: true as const,
          paymentMethod: parsed.data.method,
          amountTendered: amountTendered?.toFixed(2),
          change: change?.toFixed(2),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidatePaymentPaths(parsed.data.orderId);
    }

    return result;
  } catch (error) {
    if (error instanceof PaymentActionError) {
      return { ok: false, error: error.message };
    }

    throw error;
  }
}

export async function chargeOrderToRoom(
  input: unknown,
): Promise<PaymentActionResult> {
  const userId = await canManageFbOrders();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ChargeOrderToRoomSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const order = await prisma.fBOrder.findUnique({
    where: { id: parsed.data.orderId },
    select: {
      id: true,
      orderNo: true,
      status: true,
      tableId: true,
      paymentMethod: true,
      chargedFolioId: true,
    },
  });

  if (!order) {
    return { ok: false, error: "Order not found" };
  }

  if (order.status === FBOrderStatus.CLOSED) {
    return {
      ok: true,
      paymentMethod: order.paymentMethod ?? PaymentMethod.CHARGE_TO_ROOM,
      folioId: order.chargedFolioId ?? undefined,
      alreadyClosed: true,
    };
  }

  if (order.status !== FBOrderStatus.BILLED) {
    return {
      ok: false,
      error:
        order.status === FBOrderStatus.OPEN
          ? "Order harus dibuat bill dahulu sebelum charge ke kamar"
          : "Order voided tidak dapat dibebankan ke kamar",
    };
  }

  const roomLookup = await resolveRoomForCharge(prisma, parsed.data.roomNumber);

  if (!roomLookup.ok) {
    return roomLookup;
  }

  const computed = await computeOrderTotalForPayment(prisma, order.id);

  if (!computed.ok) {
    return computed;
  }

  const article =
    (await prisma.article.findUnique({
      where: { code: "DINNER" },
      select: { id: true },
    })) ??
    (await prisma.article.findFirst({
      where: { type: ArticleType.FB },
      orderBy: { code: "asc" },
      select: { id: true },
    }));

  if (!article) {
    return {
      ok: false,
      error: "Artikel F&B belum tersedia untuk posting folio",
    };
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const openFolio = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "folio"
          WHERE id = ${roomLookup.folioId}
            AND status = ${FolioStatus.OPEN}::"FolioStatus"
          FOR UPDATE
        `;

        if (openFolio.length === 0) {
          throw new PaymentActionError("Folio tidak terbuka");
        }

        const updatedOrder = await tx.fBOrder.updateMany({
          where: { id: order.id, status: FBOrderStatus.BILLED },
          data: {
            status: FBOrderStatus.CLOSED,
            paymentMethod: PaymentMethod.CHARGE_TO_ROOM,
            chargedFolioId: roomLookup.folioId,
            subtotal: computed.totals.subtotal,
            serviceCharge: computed.totals.serviceCharge,
            tax: computed.totals.tax,
            total: computed.totals.total,
            closedAt: now,
          },
        });

        if (updatedOrder.count === 0) {
          throw new PaymentActionError(
            "Status order berubah. Muat ulang halaman.",
          );
        }

        await tx.folioLineItem.create({
          data: {
            folioId: roomLookup.folioId,
            articleId: article.id,
            fbOrderId: order.id,
            description: `F&B — ${order.orderNo}`,
            quantity: new Prisma.Decimal(1),
            unitPrice: computed.totals.total,
            amount: computed.totals.total,
            postedById: userId,
            postedAt: now,
          },
        });

        await freeOrderTable(tx, order.tableId);

        return {
          ok: true as const,
          paymentMethod: PaymentMethod.CHARGE_TO_ROOM,
          folioId: roomLookup.folioId,
          folioNo: roomLookup.folioNo,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidatePaymentPaths(
        parsed.data.orderId,
        result.folioId,
        roomLookup.reservationId,
      );
    }

    return result;
  } catch (error) {
    if (error instanceof PaymentActionError) {
      return { ok: false, error: error.message };
    }

    throw error;
  }
}
