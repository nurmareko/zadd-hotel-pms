import {
  ArticleType,
  FolioStatus,
  Prisma,
  ReservationStatus,
  ReservationStayFeeKind,
  ReservationStayFeeStatus,
} from "@prisma/client";

import { STAY_FEE_DEFINITIONS } from "@/lib/reservation-stay-fee-definitions";

export class ReservationStayFeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationStayFeeError";
  }
}

async function getStayFeeArticle(
  tx: Prisma.TransactionClient,
  kind: ReservationStayFeeKind,
  requireConfiguredPrice: boolean,
) {
  const definition = STAY_FEE_DEFINITIONS[kind];
  const article = await tx.article.findUnique({
    where: { code: definition.articleCode },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      defaultPrice: true,
    },
  });

  if (
    !article ||
    article.type !== ArticleType.MISC ||
    article.defaultPrice === null ||
    !article.defaultPrice.isInteger() ||
    article.defaultPrice.isNegative() ||
    (requireConfiguredPrice &&
      !article.defaultPrice.equals(definition.unitPrice))
  ) {
    throw new ReservationStayFeeError(
      `Artikel ${definition.label} tidak tersedia atau harganya tidak valid.`,
    );
  }

  return article;
}

export async function createPendingReservationStayFees(
  tx: Prisma.TransactionClient,
  input: {
    reservationId: number;
    kinds: ReservationStayFeeKind[];
    selectedById: number;
  },
) {
  for (const kind of input.kinds) {
    const article = await getStayFeeArticle(tx, kind, true);

    await tx.reservationStayFee.create({
      data: {
        reservationId: input.reservationId,
        kind,
        unitPrice: article.defaultPrice!,
        status: ReservationStayFeeStatus.PENDING,
        selectedById: input.selectedById,
      },
    });
  }
}

export async function reactivatePendingReservationStayFee(
  tx: Prisma.TransactionClient,
  input: {
    feeId: number;
    kind: ReservationStayFeeKind;
    selectedById: number;
    selectedAt: Date;
  },
) {
  const article = await getStayFeeArticle(tx, input.kind, true);
  const updated = await tx.reservationStayFee.updateMany({
    where: {
      id: input.feeId,
      kind: input.kind,
      status: ReservationStayFeeStatus.CANCELLED,
      folioLineItemId: null,
    },
    data: {
      unitPrice: article.defaultPrice!,
      status: ReservationStayFeeStatus.PENDING,
      selectedById: input.selectedById,
      selectedAt: input.selectedAt,
      postedAt: null,
    },
  });

  if (updated.count !== 1) {
    throw new ReservationStayFeeError(
      "Status biaya berubah saat dipilih. Muat ulang lalu coba lagi.",
    );
  }
}

export async function cancelPendingReservationStayFees(
  tx: Prisma.TransactionClient,
  reservationId: number,
) {
  return tx.reservationStayFee.updateMany({
    where: {
      reservationId,
      status: ReservationStayFeeStatus.PENDING,
      folioLineItemId: null,
    },
    data: { status: ReservationStayFeeStatus.CANCELLED },
  });
}

export async function postPendingReservationStayFees(
  tx: Prisma.TransactionClient,
  input: {
    reservationId: number;
    folioId: number;
    postedById: number;
    postedAt: Date;
    kinds?: ReservationStayFeeKind[];
  },
) {
  const folio = await tx.folio.findUnique({
    where: { id: input.folioId },
    select: {
      id: true,
      reservationId: true,
      status: true,
      reservation: { select: { status: true } },
    },
  });

  if (!folio || folio.reservationId !== input.reservationId) {
    throw new ReservationStayFeeError("Folio reservasi tidak ditemukan.");
  }

  if (folio.status !== FolioStatus.OPEN) {
    throw new ReservationStayFeeError(
      "Biaya fleksibilitas tidak dapat diposting ke folio yang sudah ditutup.",
    );
  }

  if (folio.reservation.status !== ReservationStatus.CHECKED_IN) {
    throw new ReservationStayFeeError(
      "Biaya fleksibilitas hanya dapat diposting untuk reservasi yang sudah check-in.",
    );
  }

  const fees = await tx.reservationStayFee.findMany({
    where: {
      reservationId: input.reservationId,
      status: ReservationStayFeeStatus.PENDING,
      folioLineItemId: null,
      ...(input.kinds ? { kind: { in: input.kinds } } : {}),
    },
    orderBy: { id: "asc" },
  });

  for (const fee of fees) {
    if (!fee.unitPrice.isInteger() || fee.unitPrice.isNegative()) {
      throw new ReservationStayFeeError(
        `Snapshot harga ${STAY_FEE_DEFINITIONS[fee.kind].label} tidak valid.`,
      );
    }

    const article = await getStayFeeArticle(tx, fee.kind, false);
    const lineItem = await tx.folioLineItem.create({
      data: {
        folioId: folio.id,
        articleId: article.id,
        description: article.name,
        quantity: new Prisma.Decimal(1),
        unitPrice: fee.unitPrice,
        amount: fee.unitPrice,
        postedById: input.postedById,
        postedAt: input.postedAt,
      },
      select: { id: true },
    });
    const posted = await tx.reservationStayFee.updateMany({
      where: {
        id: fee.id,
        reservationId: input.reservationId,
        status: ReservationStayFeeStatus.PENDING,
        folioLineItemId: null,
      },
      data: {
        status: ReservationStayFeeStatus.POSTED,
        folioLineItemId: lineItem.id,
        postedAt: input.postedAt,
      },
    });

    if (posted.count !== 1) {
      throw new ReservationStayFeeError(
        `Biaya ${STAY_FEE_DEFINITIONS[fee.kind].label} berubah saat diposting.`,
      );
    }
  }

  return fees.length;
}
