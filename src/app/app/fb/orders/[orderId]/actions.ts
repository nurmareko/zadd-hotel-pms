"use server";

import { FBOrderStatus, Prisma, TableStatus } from "@prisma/client";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { prisma } from "@/lib/prisma";

import {
  AddItemToOrderSchema,
  CreateOrderSchema,
  OrderItemIdSchema,
  UpdateItemNotesSchema,
  UpdateItemQuantitySchema,
  VoidOrderSchema,
} from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
    select: { id: true, status: true, tableId: true },
  });
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
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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

    const menuItem = await tx.menuItem.findUnique({
      where: { id: parsed.data.menuItemId },
      select: { id: true, price: true, isActive: true, name: true },
    });

    if (!menuItem || !menuItem.isActive) {
      return { ok: false as const, error: "Menu item is not available" };
    }

    const existingItem = await tx.fBOrderItem.findFirst({
      where: {
        fbOrderId: order.id,
        menuItemId: menuItem.id,
        notes: parsed.data.notes,
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
          notes: parsed.data.notes,
        },
      });
    }

    return recalculateOrderTotals(tx, order.id);
  });

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
  });

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
  });

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

    await tx.fBOrderItem.update({
      where: { id: item.id },
      data: { notes: parsed.data.notes },
    });

    return { ok: true as const };
  });

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
  });

  if (result.ok) {
    revalidateOrderPaths(parsed.data.orderId);
  }

  return result;
}
