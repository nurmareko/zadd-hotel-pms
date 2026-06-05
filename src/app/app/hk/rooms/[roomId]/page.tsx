import { ReservationStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { todayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

import { ActionPanel } from "./action-panel";
import { RoomHeader } from "./room-header";
import { RoomHistory } from "./room-history";
import { StatusInfo } from "./status-info";

export const revalidate = 0;

export default async function HKRoomDetailPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const parsedRoomId = Number(roomId);

  if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
    notFound();
  }

  const { today } = todayDateOnly();
  const [room, activeCleaningSession, latestCompletedCleaningSession, assignment] =
    await Promise.all([
      prisma.room.findUnique({
        where: { id: parsedRoomId },
        include: {
          roomType: true,
          housekeepingLogs: {
            include: { updatedBy: { select: { fullName: true } } },
            orderBy: { updatedAt: "desc" },
            take: 20,
          },
          reservations: {
            where: {
              OR: [
                { status: ReservationStatus.CHECKED_OUT },
                {
                  status: ReservationStatus.CONFIRMED,
                  arrivalDate: { gte: today },
                },
              ],
            },
            include: { guest: { select: { fullName: true } } },
            orderBy: [{ departureDate: "desc" }, { arrivalDate: "asc" }],
          },
        },
      }),
      prisma.cleaningSession.findFirst({
        where: {
          roomId: parsedRoomId,
          startedAt: { not: null },
          finishedAt: null,
        },
        include: { housekeeper: { select: { fullName: true } } },
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.cleaningSession.findFirst({
        where: {
          roomId: parsedRoomId,
          startedAt: { not: null },
          finishedAt: { not: null },
        },
        include: { housekeeper: { select: { fullName: true } } },
        orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.housekeepingAssignment.findFirst({
        where: { roomId: parsedRoomId, date: today },
        include: { housekeeper: { select: { fullName: true } } },
      }),
    ]);

  if (!room) {
    notFound();
  }

  const recentGuest =
    room.reservations
      .filter((reservation) => reservation.status === ReservationStatus.CHECKED_OUT)
      .sort((first, second) => second.departureDate.getTime() - first.departureDate.getTime())[0] ??
    null;
  const upcomingReservation =
    room.reservations
      .filter((reservation) => reservation.status === ReservationStatus.CONFIRMED)
      .sort((first, second) => first.arrivalDate.getTime() - second.arrivalDate.getTime())[0] ??
    null;
  const latestLog = room.housekeepingLogs[0] ?? null;

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <RoomHeader
          roomNumber={room.number}
          roomTypeName={room.roomType.name}
          status={room.status}
        />
        <StatusInfo
          status={room.status}
          statusSince={latestLog?.updatedAt ?? null}
          recentGuest={
            recentGuest
              ? {
                  guestName: recentGuest.guest.fullName,
                  departureDate: recentGuest.departureDate,
                }
              : null
          }
          upcomingReservation={
            upcomingReservation
              ? {
                  guestName: upcomingReservation.guest.fullName,
                  arrivalDate: upcomingReservation.arrivalDate,
                }
              : null
          }
        />
        <ActionPanel
          roomId={room.id}
          status={room.status}
          activeCleaningSession={
            activeCleaningSession?.startedAt
              ? {
                  startedAt: activeCleaningSession.startedAt,
                  housekeeperName: activeCleaningSession.housekeeper.fullName,
                }
              : null
          }
          latestCompletedCleaningSession={
            latestCompletedCleaningSession?.startedAt &&
            latestCompletedCleaningSession.finishedAt
              ? {
                  startedAt: latestCompletedCleaningSession.startedAt,
                  finishedAt: latestCompletedCleaningSession.finishedAt,
                  housekeeperName:
                    latestCompletedCleaningSession.housekeeper.fullName,
                }
              : null
          }
          assignedHousekeeperName={assignment?.housekeeper.fullName ?? null}
        />
        <RoomHistory logs={room.housekeepingLogs} />
      </div>
    </main>
  );
}
