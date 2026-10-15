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
    return { ok: false, error: "You do not have access to the Kitchen Display." };
  }

  const parsed = AdvanceKitchenOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invalid order." };
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
      return { ok: false, error: "Order not found." };
    }

    if (order.status !== FBOrderStatus.OPEN && order.status !== FBOrderStatus.BILLED) {
      return { ok: false, error: "Only open or billed orders can be processed." };
    }

    if (order.items.length === 0) {
      return { ok: false, error: "The order has no items to prepare." };
    }

    if (parsed.data.transition === "START") {
      if (order.kitchenStartedAt || order.kitchenReadyAt) {
        return { ok: false, error: "Preparation has already started for this order." };
      }
    } else {
      if (!order.kitchenStartedAt) {
        return { ok: false, error: "Start preparing the order first." };
      }
      if (order.kitchenReadyAt) {
        return { ok: false, error: "Preparation is already complete for this order." };
      }
      // Item additions reopen preparation. A stale screen must not finish the
      // replacement cycle after another operator has started it.
      if (order.kitchenStartedAt.getTime() !== new Date(parsed.data.expectedKitchenStartedAt).getTime()) {
        return { ok: false, error: "The order has changed. Refresh the Kitchen Display before continuing." };
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
      return { ok: false, error: "The order status has changed. Refresh the Kitchen Display." };
    }

    return { ok: true, status: parsed.data.transition === "START" ? "COOKING" : "READY" };
  }, TRANSACTION_OPTIONS);

  if (result.ok) {
    revalidatePath("/app/fb/kitchen");
  }
  return result;
}
