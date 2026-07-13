"use server";

import { ArticleType, FolioStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { PaymentSchema, PostChargeSchema } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid folio data";
}

async function canManageFoFolio() {
  const session = await auth();

  if (session?.user.role !== "FO") {
    return null;
  }

  return Number(session.user.id);
}

export async function postCharge(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoFolio();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PostChargeSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const folio = await prisma.folio.findUnique({
    where: { id: parsed.data.folioId },
    select: { id: true, status: true },
  });

  if (!folio) {
    return { ok: false, error: "Folio not found" };
  }

  if (folio.status !== FolioStatus.OPEN) {
    return { ok: false, error: "Cannot post to a closed folio" };
  }

  const article = await prisma.article.findUnique({
    where: { id: parsed.data.articleId },
    select: { id: true, name: true, type: true },
  });

  if (!article) {
    return { ok: false, error: "Article not found" };
  }

  if (article.type === ArticleType.TAX) {
    return { ok: false, error: "Tax is computed automatically" };
  }

  const description = parsed.data.description?.trim() || article.name;
  const amount = new Prisma.Decimal(parsed.data.quantity).mul(
    parsed.data.unitPrice,
  );

  await prisma.folioLineItem.create({
    data: {
      articleId: article.id,
      folioId: folio.id,
      description,
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice,
      amount,
      postedById: userId,
      postedAt: new Date(),
    },
  });

  await logActivity({
    userId,
    action: "FOLIO_CHARGE_POSTED",
    folioId: folio.id,
    metadata: { amount: amount.toNumber() },
  });

  revalidatePath(`/app/fo/folios/${folio.id}`);

  return { ok: true };
}

export async function recordPayment(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await canManageFoFolio();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const folio = await prisma.folio.findUnique({
    where: { id: parsed.data.folioId },
    select: { id: true, status: true },
  });

  if (!folio) {
    return { ok: false, error: "Folio not found" };
  }

  if (folio.status !== FolioStatus.OPEN) {
    return { ok: false, error: "Cannot record payment on a closed folio" };
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

  await logActivity({
    userId,
    action: "PAYMENT_RECORDED",
    folioId: folio.id,
    metadata: {
      amount: parsed.data.amount,
      method: parsed.data.method,
    },
  });

  revalidatePath(`/app/fo/folios/${folio.id}`);

  return { ok: true };
}
