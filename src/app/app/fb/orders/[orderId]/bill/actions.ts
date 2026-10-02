"use server";

import { FBOrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

import { BillOrderIdSchema } from "./schema";

export type BillActionResult = { ok: true } | { ok: false; error: string };

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Data tagihan tidak valid.";
}

async function canManageFbOrders() {
  const session = await auth();

  if (!session?.user || !can(session.user.role as AppRole, "orders:bill")) {
    return false;
  }

  return true;
}

function revalidateBillPaths(orderId: number) {
  revalidatePath("/app/fb");
  revalidatePath("/app/fb/pos");
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
    return { ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
  }

  const parsed = BillOrderIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, parsed.data.orderId);

    if (!order) {
      return { ok: false as const, error: "Pesanan tidak ditemukan." };
    }

    if (order.status !== FBOrderStatus.OPEN) {
      return { ok: false as const, error: "Hanya pesanan yang masih terbuka yang dapat ditagihkan." };
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
        error: "Pesanan kosong, tidak bisa ditagih.",
      };
    }

    if (!settings) {
      return { ok: false as const, error: "Pengaturan hotel tidak ditemukan." };
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
    return { ok: false, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
  }

  const parsed = BillOrderIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, parsed.data.orderId);

    if (!order) {
      return { ok: false as const, error: "Pesanan tidak ditemukan." };
    }

    if (order.status !== FBOrderStatus.BILLED) {
      return { ok: false as const, error: "Hanya pesanan yang sudah ditagihkan yang dapat dibuka kembali." };
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
