import { HousekeepingNotificationStatus, Prisma } from "@prisma/client";
import { formatISO } from "date-fns";

import { prisma } from "@/lib/prisma";

type NotificationTransaction = Prisma.TransactionClient;

export async function upsertHousekeepingNotification(
  tx: NotificationTransaction,
  {
    assignmentId,
    recipientId,
    status,
  }: {
    assignmentId: number;
    recipientId: number;
    status: HousekeepingNotificationStatus;
  },
) {
  return tx.housekeepingNotification.upsert({
    where: {
      assignmentId_recipientId_status: {
        assignmentId,
        recipientId,
        status,
      },
    },
    create: {
      assignmentId,
      recipientId,
      status,
    },
    update: {},
  });
}

export type HousekeepingNotificationItem = {
  id: number;
  roomId: number;
  roomNumber: string;
  taskType: string;
  status: HousekeepingNotificationStatus;
  assignmentInfo: string;
  createdAt: string;
  readAt: string | null;
  href: string;
};

function taskTypeForStatus(status: string) {
  if (status === "VD") {
    return "Turnover";
  }

  if (status === "OD") {
    return "Freshen-up";
  }

  return "Pembersihan kamar";
}

export async function getHousekeepingNotifications(userId: number) {
  const notifications = await prisma.housekeepingNotification.findMany({
    where: {
      recipientId: userId,
      assignment: { housekeeperId: userId },
    },
    include: {
      assignment: {
        select: {
          roomId: true,
          date: true,
          room: { select: { number: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const sessionKeys = notifications.map((notification) => ({
    roomId: notification.assignment.roomId,
    date: notification.assignment.date,
  }));
  const sessions = sessionKeys.length
    ? await prisma.cleaningSession.findMany({
        where: {
          housekeeperId: userId,
          OR: sessionKeys,
        },
        orderBy: { createdAt: "desc" },
        select: {
          roomId: true,
          date: true,
          startedAt: true,
          finishedAt: true,
        },
      })
    : [];
  const sessionsByKey = new Map<string, (typeof sessions)[number]>();

  for (const session of sessions) {
    const key = `${session.roomId}:${formatISO(session.date, { representation: "date" })}`;

    if (!sessionsByKey.has(key)) {
      sessionsByKey.set(key, session);
    }
  }

  const items = notifications.flatMap<HousekeepingNotificationItem>((notification) => {
    const assignment = notification.assignment;
    const session = sessionsByKey.get(
      `${assignment.roomId}:${formatISO(assignment.date, { representation: "date" })}`,
    );

    if (session?.finishedAt) {
      return [];
    }

    const status = session?.startedAt
      ? HousekeepingNotificationStatus.IN_PROGRESS
      : HousekeepingNotificationStatus.ASSIGNED;

    return [{
      id: notification.id,
      roomId: assignment.roomId,
      roomNumber: assignment.room.number,
      taskType: taskTypeForStatus(assignment.room.status),
      status,
      assignmentInfo: "Ditugaskan kepada Anda",
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
      href: `/app/hk/rooms/${assignment.roomId}`,
    }];
  });

  return {
    items,
    unreadCount: items.filter((item) => !item.readAt).length,
  };
}