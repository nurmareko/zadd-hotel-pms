import {
  ArrangementType,
  FBOrderStatus,
  FolioStatus,
  Prisma,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { addDays } from "date-fns";

import {
  hotelTodayDateOnly,
  hotelTodayISO,
  hotelTodayTimestampRange,
} from "@/lib/date-only";
import { formatLongDateID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import {
  ROOM_CHARGE_ARTICLE_CODE,
  stayChargeShortfallLines,
  StayChargePostingError,
  stayNightsThroughAuditDate,
  STAY_CHARGE_ARTICLE_CODES,
  type ExistingStayChargeLine,
  type StayChargeArticle,
  type StayChargeArticleCode,
  type StayChargePostingBlocker,
  type StayChargeReservationNight,
} from "@/lib/stay-charges";

// Re-exported under the night-audit name for the article codes/preview API.
const NIGHT_AUDIT_POSTING_ARTICLE_CODES = STAY_CHARGE_ARTICLE_CODES;
type NightAuditPostingArticleCode = StayChargeArticleCode;

const ZERO = new Prisma.Decimal(0);

type NightAuditReservation = {
  id: number;
  reservationNo: string;
  status: ReservationStatus;
  arrangementType: ArrangementType;
  arrivalDate: Date;
  departureDate: Date;
  reservationNights: StayChargeReservationNight[];
  guest: { fullName: string };
  room: { number: string } | null;
  folio: {
    id: number;
    folioNo: string;
    status: FolioStatus;
    lineItems: ExistingStayChargeLine[];
  } | null;
};

/**
 * The per-reservation data needed to recompute and post stay-charge shortfalls
 * inside the commit transaction (race-safe re-read), independent of the preview
 * line items the plan also builds.
 */
export type NightAuditStayChargeReservation = {
  reservationId: number;
  reservationNo: string;
  folioId: number;
  arrivalDate: Date;
  departureDate: Date;
  reservationNights: StayChargeReservationNight[];
};

export type NightAuditLineItemInput = {
  folioId: number;
  articleId: number;
  fbOrderId: null;
  reservationNightId: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
  postedById: number;
  postedAt: Date;
};

export type NightAuditSnapshotInput = {
  businessDate: Date;
  runById: number;
  totalRooms: number;
  roomsOccupied: number;
  occupancyRate: Prisma.Decimal;
  roomRevenue: Prisma.Decimal;
  fbRevenue: Prisma.Decimal;
  otherRevenue: Prisma.Decimal;
  totalRevenue: Prisma.Decimal;
  checkInCount: number;
  checkOutCount: number;
  inHouseCount: number;
};

export type NightAuditPostingArticlePreview = {
  code: NightAuditPostingArticleCode;
  name: string;
  amountSource: "room-rate-snapshot" | "meal-snapshot";
  amount: string | null;
};

export type NightAuditPreviewReservation = {
  id: number;
  reservationNo: string;
  guestName: string;
  roomNumber: string;
  folioNo: string;
  arrangementType: ArrangementType;
  lineItemCount: number;
  postingTotal: string;
};

export type NightAuditBlockerKind =
  | "MISSING_POSTING_ARTICLE"
  | "MISSING_FOLIO"
  | "FOLIO_NOT_OPEN"
  | StayChargePostingBlocker["kind"];

export type NightAuditBlocker = {
  kind: NightAuditBlockerKind;
  reservation: {
    id: number;
    reservationNo: string;
    guestName: string;
    roomNumber: string | null;
    status: ReservationStatus;
    arrivalDate: Date;
    departureDate: Date;
  } | null;
  folio: {
    id: number;
    folioNo: string;
    status: FolioStatus;
  } | null;
  affectedDate: Date | null;
  isFutureDate: boolean;
  currentValues: Record<string, string | number | null>;
  explanation: string;
  resolution: string;
  message: string;
};

export type NightAuditPlan = {
  businessDate: Date;
  businessDateLabel: string;
  timestampStart: Date;
  timestampEnd: Date;
  existingAudit: {
    id: number;
    runAt: Date;
    runByName: string;
    roomRevenue: string;
    fbRevenue: string;
    otherRevenue: string;
    totalRevenue: string;
    roomsOccupied: number;
    totalRooms: number;
    occupancyRate: string;
    inHouseCount: number;
  } | null;
  openFbOrderCount: number;
  arrangementBreakdown: Record<ArrangementType, number>;
  inHouseCount: number;
  lineItemCount: number;
  roomChargeCount: number;
  inclusionCount: number;
  roomRevenue: string;
  fbInclusionRevenue: string;
  closedFbRevenue: string;
  fbRevenue: string;
  otherRevenue: string;
  totalRevenue: string;
  metrics: {
    totalRooms: number;
    roomsOccupied: number;
    occupancyRate: string;
    checkInCount: number;
    checkOutCount: number;
    inHouseCount: number;
  };
  postingLabel: string;
  postingArticles: NightAuditPostingArticlePreview[];
  reservations: NightAuditPreviewReservation[];
  warnings: string[];
  blockingErrors: NightAuditBlocker[];
  snapshot: NightAuditSnapshotInput;
};

function businessDateLabel(date: Date) {
  return formatLongDateID(date);
}

function decimal(
  value: Prisma.Decimal | number | string | null | undefined,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  return new Prisma.Decimal(value ?? 0);
}

function addDecimal(
  values: Array<Prisma.Decimal | number | string | null | undefined>,
): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (sum, value) => sum.plus(decimal(value)),
    new Prisma.Decimal(0),
  );
}



function occupancyRate(roomsOccupied: number, totalRooms: number) {
  if (totalRooms === 0) {
    return ZERO;
  }

  return new Prisma.Decimal(roomsOccupied)
    .mul(100)
    .div(totalRooms)
    .toDecimalPlaces(2);
}

function futureDateContext(affectedDate: Date | null, businessDate: Date) {
  return affectedDate !== null && affectedDate.getTime() > businessDate.getTime();
}

function blockerMessage({
  reservation,
  affectedDate,
  explanation,
  resolution,
}: Pick<
  NightAuditBlocker,
  "reservation" | "affectedDate" | "explanation" | "resolution"
>) {
  const heading = reservation
    ? `Reservasi ${reservation.reservationNo} — ${reservation.guestName}, Kamar ${reservation.roomNumber ?? "belum ditentukan"}`
    : "Konfigurasi Night Audit";
  const dateLine = affectedDate
    ? `Tanggal terdampak: ${businessDateLabel(affectedDate)}.`
    : null;

  return [heading, dateLine, explanation, resolution].filter(Boolean).join("\n");
}

function reservationContext(reservation: NightAuditReservation) {
  return {
    id: reservation.id,
    reservationNo: reservation.reservationNo,
    guestName: reservation.guest.fullName,
    roomNumber: reservation.room?.number ?? null,
    status: reservation.status,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
  };
}

function createBlocker(
  blocker: Omit<NightAuditBlocker, "message">,
): NightAuditBlocker {
  return { ...blocker, message: blockerMessage(blocker) };
}

function validatePostingArticles(
  articles: Awaited<ReturnType<typeof prisma.article.findMany>>,
  businessDate: Date,
) {
  const articleByCode = new Map(articles.map((article) => [article.code, article]));
  const blockingErrors: NightAuditBlocker[] = [];

  for (const code of NIGHT_AUDIT_POSTING_ARTICLE_CODES) {
    if (!articleByCode.has(code)) {
      const explanation = `Night Audit tidak dapat memposting charge karena artikel ${code} belum tersedia. Tanpa artikel ini, pendapatan dapat tercatat ke jenis charge yang salah atau tidak tercatat sama sekali.`;
      const resolution = `Minta Administrator menambahkan dan mengaktifkan artikel ${code}, lalu muat ulang Night Audit.`;
      blockingErrors.push(
        createBlocker({
          kind: "MISSING_POSTING_ARTICLE",
          reservation: null,
          folio: null,
          affectedDate: businessDate,
          isFutureDate: false,
          currentValues: { articleCode: code },
          explanation,
          resolution,
        }),
      );
    }
  }

  return { articleByCode, blockingErrors };
}

function buildPostingArticlesPreview(
  articleByCode: Map<string, Awaited<ReturnType<typeof prisma.article.findMany>>[number]>,
): NightAuditPostingArticlePreview[] {
  return NIGHT_AUDIT_POSTING_ARTICLE_CODES.map((code) => {
    const article = articleByCode.get(code);

    return {
      code,
      name: article?.name ?? code,
      amountSource:
        code === ROOM_CHARGE_ARTICLE_CODE
          ? "room-rate-snapshot"
          : "meal-snapshot",
      amount: null,
    };
  });
}

function validateReservations(
  reservations: NightAuditReservation[],
  businessDate: Date,
) {
  const blockingErrors: NightAuditBlocker[] = [];
  const warnings: string[] = [];

  for (const reservation of reservations) {
    const context = reservationContext(reservation);

    if (!reservation.folio) {
      const explanation = `Night Audit tidak dapat memposting charge untuk ${businessDateLabel(businessDate)} karena reservasi ini belum memiliki folio. Melanjutkan tanpa folio berisiko membuat charge masa inap tidak tercatat pada tagihan tamu.`;
      const resolution = "Buat folio untuk reservasi ini, lalu muat ulang Night Audit.";
      blockingErrors.push(
        createBlocker({
          kind: "MISSING_FOLIO",
          reservation: context,
          folio: null,
          affectedDate: businessDate,
          isFutureDate: false,
          currentValues: { folioStatus: null },
          explanation,
          resolution,
        }),
      );
      continue;
    }

    if (reservation.folio.status !== FolioStatus.OPEN) {
      const explanation = `Night Audit tidak dapat memposting charge untuk ${businessDateLabel(businessDate)} ke folio ${reservation.folio.folioNo} karena statusnya ${reservation.folio.status}. Memposting ke folio yang tidak OPEN berisiko mengubah tagihan yang sudah ditutup atau tidak lagi aktif.`;
      const resolution = `Tinjau folio ${reservation.folio.folioNo}. Buka kembali folio bila penutupannya keliru, atau selesaikan status reservasi yang masih ${reservation.status}, lalu muat ulang Night Audit.`;
      blockingErrors.push(
        createBlocker({
          kind: "FOLIO_NOT_OPEN",
          reservation: context,
          folio: {
            id: reservation.folio.id,
            folioNo: reservation.folio.folioNo,
            status: reservation.folio.status,
          },
          affectedDate: businessDate,
          isFutureDate: false,
          currentValues: {
            folioStatus: reservation.folio.status,
            requiredFolioStatus: FolioStatus.OPEN,
          },
          explanation,
          resolution,
        }),
      );
    }
  }

  return { blockingErrors, warnings };
}

/**
 * Stay-charge line items the night audit should post for one reservation on
 * `businessDate`, computed as the shortfall against what is already on the folio
 * (room charge + snapshotted meals). Shared by the plan/preview (fed the
 * line items read up front) and the commit transaction (fed the line items
 * re-read inside the txn), so both are idempotent and identical in logic. A
 * normal nightly run yields exactly one night per article; a night the check-out
 * catch-up already posted yields zero.
 */
export function buildAuditStayChargeLines({
  reservation,
  existingLineItems,
  articles,
  businessDate,
  postedById,
  postedAt,
  label,
}: {
  reservation: NightAuditStayChargeReservation;
  existingLineItems: ExistingStayChargeLine[];
  articles: StayChargeArticle[];
  businessDate: Date;
  postedById: number;
  postedAt: Date;
  label: string;
}): NightAuditLineItemInput[] {
  const roomArticleId = articles.find(
    (article) => article.code === ROOM_CHARGE_ARTICLE_CODE,
  )?.id;

  const shortfall = stayChargeShortfallLines({
    reservationId: reservation.reservationId,
    reservationNo: reservation.reservationNo,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    expectedNights: stayNightsThroughAuditDate(
      reservation.arrivalDate,
      businessDate,
    ),
    reservationNights: reservation.reservationNights,
    lineItems: existingLineItems,
    articles,
  });

  return shortfall.map((line) => ({
    folioId: reservation.folioId,
    articleId: line.articleId,
    fbOrderId: null,
    reservationNightId: line.reservationNightId,
    description:
      line.articleId === roomArticleId
        ? `Night Audit Room Charge - ${label}`
        : `Night Audit ${line.article.name} Inclusion - ${label}`,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
    postedById,
    postedAt,
  }));
}

function blockerFromStayChargeError({
  error,
  reservation,
  businessDate,
}: {
  error: StayChargePostingError;
  reservation: NightAuditReservation;
  businessDate: Date;
}): NightAuditBlocker {
  const reason = error.blocker;
  const context = reservationContext(reservation);
  const folio = reservation.folio
    ? {
        id: reservation.folio.id,
        folioNo: reservation.folio.folioNo,
        status: reservation.folio.status,
      }
    : null;

  if (!reason) {
    const explanation = `Night Audit tidak dapat menyiapkan charge untuk reservasi ini. Melanjutkan berisiko menghasilkan tagihan masa inap yang tidak lengkap atau tidak akurat.`;
    const resolution = "Tinjau jadwal tarif dan Inklusi reservasi ini, perbaiki data yang tidak sesuai, lalu muat ulang Night Audit.";
    return createBlocker({
      kind: "INCOMPLETE_STAY_SCHEDULE",
      reservation: context,
      folio,
      affectedDate: businessDate,
      isFutureDate: false,
      currentValues: {},
      explanation,
      resolution,
    });
  }

  const affectedDate =
    reason.kind === "OUT_OF_ORDER_STAY_SCHEDULE"
      ? reason.expectedDate ?? reason.actualDate
      : reason.affectedDate;
  const isFutureDate = futureDateContext(affectedDate, businessDate);
  const futureExplanation = isFutureDate
    ? ` Tanggal ${businessDateLabel(affectedDate!)} adalah tanggal mendatang setelah business date ${businessDateLabel(businessDate)}. Night Audit memeriksa seluruh jadwal masa inap, sehingga tanggal mendatang ini harus diperbaiki sebelum business date dapat ditutup.`
    : "";
  let explanation: string;
  let resolution: string;
  let currentValues: Record<string, string | number | null>;

  switch (reason.kind) {
    case "INCOMPLETE_STAY_SCHEDULE":
      explanation = `Jadwal tarif reservasi tidak lengkap: masa inap memerlukan ${reason.expectedCount} malam, tetapi tarif hanya tersedia untuk ${reason.actualCount} malam. Night Audit berhenti agar tidak ada malam yang terlewat atau dikenakan tarif yang keliru.${futureExplanation}`;
      resolution = "Lengkapi tarif untuk setiap malam dari tanggal kedatangan sampai sebelum tanggal keberangkatan, lalu muat ulang Night Audit.";
      currentValues = {
        requiredNightCount: reason.expectedCount,
        availableNightCount: reason.actualCount,
      };
      break;
    case "OUT_OF_ORDER_STAY_SCHEDULE":
      explanation = `Jadwal tarif pada urutan ke-${reason.position} mencatat ${businessDateLabel(reason.actualDate)}, padahal seharusnya ${reason.expectedDate ? businessDateLabel(reason.expectedDate) : "tidak ada tanggal tambahan"}. Night Audit berhenti agar charge tidak diposting ke malam yang salah.${futureExplanation}`;
      resolution = "Perbaiki urutan tanggal tarif agar berurutan tanpa tanggal yang hilang atau berulang, lalu muat ulang Night Audit.";
      currentValues = {
        position: reason.position,
        requiredDate: reason.expectedDate?.toISOString().slice(0, 10) ?? null,
        recordedDate: reason.actualDate.toISOString().slice(0, 10),
      };
      break;
    case "NIGHT_OWNERSHIP_MISMATCH":
      explanation = `Tarif untuk malam ${businessDateLabel(reason.affectedDate)} terhubung ke reservasi lain. Night Audit berhenti agar charge tamu ini tidak masuk ke reservasi atau folio yang salah.${futureExplanation}`;
      resolution = "Hubungkan tarif malam tersebut ke reservasi yang benar, lalu muat ulang Night Audit.";
      currentValues = {
        nightId: reason.nightId,
        requiredReservationId: reason.expectedReservationId,
        recordedReservationId: reason.actualReservationId,
      };
      break;
    case "INVALID_ROOM_RATE":
      explanation = `Tarif Kamar untuk malam ${businessDateLabel(reason.affectedDate)} bernilai ${reason.rateAmount}. Nilai harus berupa rupiah bulat dan tidak boleh negatif agar pendapatan Kamar tidak salah.${futureExplanation}`;
      resolution = "Perbaiki Tarif Kamar malam tersebut ke nilai rupiah bulat yang tidak negatif, lalu muat ulang Night Audit.";
      currentValues = { nightId: reason.nightId, rateAmount: reason.rateAmount };
      break;
    case "INCOMPLETE_MEAL_VALUES":
      explanation = `Data Inklusi makan untuk malam ${businessDateLabel(reason.affectedDate)} belum lengkap. Night Audit berhenti agar charge Inklusi tidak kurang, berlebih, atau masuk dengan harga yang salah.${futureExplanation}`;
      resolution = "Lengkapi paket makan, jumlah tamu, harga per tamu, dan totalnya; atau hapus seluruh data Inklusi bila malam tersebut tidak memiliki paket makan. Setelah itu, muat ulang Night Audit.";
      currentValues = { nightId: reason.nightId };
      break;
    case "INVALID_MEAL_VALUES":
      explanation = `Data Inklusi makan untuk malam ${businessDateLabel(reason.affectedDate)} tidak valid. Jumlah tamu harus minimal satu, nilai rupiah harus bulat dan tidak negatif, serta total harus sama dengan harga per tamu dikali jumlah tamu.${futureExplanation}`;
      resolution = "Perbaiki paket dan nilai Inklusi malam tersebut, lalu muat ulang Night Audit.";
      currentValues = {
        nightId: reason.nightId,
        mealPlan: reason.mealPlan,
        mealPax: reason.mealPax,
        mealUnitPrice: reason.mealUnitPrice,
        mealAmount: reason.mealAmount,
      };
      break;
    case "INVALID_EXPECTED_NIGHT_COUNT":
      explanation = `Jumlah malam yang harus diposting bernilai ${reason.expectedCount}, sehingga Night Audit tidak dapat menentukan charge yang benar. Melanjutkan berisiko membuat tagihan masa inap kurang atau berlebih.${futureExplanation}`;
      resolution = "Periksa tanggal kedatangan dan business date reservasi, perbaiki tanggal yang tidak sesuai, lalu muat ulang Night Audit.";
      currentValues = { requiredNightCount: reason.expectedCount };
      break;
    case "STAY_SCHEDULE_SHORTFALL":
      explanation = `Night Audit tidak dapat memposting charge untuk malam ${businessDateLabel(reason.affectedDate)}. Reservasi masih berstatus ${reservation.status}, tetapi masa inap terjadwal berakhir pada ${businessDateLabel(reservation.departureDate)} dan belum ada tarif untuk malam tersebut. Memaksa proses berlanjut dapat membuat tagihan tamu tidak lengkap.${futureExplanation}`;
      resolution = "Jika tamu sudah berangkat, selesaikan check-out. Jika tamu masih menginap, perpanjang tanggal keberangkatan, lalu muat ulang Night Audit.";
      currentValues = {
        requiredNightCount: reason.expectedCount,
        availableNightCount: reason.actualCount,
      };
      break;
    case "UNSUPPORTED_MEAL_PLAN":
      explanation = `Paket makan ${reason.mealPlan} untuk malam ${businessDateLabel(reason.affectedDate)} tidak dapat diposting. Night Audit berhenti agar pendapatan F&B tidak masuk ke paket yang salah.${futureExplanation}`;
      resolution = "Pilih paket makan yang tersedia untuk malam tersebut atau hapus Inklusi jika tidak berlaku, lalu muat ulang Night Audit.";
      currentValues = { mealPlan: reason.mealPlan };
      break;
    case "MISSING_STAY_CHARGE_ARTICLE":
      explanation = `Night Audit tidak dapat memposting charge karena artikel ${reason.articleCode} belum tersedia. Tanpa artikel ini, pendapatan dapat tercatat ke jenis charge yang salah atau tidak tercatat sama sekali.${futureExplanation}`;
      resolution = `Minta Administrator menambahkan dan mengaktifkan artikel ${reason.articleCode}, lalu muat ulang Night Audit.`;
      currentValues = { articleCode: reason.articleCode };
      break;
  }

  return createBlocker({
    kind: reason.kind,
    reservation: context,
    folio,
    affectedDate,
    isFutureDate,
    currentValues,
    explanation,
    resolution,
  });
}

function buildLineItems({
  reservations,
  articles,
  businessDate,
  postedById,
  postedAt,
  label,
}: {
  reservations: NightAuditReservation[];
  articles: StayChargeArticle[];
  businessDate: Date;
  postedById: number;
  postedAt: Date;
  label: string;
}) {
  const lineItems: NightAuditLineItemInput[] = [];
  const previews: NightAuditPreviewReservation[] = [];
  const blockingErrors: NightAuditBlocker[] = [];

  for (const reservation of reservations) {
    if (!reservation.folio || reservation.folio.status !== FolioStatus.OPEN) {
      continue;
    }

    const folio = reservation.folio;
    let reservationLineItems: NightAuditLineItemInput[];

    try {
      reservationLineItems = buildAuditStayChargeLines({
        reservation: {
          reservationId: reservation.id,
          reservationNo: reservation.reservationNo,
          folioId: folio.id,
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
          reservationNights: reservation.reservationNights,
        },
        existingLineItems: folio.lineItems,
        articles,
        businessDate,
        postedById,
        postedAt,
        label,
      });
    } catch (error) {
      if (error instanceof StayChargePostingError) {
        blockingErrors.push(
          blockerFromStayChargeError({ error, reservation, businessDate }),
        );
        continue;
      }

      throw error;
    }

    // Folio already current for this business date (e.g. check-out catch-up
    // posted the night first): nothing to post, omit from the preview.
    if (reservationLineItems.length === 0) {
      continue;
    }

    lineItems.push(...reservationLineItems);
    previews.push({
      id: reservation.id,
      reservationNo: reservation.reservationNo,
      guestName: reservation.guest.fullName,
      roomNumber: reservation.room?.number ?? "-",
      folioNo: folio.folioNo,
      arrangementType: reservation.arrangementType,
      lineItemCount: reservationLineItems.length,
      postingTotal: addDecimal(
        reservationLineItems.map((lineItem) => lineItem.amount),
      ).toString(),
    });
  }

  return { lineItems, previews, blockingErrors };
}

export async function buildNightAuditPlan({
  runById,
  now = new Date(),
}: {
  runById: number;
  now?: Date;
}): Promise<NightAuditPlan> {
  const businessDate = hotelTodayDateOnly(now);
  const nextBusinessDate = addDays(businessDate, 1);
  // Snapshot windows and audit business date both follow the live WIB calendar
  // day, independent of the server clock timezone.
  const { start: timestampStart, end: timestampEnd } =
    hotelTodayTimestampRange(now);
  const postingLabel = hotelTodayISO(now);

  const [
    existingAudit,
    reservations,
    articles,
    openFbOrderCount,
    totalRooms,
    roomsOccupied,
    checkInCount,
    checkOutCount,
    closedFbRevenue,
    otherFolioRevenue,
  ] = await Promise.all([
    prisma.nightAudit.findUnique({
      where: { businessDate },
      include: { runBy: { select: { fullName: true } } },
    }),
    prisma.reservation.findMany({
      where: { status: ReservationStatus.CHECKED_IN },
      orderBy: { reservationNo: "asc" },
      select: {
        id: true,
        reservationNo: true,
        status: true,
        arrangementType: true,
        arrivalDate: true,
        departureDate: true,
        reservationNights: {
          select: {
            id: true,
            reservationId: true,
            date: true,
            rateAmount: true,
            mealPlan: true,
            mealPax: true,
            mealUnitPrice: true,
            mealAmount: true,
          },
          orderBy: { date: "asc" },
        },
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        folio: {
          select: {
            id: true,
            folioNo: true,
            status: true,
            lineItems: {
              select: {
                articleId: true,
                fbOrderId: true,
                reservationNightId: true,
              },
            },
          },
        },
      },
    }),
    prisma.article.findMany({
      where: { code: { in: [...NIGHT_AUDIT_POSTING_ARTICLE_CODES] } },
      orderBy: { code: "asc" },
    }),
    prisma.fBOrder.count({
      where: { status: FBOrderStatus.OPEN },
    }),
    prisma.room.count(),
    prisma.room.count({
      where: { status: { in: [RoomStatus.OC, RoomStatus.OD] } },
    }),
    prisma.reservation.count({
      where: {
        arrivalDate: { gte: businessDate, lt: nextBusinessDate },
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
        },
      },
    }),
    prisma.reservation.count({
      where: {
        departureDate: { gte: businessDate, lt: nextBusinessDate },
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
        },
      },
    }),
    prisma.fBOrder.aggregate({
      where: {
        status: FBOrderStatus.CLOSED,
        closedAt: { gte: timestampStart, lt: timestampEnd },
      },
      _sum: { total: true },
    }),
    prisma.folioLineItem.aggregate({
      where: {
        postedAt: { gte: timestampStart, lt: timestampEnd },
        fbOrderId: null,
      },
      _sum: { amount: true },
    }),
  ]);

  const { articleByCode, blockingErrors: articleErrors } =
    validatePostingArticles(articles, businessDate);
  const { blockingErrors: reservationErrors, warnings: reservationWarnings } =
    validateReservations(reservations, businessDate);
  const {
    lineItems,
    previews,
    blockingErrors: schedulePostingErrors,
  } = buildLineItems({
    reservations,
    articles,
    businessDate,
    postedById: runById,
    postedAt: now,
    label: postingLabel,
  });

  const roomArticleId = articleByCode.get(ROOM_CHARGE_ARTICLE_CODE)?.id;
  const roomRevenue = addDecimal(
    lineItems
      .filter((lineItem) => lineItem.articleId === roomArticleId)
      .map((lineItem) => lineItem.amount),
  );
  const fbInclusionRevenue = addDecimal(
    lineItems
      .filter((lineItem) => lineItem.articleId !== roomArticleId)
      .map((lineItem) => lineItem.amount),
  );
  const closedFbOrderRevenue = decimal(closedFbRevenue._sum.total);
  const fbRevenue = fbInclusionRevenue.plus(closedFbOrderRevenue);
  const otherRevenue = decimal(otherFolioRevenue._sum.amount);
  const totalRevenue = roomRevenue.plus(fbRevenue).plus(otherRevenue);
  const computedOccupancyRate = occupancyRate(roomsOccupied, totalRooms);
  const arrangementBreakdown: Record<ArrangementType, number> = {
    [ArrangementType.RO]: 0,
    [ArrangementType.BB]: 0,
    [ArrangementType.HB]: 0,
    [ArrangementType.FB]: 0,
  };

  for (const reservation of reservations) {
    arrangementBreakdown[reservation.arrangementType] += 1;
  }

  const warnings = [...reservationWarnings];

  if (openFbOrderCount > 0) {
    warnings.push(
      `${openFbOrderCount} order F&B masih terbuka - pertimbangkan untuk menyelesaikan dulu.`,
    );
  }



  const roomLineCount = lineItems.filter(
    (lineItem) => lineItem.articleId === roomArticleId,
  ).length;



  return {
    businessDate,
    businessDateLabel: businessDateLabel(businessDate),
    timestampStart,
    timestampEnd,
    existingAudit: existingAudit
      ? {
          id: existingAudit.id,
          runAt: existingAudit.runAt,
          runByName: existingAudit.runBy.fullName,
          roomRevenue: existingAudit.roomRevenue.toString(),
          fbRevenue: existingAudit.fbRevenue.toString(),
          otherRevenue: existingAudit.otherRevenue.toString(),
          totalRevenue: existingAudit.totalRevenue.toString(),
          roomsOccupied: existingAudit.roomsOccupied,
          totalRooms: existingAudit.totalRooms,
          occupancyRate: existingAudit.occupancyRate.toString(),
          inHouseCount: existingAudit.inHouseCount,
        }
      : null,
    openFbOrderCount,
    arrangementBreakdown,
    inHouseCount: reservations.length,
    lineItemCount: lineItems.length,
    roomChargeCount: previews.length,
    inclusionCount: lineItems.length - roomLineCount,
    roomRevenue: roomRevenue.toString(),
    fbInclusionRevenue: fbInclusionRevenue.toString(),
    closedFbRevenue: closedFbOrderRevenue.toString(),
    fbRevenue: fbRevenue.toString(),
    otherRevenue: otherRevenue.toString(),
    totalRevenue: totalRevenue.toString(),
    metrics: {
      totalRooms,
      roomsOccupied,
      occupancyRate: computedOccupancyRate.toString(),
      checkInCount,
      checkOutCount,
      inHouseCount: reservations.length,
    },
    postingLabel,
    postingArticles: buildPostingArticlesPreview(articleByCode),
    reservations: previews,
    warnings,
    blockingErrors: [
      ...articleErrors,
      ...reservationErrors,
      ...schedulePostingErrors,
    ],
    snapshot: {
      businessDate,
      runById,
      totalRooms,
      roomsOccupied,
      occupancyRate: computedOccupancyRate,
      roomRevenue,
      fbRevenue,
      otherRevenue,
      totalRevenue,
      checkInCount,
      checkOutCount,
      inHouseCount: reservations.length,
    },
  };
}
