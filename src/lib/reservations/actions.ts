"use server";

import { Prisma, ReservationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity-log";
import { FO_RESERVASI_VIEW_PATHS } from "@/lib/nav-preferences";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { cancelPendingReservationStayFees } from "@/lib/reservation-stay-fees";
import {
  reservationAuthorizationFailure,
  reservationFailure,
  unexpectedReservationFailure,
  type ReservationActionResult,
} from "@/app/app/fo/reservasi/new/reservation-errors";

type ReservationMutationAction = "create" | "edit" | "cancel";

type ReservationPostCommitSideEffect =
  | "activity-log"
  | "preference-cookie"
  | "revalidate-list"
  | "revalidate-detail"
  | "revalidate-calendar";

function logUnexpectedReservationAction(
  action: "quote" | ReservationMutationAction,
  error: unknown,
) {
  console.error("Reservation action failed", { action }, error);
}

async function attemptReservationPostCommitSideEffect(
  action: ReservationMutationAction,
  sideEffect: ReservationPostCommitSideEffect,
  operation: () => unknown | Promise<unknown>,
) {
  try {
    await operation();
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Reservation post-commit side effect failed",
      { action, sideEffect },
      error,
    );
  }
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  );
}

export async function cancelReservation(
  reservationId: number,
): Promise<ReservationActionResult> {
  let session: Session | null;

  try {
    session = await auth();
  } catch (error) {
    unstable_rethrow(error);
    logUnexpectedReservationAction("cancel", error);
    return unexpectedReservationFailure("cancel");
  }

  // Cancel is permitted for FO (who own the screen) and ADMIN.
  const authorizationFailure = reservationAuthorizationFailure(session, [
    "FO",
    "ADMIN",
  ]);

  if (authorizationFailure) {
    return authorizationFailure;
  }

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return reservationFailure("INVALID_RESERVATION_DATA");
  }

  const userId = Number(session?.user.id);
  let result: ReservationActionResult;

  try {
    result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          select: {
            id: true,
            status: true,
            folio: { select: { id: true } },
          },
        });

        if (!reservation) {
          return reservationFailure("RESERVATION_NOT_FOUND");
        }

        // Re-verify server-side; never trust the client's view of status.
        if (reservation.status !== ReservationStatus.CONFIRMED) {
          return reservationFailure("CANCELLATION_FAILED", {
            message:
              "Hanya reservasi berstatus CONFIRMED yang dapat dibatalkan.",
          });
        }

        // A CONFIRMED reservation should have no folio (created at check-in).
        // If one somehow exists, do NOT cancel and do NOT delete it.
        if (reservation.folio) {
          return reservationFailure("CANCELLATION_FAILED", {
            message:
              "Reservasi ini sudah memiliki folio. Periksa folio sebelum mencoba membatalkan reservasi.",
          });
        }

        const updated = await tx.reservation.updateMany({
          where: { id: reservationId, status: ReservationStatus.CONFIRMED },
          data: { status: ReservationStatus.CANCELLED },
        });

        if (updated.count === 0) {
          return reservationFailure("RESERVATION_CONFLICT");
        }

        await cancelPendingReservationStayFees(tx, reservationId);

        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...TRANSACTION_OPTIONS,
      },
    );
  } catch (error) {
    unstable_rethrow(error);
    if (isSerializationConflict(error)) {
      return reservationFailure("RESERVATION_CONFLICT");
    }

    logUnexpectedReservationAction("cancel", error);
    return unexpectedReservationFailure("cancel");
  }

  if (!result.ok) {
    return result;
  }

  await attemptReservationPostCommitSideEffect("cancel", "activity-log", () =>
    logActivity({
      userId,
      action: "RESERVATION_CANCELLED",
      reservationId,
    }),
  );
  await attemptReservationPostCommitSideEffect("cancel", "revalidate-list", () =>
    revalidatePath(FO_RESERVASI_VIEW_PATHS.list),
  );
  await attemptReservationPostCommitSideEffect(
    "cancel",
    "revalidate-detail",
    () => revalidatePath(`/app/fo/reservasi/${reservationId}`),
  );
  await attemptReservationPostCommitSideEffect(
    "cancel",
    "revalidate-calendar",
    () => revalidatePath(FO_RESERVASI_VIEW_PATHS.kalender),
  );
  return { ok: true };
}
