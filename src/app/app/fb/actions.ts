"use server";

import { FBOrderStatus, Prisma, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

type ActionResult = { ok: true } | { ok: false; error: string };
type ReleasableTableStatus = Extract<
  TableStatus,
  "RESERVED" | "OUT_OF_SERVICE"
>;

const TableIdSchema = z.object({
  tableId: z.coerce.number().int().positive(),
});

async function canManageFbFloor() {
  const session = await auth();

  return session?.user.role === "FB";
}

function revalidateFbFloor() {
  revalidatePath("/app/fb");
}

async function setTableAvailableFromStatus(
  input: unknown,
  expectedStatus: ReleasableTableStatus,
): Promise<ActionResult> {
  if (!(await canManageFbFloor())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = TableIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invalid table" };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "restaurant_table" WHERE id = ${parsed.data.tableId} FOR UPDATE
        `;

        const table = await tx.restaurantTable.findUnique({
          where: { id: parsed.data.tableId },
          select: { id: true, number: true, status: true },
        });

        if (!table) {
          return { ok: false as const, error: "Table not found" };
        }

        if (table.status !== expectedStatus) {
          return {
            ok: false as const,
            error: `Meja ${table.number} sudah berubah status.`,
          };
        }

        const openOrder = await tx.fBOrder.findFirst({
          where: { tableId: table.id, status: FBOrderStatus.OPEN },
          select: { id: true },
        });

        if (openOrder) {
          return {
            ok: false as const,
            error: `Meja ${table.number} masih memiliki order terbuka.`,
          };
        }

        await tx.restaurantTable.update({
          where: { id: table.id },
          data: { status: TableStatus.AVAILABLE },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidateFbFloor();
    }

    return result;
  } catch {
    return { ok: false, error: "Terjadi kesalahan" };
  }
}

export async function releaseTableReservation(
  input: unknown,
): Promise<ActionResult> {
  return setTableAvailableFromStatus(input, TableStatus.RESERVED);
}

export async function setOutOfServiceTableAvailable(
  input: unknown,
): Promise<ActionResult> {
  return setTableAvailableFromStatus(input, TableStatus.OUT_OF_SERVICE);
}
