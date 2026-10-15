"use server";

import { PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import {
  checkActionAuthorization, logActionFailure, runPostCommitSideEffects,
  UNIVERSAL_ACTION_MESSAGES,
} from "@/lib/action-errors";
import { assertBusinessDateOpen, NightAuditClosedError } from "@/lib/night-audit";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { calculateGuestLaundryTotal, GuestLaundryOrderSchema, type GuestLaundryOrderInput } from "./guest-schema";

const GUEST_LAUNDRY_CODES = new Set([
  "LND-KEMEJA", "LND-CELANA", "LND-JAS", "LND-GAUN", "LND-DRYCLEAN", "LAUNDRY",
]);
const MAX_ATTEMPTS = 3;
class GuestLaundryError extends Error {}
type Operator = { userId: number; role: AppRole };
type GuestLaundryResult = { ok: true; orderTotal: number; change: number } | { ok: false; error: string };

async function createGuestLaundryOperation(input: GuestLaundryOrderInput, operator: Operator) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Match the room → folio lock order used by in-house room-charge flows.
        await tx.$queryRaw`SELECT id FROM "room" WHERE id = ${input.roomId} FOR UPDATE`;
        const room = await tx.room.findUnique({ where: { id: input.roomId }, select: { id: true } });
        if (!room) throw new GuestLaundryError("Room not found.");
        const candidate = await tx.reservation.findFirst({
          where: { roomId: input.roomId, status: "CHECKED_IN" },
          select: { id: true, folio: { select: { id: true } } },
          orderBy: { id: "desc" },
        });
        if (!candidate) throw new GuestLaundryError("The room has no in-house guest.");
        if (!candidate.folio) throw new GuestLaundryError("Folio not found.");

        await tx.$queryRaw`SELECT id FROM "folio" WHERE id = ${candidate.folio.id} FOR UPDATE`;
        const currentRoom = await tx.room.findUnique({
          where: { id: input.roomId }, select: { id: true, number: true, status: true },
        });
        const reservation = await tx.reservation.findUnique({
          where: { id: candidate.id }, select: { id: true, roomId: true, status: true },
        });
        const folio = await tx.folio.findUnique({
          where: { id: candidate.folio.id }, select: { id: true, reservationId: true, status: true },
        });
        if (!currentRoom) throw new GuestLaundryError("Room not found.");
        if (currentRoom.status !== "OC" && currentRoom.status !== "OD") {
          throw new GuestLaundryError("Guest laundry can only be recorded for occupied rooms.");
        }
        if (!reservation || reservation.status !== "CHECKED_IN" || reservation.roomId !== input.roomId) {
          throw new GuestLaundryError("The guest is no longer staying in this room. Reload the page.");
        }
        if (!folio) throw new GuestLaundryError("Folio not found.");
        if (folio.reservationId !== reservation.id) throw new GuestLaundryError("The folio does not match the room reservation.");
        if (folio.status !== "OPEN") throw new GuestLaundryError("The folio is closed. Laundry cannot be recorded.");
        const currentOperator = await tx.user.findFirst({
          where: { id: operator.userId, isActive: true, roles: { some: { role: { code: operator.role } } } },
          select: { id: true },
        });
        if (!currentOperator) throw new GuestLaundryError(UNIVERSAL_ACTION_MESSAGES.FORBIDDEN);

        const articles = await tx.article.findMany({
          where: { id: { in: [...new Set(input.items.map((item) => item.articleId))] } },
          select: { id: true, code: true, name: true, type: true },
        });
        const articleById = new Map(articles.map((article) => [article.id, article]));
        for (const item of input.items) {
          const article = articleById.get(item.articleId);
          if (!article) throw new GuestLaundryError("Laundry article not found.");
          if (article.type !== "SERVICE" || !GUEST_LAUNDRY_CODES.has(article.code)) {
            throw new GuestLaundryError("The article is not an allowed guest laundry service.");
          }
        }

        const orderTotal = calculateGuestLaundryTotal(input.items);
        const now = new Date();
        await assertBusinessDateOpen(tx, now);
        const lineItemIds: number[] = [];
        for (const item of input.items) {
          const article = articleById.get(item.articleId)!;
          const line = await tx.folioLineItem.create({
            data: {
              folioId: folio.id, articleId: article.id,
              description: `Guest Laundry - ${article.name} (${item.quantity} pcs)`,
              quantity: item.quantity, unitPrice: new Prisma.Decimal(item.unitPrice),
              amount: new Prisma.Decimal(item.unitPrice).mul(item.quantity),
              postedById: operator.userId, postedAt: now,
            },
            select: { id: true },
          });
          lineItemIds.push(line.id);
        }

        let paymentId: number | null = null;
        let change = 0;
        // The schema requires a method and sufficient explicit tender for direct cash.
        const method: PaymentMethod = input.paymentMethod!;
        if (input.settlementType === "DIRECT_TENDER") {
          const paymentReference = input.notes
            ? `${method} - ${input.notes}`
            : `Laundry Direct Payment - Room ${currentRoom.number}`;
          change = method === "CASH" ? input.cashTendered! - orderTotal : 0;
          const payment = await tx.payment.create({
            data: {
              folioId: folio.id, fbOrderId: null, purpose: "PAYMENT",
              amount: new Prisma.Decimal(orderTotal), method,
              reference: paymentReference,
              receivedById: operator.userId, receivedAt: now,
            },
            select: { id: true },
          });
          paymentId = payment.id;
        }

        // Line items have no notes column. Keep full notes and order linkage in
        // the same transaction, without truncating descriptions or guest notes.
        await tx.activityLog.create({
          data: {
            userId: operator.userId, action: "FOLIO_CHARGE_POSTED", createdAt: now,
            reservationId: reservation.id, folioId: folio.id, roomId: currentRoom.id,
            metadata: {
              source: "GUEST_LAUNDRY", amount: orderTotal, settlementType: input.settlementType,
              notes: input.notes || null, lineItemIds, paymentId,
              ...(input.settlementType === "DIRECT_TENDER" ? {
                method,
                settlementMethod: method,
                ...(input.paymentMethod === "CASH" ? { cashTendered: input.cashTendered, change } : {}),
              } : {}),
            },
          },
        });
        return { orderTotal, change, reservationId: reservation.id, folioId: folio.id };
      }, { ...TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      unstable_rethrow(error);
      const conflict = error instanceof Prisma.PrismaClientKnownRequestError && (
        error.code === "P2034" ||
        (error.code === "P2010" && (error.meta?.code === "40001" || error.meta?.code === "40P01"))
      );
      if (!conflict) throw error;
      if (attempt === MAX_ATTEMPTS) {
        throw new GuestLaundryError("Room or folio data is being changed. Reload the page and try again.");
      }
    }
  }
  throw new GuestLaundryError("Failed to save guest laundry. Please try again.");
}

export async function createGuestLaundryOrder(input: unknown): Promise<GuestLaundryResult> {
  try {
    const session = await auth();
    const denied = checkActionAuthorization(session, "laundry:guest-order");
    if (denied) return { ok: false, error: denied.error };
    const userId = Number(session?.user?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2_147_483_647) {
      return { ok: false, error: UNIVERSAL_ACTION_MESSAGES.SESSION_EXPIRED };
    }
    const parsed = GuestLaundryOrderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid laundry data." };
    const result = await createGuestLaundryOperation(parsed.data, { userId, role: session!.user.role as AppRole });
    await runPostCommitSideEffects([
      `/app/fo/reservasi/${result.reservationId}`,
      "/app/hk/laundry", "/app/acc", `/app/acc/folios/${result.folioId}`,
      "/app/acc/night-audit", "/app/acc/accounting-export",
    ].map((path) => ({ name: `revalidate:${path}`, run: () => revalidatePath(path) })), {
      action: "createGuestLaundryOrder", stage: "post-commit", committed: true, folioId: result.folioId,
    });
    return { ok: true, orderTotal: result.orderTotal, change: result.change };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof GuestLaundryError || error instanceof NightAuditClosedError) {
      return { ok: false, error: error.message };
    }
    logActionFailure("createGuestLaundryOrder", error, { stage: "pre-commit", committed: false });
    return { ok: false, error: "Failed to save guest laundry. Please try again." };
  }
}
