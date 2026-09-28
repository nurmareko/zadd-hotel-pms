"use server";

import { FBOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const AdvanceKitchenOrderSchema = z.object({
    orderId: z.coerce.number().int().positive(),
    transition: z.enum(["START", "READY"]),
});

export type KitchenActionResult =
    | { ok: true; status: "COOKING" | "READY" }
    | { ok: false; error: string };

export async function advanceKitchenOrder(
    input: unknown,
): Promise<KitchenActionResult> {
    const session = await auth();

    if (session?.user.role !== "FB") {
        return { ok: false, error: "Anda tidak memiliki akses ke Kitchen Display." };
    }

    const parsed = AdvanceKitchenOrderSchema.safeParse(input);

    if (!parsed.success) {
        return { ok: false, error: "Pesanan tidak valid." };
    }

    const order = await prisma.fBOrder.findUnique({
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

    if (order.status !== FBOrderStatus.OPEN) {
        return { ok: false, error: "Hanya pesanan terbuka yang dapat diproses." };
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
    }

    const updated = await prisma.fBOrder.updateMany({
        where:
            parsed.data.transition === "START"
                ? {
                    id: order.id,
                    status: FBOrderStatus.OPEN,
                    kitchenStartedAt: null,
                    kitchenReadyAt: null,
                }
                : {
                    id: order.id,
                    status: FBOrderStatus.OPEN,
                    kitchenStartedAt: { not: null },
                    kitchenReadyAt: null,
                },
        data:
            parsed.data.transition === "START"
                ? { kitchenStartedAt: new Date() }
                : { kitchenReadyAt: new Date() },
    });

    if (updated.count !== 1) {
        return {
            ok: false,
            error: "Status pesanan berubah. Muat ulang Kitchen Display.",
        };
    }

    revalidatePath("/app/fb/kitchen");

    return {
        ok: true,
        status: parsed.data.transition === "START" ? "COOKING" : "READY",
    };
}