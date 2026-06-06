import { ReservationStatus, RoomStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { todayDateOnly } from "@/lib/date-only";
import { formatCompactDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { ActionPanel } from "./action-panel";
import { HousekeeperWorkPanel } from "./housekeeper-work-panel";
import { RoomHeader } from "./room-header";
import { RoomHistory } from "./room-history";
import { StatusInfo } from "./status-info";

export const revalidate = 0;

function nightsLabel(arrivalDate: Date, departureDate: Date) {
  const nights = Math.max(1, differenceInCalendarDays(departureDate, arrivalDate));

  return nights === 1 ? "1 malam" : `${nights} malam`;
}

function stayoverNightsLabel(date: Date, arrivalDate: Date, departureDate: Date) {
  const currentNight = Math.max(1, differenceInCalendarDays(date, arrivalDate) + 1);
  const totalNights = Math.max(1, differenceInCalendarDays(departureDate, arrivalDate));

  return `Malam ${Math.min(currentNight, totalNights)}/${totalNights}`;
}

function etaFromNotes(notes: string | null) {
  const etaMatch = notes?.match(/\bETA\s*:?\s*([0-2]?\d:[0-5]\d)\b/i);

  return etaMatch?.[1] ?? null;
}

function HousekeeperDeniedPanel() {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// Tugas Housekeeper"}
        </h2>
      </div>
      <p className="p-3.5 text-[12px] leading-relaxed text-slate-600">
        Kamar ini tidak masuk daftar tugas Anda hari ini. Aksi pembersihan hanya
        tersedia untuk housekeeper yang ditugaskan.
      </p>
    </section>
  );
}

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
  const session = await auth();
  const currentUserId = Number(session?.user.id);
  const canInspect =
    session?.user.role === "ADMIN" || isHkSupervisor(session);
  const isHousekeeperMember =
    session?.user.role === "HK" && !isHkSupervisor(session);
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
                { status: ReservationStatus.CHECKED_IN },
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
        include: { housekeeper: { select: { id: true, fullName: true } } },
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
  const currentGuest =
    room.reservations
      .filter((reservation) => reservation.status === ReservationStatus.CHECKED_IN)
      .sort((first, second) => first.departureDate.getTime() - second.departureDate.getTime())[0] ??
    null;
  const upcomingReservation =
    room.reservations
      .filter((reservation) => reservation.status === ReservationStatus.CONFIRMED)
      .sort((first, second) => first.arrivalDate.getTime() - second.arrivalDate.getTime())[0] ??
    null;
  const latestLog = room.housekeepingLogs[0] ?? null;
  const isAssignedToCurrentUser =
    isHousekeeperMember && assignment?.housekeeperId === currentUserId;
  const activeCleaningSessionForPanel =
    activeCleaningSession?.startedAt
      ? {
          startedAt: activeCleaningSession.startedAt,
          housekeeperName: activeCleaningSession.housekeeper.fullName,
        }
      : null;
  const latestCompletedCleaningSessionForPanel =
    latestCompletedCleaningSession?.startedAt &&
    latestCompletedCleaningSession.finishedAt
      ? {
          startedAt: latestCompletedCleaningSession.startedAt,
          finishedAt: latestCompletedCleaningSession.finishedAt,
          housekeeperName: latestCompletedCleaningSession.housekeeper.fullName,
        }
      : null;
  const activeSessionBelongsToCurrentUser =
    activeCleaningSession?.housekeeperId === currentUserId;
  const canStartCleaning =
    isAssignedToCurrentUser &&
    !activeCleaningSession &&
    (room.status === RoomStatus.VD || room.status === RoomStatus.OD);
  const canFinishCleaning =
    isAssignedToCurrentUser &&
    activeSessionBelongsToCurrentUser &&
    (room.status === RoomStatus.VD || room.status === RoomStatus.OD);
  const workContext = currentGuest
    ? {
        label: "Tamu in-house",
        guestName: currentGuest.guest.fullName,
        detail: stayoverNightsLabel(
          today,
          currentGuest.arrivalDate,
          currentGuest.departureDate,
        ),
        notes: currentGuest.notes,
      }
    : upcomingReservation
      ? {
          label: "Kedatangan berikutnya",
          guestName: upcomingReservation.guest.fullName,
          detail: `${formatCompactDateID(upcomingReservation.arrivalDate)} · ${nightsLabel(
            upcomingReservation.arrivalDate,
            upcomingReservation.departureDate,
          )}${
            etaFromNotes(upcomingReservation.notes)
              ? ` · ETA ${etaFromNotes(upcomingReservation.notes)}`
              : ""
          }`,
          notes: upcomingReservation.notes,
        }
      : null;

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
          currentGuest={
            currentGuest
              ? {
                  guestName: currentGuest.guest.fullName,
                  notes: currentGuest.notes,
                }
              : null
          }
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
                  notes: upcomingReservation.notes,
                }
              : null
          }
        />
        {isAssignedToCurrentUser ? (
          <>
            <HousekeeperWorkPanel
              roomId={room.id}
              roomNumber={room.number}
              canStart={canStartCleaning}
              canFinish={canFinishCleaning}
              activeCleaningSession={activeCleaningSessionForPanel}
              latestCompletedCleaningSession={
                latestCompletedCleaningSessionForPanel
                  ? {
                      finishedAt:
                        latestCompletedCleaningSessionForPanel.finishedAt,
                    }
                  : null
              }
              workContext={workContext}
            />
            <RoomHistory logs={room.housekeepingLogs.slice(0, 5)} />
          </>
        ) : null}
        {isHousekeeperMember && !isAssignedToCurrentUser ? (
          <HousekeeperDeniedPanel />
        ) : null}
        {canInspect ? (
          <>
            <ActionPanel
              roomId={room.id}
              status={room.status}
              activeCleaningSession={activeCleaningSessionForPanel}
              latestCompletedCleaningSession={latestCompletedCleaningSessionForPanel}
              assignedHousekeeperName={assignment?.housekeeper.fullName ?? null}
            />
            <RoomHistory logs={room.housekeepingLogs} />
          </>
        ) : null}
      </div>
    </main>
  );
}
