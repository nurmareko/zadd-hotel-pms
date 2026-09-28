"use server";

import { FBOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

const AdvanceKitchenOrderSchema = z.discriminatedUnion("transition", [
  z.object({
    orderId: z.coerce.number().int().positive(),
    transition: z.literal("START"),
    expectedKitchenStartedAt: z.null(),
  }),
  z.object({
    orderId: z.coerce.number().int().positive(),
    transition: z.literal("READY"),
    expectedKitchenStartedAt: z.iso.datetime(),
  }),
]);

export type KitchenActionResult =
  | { ok: true; status: "COOKING" | "READY" }
  | { ok: false; error: string };

export async function advanceKitchenOrder(
  input: unknown,
): Promise<KitchenActionResult> {
  const session = await auth();

  if (!session?.user || !can(session.user.role as AppRole, "orders:write")) {
    return { ok: false, error: "Anda tidak memiliki akses ke Layar Dapur." };
  }

  const parsed = AdvanceKitchenOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Pesanan tidak valid." };
  }

  const result = await prisma.$transaction(async (tx): Promise<KitchenActionResult> => {
    // Use the same order lock as item edits and billing so preparation never
    // completes against an item set that changed while waiting for the lock.
    await tx.$queryRaw`
      SELECT id FROM "fb_order" WHERE id = ${parsed.data.orderId} FOR UPDATE
    `;
    const order = await tx.fBOrder.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        status: true,
        kitchenStartedAt: true,
        kitchenReadyAt: true,
        items: { select: { id: true }, take: 1 },
      },
    });

    if (!order) {
      return { ok: false, error: "Pesanan tidak ditemukan." };
    }

    if (order.status !== FBOrderStatus.OPEN && order.status !== FBOrderStatus.BILLED) {
      return { ok: false, error: "Hanya pesanan terbuka atau ditagihkan yang dapat diproses." };
    }

    if (order.items.length === 0) {
      return { ok: false, error: "Pesanan belum memiliki item untuk dimasak." };
    }

    if (parsed.data.transition === "START") {
      if (order.kitchenStartedAt || order.kitchenReadyAt) {
        return { ok: false, error: "Pesanan ini sudah mulai dimasak." };
      }
    } else {
      if (!order.kitchenStartedAt) {
        return { ok: false, error: "Mulai memasak pesanan terlebih dahulu." };
      }
      if (order.kitchenReadyAt) {
        return { ok: false, error: "Pesanan ini sudah selesai dimasak." };
      }
      // Item additions reopen preparation. A stale screen must not finish the
      // replacement cycle after another operator has started it.
      if (order.kitchenStartedAt.getTime() !== new Date(parsed.data.expectedKitchenStartedAt).getTime()) {
        return { ok: false, error: "Pesanan berubah. Muat ulang Layar Dapur sebelum melanjutkan." };
      }
    }

    const updated = await tx.fBOrder.updateMany({
      where: {
        id: order.id,
        status: { in: [FBOrderStatus.OPEN, FBOrderStatus.BILLED] },
        kitchenStartedAt: order.kitchenStartedAt,
        kitchenReadyAt: null,
      },
      data: parsed.data.transition === "START"
        ? { kitchenStartedAt: new Date() }
        : { kitchenReadyAt: new Date() },
    });

    if (updated.count !== 1) {
      return { ok: false, error: "Status pesanan berubah. Muat ulang Layar Dapur." };
    }

    return { ok: true, status: parsed.data.transition === "START" ? "COOKING" : "READY" };
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidatePath("/app/fb/kitchen");
  }
  return result;
}
