"use server";

import { FBOrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

import { BillOrderIdSchema } from "./schema";

export type BillActionResult = { ok: true } | { ok: false; error: string };

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid bill data";
}

async function canManageFbOrders() {
  const session = await auth();

  if (session?.user.role !== "FB") {
    return false;
  }

  return true;
}

function revalidateBillPaths(orderId: number) {
  revalidatePath("/app/fb");
  revalidatePath(`/app/fb/orders/${orderId}`);
  revalidatePath(`/app/fb/orders/${orderId}/bill`);
}

async function lockOrder(tx: Prisma.TransactionClient, orderId: number) {
  await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "fb_order" WHERE id = ${orderId} FOR UPDATE
  `;

  return tx.fBOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
}

export async function confirmBill(input: unknown): Promise<BillActionResult> {
  const canManage = await canManageFbOrders();

  if (!canManage) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = BillOrderIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, parsed.data.orderId);

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    if (order.status !== FBOrderStatus.OPEN) {
      return { ok: false as const, error: "Only open orders can be billed" };
    }

    const [items, settings] = await Promise.all([
      tx.fBOrderItem.findMany({
        where: { fbOrderId: order.id },
        select: { amount: true },
      }),
      tx.hotelSettings.findUnique({ where: { id: 1 } }),
    ]);

    if (items.length === 0) {
      return {
        ok: false as const,
        error: "Order kosong, tidak bisa ditagih",
      };
    }

    if (!settings) {
      return { ok: false as const, error: "Hotel settings not found" };
    }

    const totals = computeFBOrderTotals(items, settings);

    await tx.fBOrder.update({
      where: { id: order.id },
      data: {
        status: FBOrderStatus.BILLED,
        subtotal: totals.subtotal,
        serviceCharge: totals.serviceCharge,
        tax: totals.tax,
        total: totals.total,
      },
    });

    return { ok: true as const };
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidateBillPaths(parsed.data.orderId);
  }

  return result;
}

export async function reopenOrder(input: unknown): Promise<BillActionResult> {
  const canManage = await canManageFbOrders();

  if (!canManage) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = BillOrderIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, parsed.data.orderId);

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    if (order.status !== FBOrderStatus.BILLED) {
      return { ok: false as const, error: "Only billed orders can be reopened" };
    }

    await tx.fBOrder.update({
      where: { id: order.id },
      data: { status: FBOrderStatus.OPEN },
    });

    return { ok: true as const };
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidateBillPaths(parsed.data.orderId);
  }

  return result;
}
