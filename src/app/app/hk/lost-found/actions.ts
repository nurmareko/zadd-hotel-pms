"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

import {
  CreateLostFoundItemSchema,
  ReturnLostFoundItemSchema,
} from "./schema";

const allowedRoles: AppRole[] = ["HK", "FO"];

async function requireLostFoundRole() {
  const session = await auth();

  if (!session?.user || !allowedRoles.includes(session.user.role)) {
    return null;
  }

  return Number(session.user.id);
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

export async function createLostFoundItem(
  formData: FormData,
): Promise<void> {
  const userId = await requireLostFoundRole();

  if (!userId) {
    return;
  }

  const parsed = CreateLostFoundItemSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return;
  }

  const { description, roomId } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (roomId) {
          const room = await tx.room.findUnique({
            where: { id: roomId },
            select: { id: true },
          });

          if (!room) {
            return { ok: false as const };
          }
        }

        await tx.lostFoundItem.create({
          data: {
            roomId,
            description,
            foundById: userId,
          },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidatePath("/app/hk/lost-found");
    }
  } catch (error) {
    if (isSerializationConflict(error)) {
      return;
    }
  }
}

export async function markLostFoundItemReturned(
  formData: FormData,
): Promise<void> {
  const canManageLostFound = await requireLostFoundRole();

  if (!canManageLostFound) {
    return;
  }

  const parsed = ReturnLostFoundItemSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return;
  }

  const { itemId, resolution } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const item = await tx.lostFoundItem.findUnique({
          where: { id: itemId },
          select: { id: true, status: true },
        });

        if (!item) {
          return { ok: false as const };
        }

        if (item.status === "RETURNED") {
          return { ok: false as const };
        }

        await tx.lostFoundItem.update({
          where: { id: itemId },
          data: {
            status: "RETURNED",
            returnedAt: new Date(),
            resolution,
          },
        });

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );

    if (result.ok) {
      revalidatePath("/app/hk/lost-found");
    }
  } catch (error) {
    if (isSerializationConflict(error)) {
      return;
    }
  }
}
