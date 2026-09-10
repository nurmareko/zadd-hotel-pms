import {
  HousekeepingNotificationStatus,
  RoomStatus,
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getHousekeepingNotifications,
  upsertHousekeepingNotification,
} from "@/lib/housekeeping-notifications";
import { prisma } from "@/lib/prisma";

import {
  createRoom,
  createRoomType,
  createUser,
  resetTestDatabase,
} from "./fixtures";

const TEST_DATE = new Date("2026-08-05T00:00:00.000Z");

describe("housekeeping notifications", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates one assignment event and scopes it to the assigned housekeeper", async () => {
    const [staffA, staffB] = await Promise.all([createUser(), createUser()]);
    const roomType = await createRoomType();
    const room = await createRoom(roomType.id, RoomStatus.VD, "201");
    const assignment = await prisma.housekeepingAssignment.create({
      data: { roomId: room.id, housekeeperId: staffA.id, date: TEST_DATE },
    });

    await upsertHousekeepingNotification(prisma, {
      assignmentId: assignment.id,
      recipientId: staffA.id,
      status: HousekeepingNotificationStatus.ASSIGNED,
    });
    await upsertHousekeepingNotification(prisma, {
      assignmentId: assignment.id,
      recipientId: staffA.id,
      status: HousekeepingNotificationStatus.ASSIGNED,
    });

    const [staffANotifications, staffBNotifications, notificationCount] =
      await Promise.all([
        getHousekeepingNotifications(staffA.id),
        getHousekeepingNotifications(staffB.id),
        prisma.housekeepingNotification.count(),
      ]);

    expect(notificationCount).toBe(1);
    expect(staffANotifications.unreadCount).toBe(1);
    expect(staffANotifications.items[0]).toMatchObject({
      roomNumber: "201",
      taskType: "Turnover",
      status: HousekeepingNotificationStatus.ASSIGNED,
      assignmentInfo: "Ditugaskan kepada Anda",
      href: `/app/hk/rooms/${room.id}`,
    });
    expect(staffBNotifications.items).toHaveLength(0);
  });

  it("hides completed tasks while preserving assignment and notification history", async () => {
    const staff = await createUser();
    const roomType = await createRoomType();
    const room = await createRoom(roomType.id, RoomStatus.VD, "202");
    const assignment = await prisma.housekeepingAssignment.create({
      data: { roomId: room.id, housekeeperId: staff.id, date: TEST_DATE },
    });

    await prisma.cleaningSession.create({
      data: {
        roomId: room.id,
        housekeeperId: staff.id,
        date: TEST_DATE,
        startedAt: new Date("2026-08-05T01:00:00.000Z"),
      },
    });
    await upsertHousekeepingNotification(prisma, {
      assignmentId: assignment.id,
      recipientId: staff.id,
      status: HousekeepingNotificationStatus.IN_PROGRESS,
    });

    let result = await getHousekeepingNotifications(staff.id);
    expect(result.items[0]?.status).toBe(
      HousekeepingNotificationStatus.IN_PROGRESS,
    );

    await prisma.cleaningSession.updateMany({
      where: { roomId: room.id, housekeeperId: staff.id, date: TEST_DATE },
      data: { finishedAt: new Date("2026-08-05T02:00:00.000Z") },
    });
    await upsertHousekeepingNotification(prisma, {
      assignmentId: assignment.id,
      recipientId: staff.id,
      status: HousekeepingNotificationStatus.COMPLETED,
    });

    const activeRoom = await createRoom(roomType.id, RoomStatus.OD, "204");
    const activeAssignment = await prisma.housekeepingAssignment.create({
      data: { roomId: activeRoom.id, housekeeperId: staff.id, date: TEST_DATE },
    });
    await upsertHousekeepingNotification(prisma, {
      assignmentId: activeAssignment.id,
      recipientId: staff.id,
      status: HousekeepingNotificationStatus.ASSIGNED,
    });

    result = await getHousekeepingNotifications(staff.id);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ roomNumber: "204" });
    expect(result.unreadCount).toBe(1);
    expect(await prisma.housekeepingNotification.count()).toBe(3);
    expect(
      await prisma.housekeepingAssignment.findUnique({
        where: { id: assignment.id },
      }),
    ).not.toBeNull();
  });

  it("marks only the recipient's notification as read", async () => {
    const [staffA, staffB] = await Promise.all([createUser(), createUser()]);
    const roomType = await createRoomType();
    const room = await createRoom(roomType.id, RoomStatus.OD, "203");
    const assignment = await prisma.housekeepingAssignment.create({
      data: { roomId: room.id, housekeeperId: staffA.id, date: TEST_DATE },
    });
    const notification = await upsertHousekeepingNotification(prisma, {
      assignmentId: assignment.id,
      recipientId: staffA.id,
      status: HousekeepingNotificationStatus.ASSIGNED,
    });

    const updated = await prisma.housekeepingNotification.updateMany({
      where: {
        id: notification.id,
        recipientId: staffA.id,
        assignment: { housekeeperId: staffA.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    const unauthorized = await prisma.housekeepingNotification.updateMany({
      where: {
        id: notification.id,
        recipientId: staffB.id,
        assignment: { housekeeperId: staffB.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    expect(updated.count).toBe(1);
    expect(unauthorized.count).toBe(0);
    expect((await getHousekeepingNotifications(staffA.id)).unreadCount).toBe(0);
  });
});