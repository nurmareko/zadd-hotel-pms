"use server";

import {
  FolioStatus,
  Prisma,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import { PaymentSchema } from "../../folios/[id]/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CompleteCheckoutSchema = z.object({
  folioId: z.coerce.number().int().positive("Folio is required"),
  confirmed: z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.literal(true, {
      error: "Confirmation is required before check-out",
    }),
  ),
});

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid check-out data";
}

async function canManageFoCheckout() {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return null;
  }

  return Number(session.user.id);
}

export async function recordFinalPayment(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoCheckout();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const [folio, settings] = await Promise.all([
    prisma.folio.findUnique({
      where: { id: parsed.data.folioId },
      include: {
        reservation: { select: { status: true } },
        lineItems: { include: { article: true } },
        payments: true,
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!folio) {
    return { ok: false, error: "Folio not found" };
  }

  if (!settings) {
    return { ok: false, error: "Hotel settings not found" };
  }

  if (folio.status !== FolioStatus.OPEN) {
    return { ok: false, error: "Cannot record payment on a closed folio" };
  }

  if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
    return {
      ok: false,
      error: "Reservation is not in checked-in state",
    };
  }

  const totals = computeFolioTotals(folio.lineItems, folio.payments, settings);
  const roundedBalance = Math.round(totals.balance);

  if (roundedBalance <= 0) {
    return { ok: false, error: "Tagihan sudah lunas" };
  }

  if (parsed.data.amount > totals.balance) {
    return {
      ok: false,
      error: "Jumlah pembayaran melebihi saldo terbaru",
    };
  }

  await prisma.payment.create({
    data: {
      folioId: folio.id,
      fbOrderId: null,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference || null,
      receivedById: userId,
      receivedAt: new Date(),
    },
  });

  revalidatePath(`/app/fo/check-out/${folio.id}`);
  revalidatePath(`/app/fo/folios/${folio.id}`);

  return { ok: true };
}

export async function completeCheckout(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoCheckout();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = CompleteCheckoutSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "folio" WHERE id = ${parsed.data.folioId} FOR UPDATE
      `;

      const [folio, settings] = await Promise.all([
        tx.folio.findUnique({
          where: { id: parsed.data.folioId },
          include: {
            reservation: {
              include: {
                room: { select: { id: true, status: true } },
              },
            },
            lineItems: { include: { article: true } },
            payments: true,
          },
        }),
        tx.hotelSettings.findUnique({ where: { id: 1 } }),
      ]);

      if (!folio) {
        return { ok: false as const, error: "Folio not found" };
      }

      if (!settings) {
        return { ok: false as const, error: "Hotel settings not found" };
      }

      if (folio.status === FolioStatus.CLOSED) {
        return { ok: true as const };
      }

      if (folio.status !== FolioStatus.OPEN) {
        return {
          ok: false as const,
          error: "Cannot check out a voided folio",
        };
      }

      if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
        return {
          ok: false as const,
          error: "Reservation is not in checked-in state",
        };
      }

      const totals = computeFolioTotals(folio.lineItems, folio.payments, settings);

      if (Math.round(totals.balance) > 0) {
        return {
          ok: false as const,
          error: "Saldo masih belum lunas. Catat pembayaran final dahulu.",
        };
      }

      const now = new Date();

      await tx.folio.update({
        where: { id: folio.id },
        data: {
          status: FolioStatus.CLOSED,
          closedAt: now,
        },
      });

      await tx.reservation.update({
        where: { id: folio.reservationId },
        data: { status: ReservationStatus.CHECKED_OUT },
      });

      if (folio.reservation.roomId) {
        await tx.room.update({
          where: { id: folio.reservation.roomId },
          data: { status: RoomStatus.VD },
        });
      }

      return { ok: true as const };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result.ok) {
    return result;
  }

  revalidatePath(`/app/fo/check-out/${parsed.data.folioId}`);
  revalidatePath(`/app/fo/folios/${parsed.data.folioId}`);
  revalidatePath("/app/fo/tape-chart");
  revalidatePath("/app/fo/reservations");
  revalidatePath("/app/hk");

  return { ok: true };
}
