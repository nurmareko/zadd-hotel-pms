import { type ActivityAction, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type LogActivityInput = {
  userId: number;
  action: ActivityAction;
  reservationId?: number | null;
  folioId?: number | null;
  roomId?: number | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logActivity(
  input: LogActivityInput,
  tx?: Prisma.TransactionClient,
): Promise<boolean> {
  try {
    await (tx ?? prisma).activityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        reservationId: input.reservationId,
        folioId: input.folioId,
        roomId: input.roomId,
        metadata: input.metadata,
      },
    });

    return true;
  } catch (error) {
    // Transactional events are mandatory: let the owner roll back and retry.
    if (tx) throw error;
    console.error("Failed to write activity log", error);
    return false;
  }
}
