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

export async function logActivity(input: LogActivityInput): Promise<boolean> {
  try {
    await prisma.activityLog.create({
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
    console.error("Failed to write activity log", error);
    return false;
  }
}
