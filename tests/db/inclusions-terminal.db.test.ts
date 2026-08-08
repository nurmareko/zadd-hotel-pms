import {
  ArrangementType,
  ArticleType,
  GuestIdType,
  ReservationStatus,
  ReservationStayFeeKind,
  ReservationType,
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeReservationMealPlan,
  setReservationStayFee,
} from "@/app/app/fo/reservasi/[id]/actions";
import { updateReservation } from "@/app/app/fo/reservasi/new/actions";
import { prisma } from "@/lib/prisma";
import {
  postPendingStayCharges,
  ROOM_CHARGE_ARTICLE_CODE,
} from "@/lib/stay-charges";
import {
  createArticle,
  createFolio,
  createFolioLine,
  createGuest,
  createHotelSettings,
  createReservationFixture,
  createRoomType,
  createUser,
  resetTestDatabase,
} from "./fixtures";

const FROZEN_NOW = new Date("2026-08-05T05:00:00.000Z");

async function createStayChargeArticles() {
  const room = await createArticle({
    code: ROOM_CHARGE_ARTICLE_CODE,
    type: ArticleType.ROOM,
    name: "Room charge",
  });
  const bb = await createArticle({
    code: "MEAL-BB",
    type: ArticleType.FB,
    defaultPrice: 50_000,
    name: "Breakfast",
  });
  const hb = await createArticle({
    code: "MEAL-HB",
    type: ArticleType.FB,
    defaultPrice: 150_000,
    name: "Half board",
  });
  const fb = await createArticle({
    code: "MEAL-FB",
    type: ArticleType.FB,
    defaultPrice: 250_000,
    name: "Full board",
  });

  return { room, bb, hb, fb };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
  await resetTestDatabase();
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("inclusion snapshots and stay-charge posting", () => {
  it("changes only future unposted meal snapshots while elapsed and posted nights remain immutable", async () => {
    const user = await createUser();
    await createHotelSettings();
    const roomType = await createRoomType();
    const guest = await createGuest();
    const articles = await createStayChargeArticles();
    const { reservation, nights } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-08-04",
      nightlyRates: [500_000, 500_000, 500_000],
      status: ReservationStatus.CHECKED_IN,
      arrangementType: ArrangementType.BB,
      adults: 2,
      mealSnapshots: [
        {
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: 50_000,
          mealAmount: 100_000,
        },
        {
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: 50_000,
          mealAmount: 100_000,
        },
        {
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: 50_000,
          mealAmount: 100_000,
        },
      ],
    });
    const folio = await createFolio(reservation.id);
    await createFolioLine({
      folioId: folio.id,
      articleId: articles.bb.id,
      postedById: user.id,
      reservationNightId: nights[1]!.id,
      quantity: 2,
      unitPrice: 50_000,
      amount: 100_000,
    });

    const result = await changeReservationMealPlan({
      reservationId: reservation.id,
      arrangementType: ArrangementType.HB,
    });

    expect(result).toEqual({
      ok: true,
      effectiveDate: "2026-08-06",
      changedNights: 1,
    });

    const persistedReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { arrangementType: true },
    });
    const persistedNights = await prisma.reservationNight.findMany({
      where: { reservationId: reservation.id },
      orderBy: { date: "asc" },
      select: {
        mealPlan: true,
        mealPax: true,
        mealUnitPrice: true,
        mealAmount: true,
      },
    });

    expect(persistedReservation.arrangementType).toBe(ArrangementType.HB);
    expect(
      persistedNights.map((night) => ({
        mealPlan: night.mealPlan,
        mealPax: night.mealPax,
        mealUnitPrice: night.mealUnitPrice?.toNumber(),
        mealAmount: night.mealAmount?.toNumber(),
      })),
    ).toEqual([
      {
        mealPlan: ArrangementType.BB,
        mealPax: 2,
        mealUnitPrice: 50_000,
        mealAmount: 100_000,
      },
      {
        mealPlan: ArrangementType.BB,
        mealPax: 2,
        mealUnitPrice: 50_000,
        mealAmount: 100_000,
      },
      {
        mealPlan: ArrangementType.HB,
        mealPax: 2,
        mealUnitPrice: 150_000,
        mealAmount: 300_000,
      },
    ]);
  });

  it("posts mixed per-night FB and HB snapshots once with their matching articles and amounts", async () => {
    const user = await createUser();
    await createHotelSettings();
    const roomType = await createRoomType();
    const guest = await createGuest();
    await createStayChargeArticles();
    const { reservation } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-08-03",
      nightlyRates: [510_000, 520_000],
      status: ReservationStatus.CHECKED_IN,
      arrangementType: ArrangementType.HB,
      adults: 2,
      mealSnapshots: [
        {
          mealPlan: ArrangementType.FB,
          mealPax: 2,
          mealUnitPrice: 250_000,
          mealAmount: 500_000,
        },
        {
          mealPlan: ArrangementType.HB,
          mealPax: 2,
          mealUnitPrice: 150_000,
          mealAmount: 300_000,
        },
      ],
    });
    const folio = await createFolio(reservation.id);

    const firstPostedCount = await postPendingStayCharges({
      folioId: folio.id,
      postedById: user.id,
      now: FROZEN_NOW,
    });
    const secondPostedCount = await postPendingStayCharges({
      folioId: folio.id,
      postedById: user.id,
      now: FROZEN_NOW,
    });

    expect(firstPostedCount).toBe(4);
    expect(secondPostedCount).toBe(0);

    const lines = await prisma.folioLineItem.findMany({
      where: { folioId: folio.id },
      orderBy: [{ reservationNight: { date: "asc" } }, { article: { code: "asc" } }],
      select: {
        reservationNightId: true,
        article: { select: { code: true } },
        quantity: true,
        unitPrice: true,
        amount: true,
      },
    });

    expect(lines).toHaveLength(4);
    expect(
      lines.map((line) => ({
        articleCode: line.article.code,
        quantity: line.quantity.toNumber(),
        unitPrice: line.unitPrice.toNumber(),
        amount: line.amount.toNumber(),
      })),
    ).toEqual([
      {
        articleCode: "MEAL-FB",
        quantity: 2,
        unitPrice: 250_000,
        amount: 500_000,
      },
      {
        articleCode: ROOM_CHARGE_ARTICLE_CODE,
        quantity: 1,
        unitPrice: 510_000,
        amount: 510_000,
      },
      {
        articleCode: "MEAL-HB",
        quantity: 2,
        unitPrice: 150_000,
        amount: 300_000,
      },
      {
        articleCode: ROOM_CHARGE_ARTICLE_CODE,
        quantity: 1,
        unitPrice: 520_000,
        amount: 520_000,
      },
    ]);
    expect(new Set(lines.map((line) => line.reservationNightId)).size).toBe(2);
  });

  it("posts an earlier missing room night when a later night was posted first", async () => {
    const user = await createUser();
    await createHotelSettings();
    const roomType = await createRoomType();
    const guest = await createGuest();
    const { room } = await createStayChargeArticles();
    const { reservation, nights } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-08-03",
      nightlyRates: [510_000, 520_000],
      status: ReservationStatus.CHECKED_IN,
    });
    const folio = await createFolio(reservation.id);
    await createFolioLine({
      folioId: folio.id,
      articleId: room.id,
      postedById: user.id,
      reservationNightId: nights[1]!.id,
      amount: 520_000,
    });

    const postedCount = await postPendingStayCharges({
      folioId: folio.id,
      postedById: user.id,
      now: FROZEN_NOW,
    });
    const roomLines = await prisma.folioLineItem.findMany({
      where: { folioId: folio.id, articleId: room.id },
      orderBy: { reservationNight: { date: "asc" } },
      select: { reservationNightId: true, amount: true },
    });

    expect(postedCount).toBe(1);
    expect(roomLines.map((line) => line.reservationNightId)).toEqual([
      nights[0]!.id,
      nights[1]!.id,
    ]);
    expect(roomLines.map((line) => line.amount.toNumber())).toEqual([
      510_000,
      520_000,
    ]);
  });

  it("posts every linked room-night identity despite an unlinked ROOM-CHARGE line", async () => {
    const user = await createUser();
    await createHotelSettings();
    const roomType = await createRoomType();
    const guest = await createGuest();
    const { room } = await createStayChargeArticles();
    const { reservation, nights } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-08-03",
      nightlyRates: [510_000, 520_000],
      status: ReservationStatus.CHECKED_IN,
    });
    const folio = await createFolio(reservation.id);
    await createFolioLine({
      folioId: folio.id,
      articleId: room.id,
      postedById: user.id,
      reservationNightId: null,
      amount: 500_000,
    });

    const postedCount = await postPendingStayCharges({
      folioId: folio.id,
      postedById: user.id,
      now: FROZEN_NOW,
    });
    const roomLines = await prisma.folioLineItem.findMany({
      where: { folioId: folio.id, articleId: room.id },
      orderBy: { id: "asc" },
      select: { reservationNightId: true, amount: true },
    });

    expect(postedCount).toBe(2);
    expect(roomLines).toHaveLength(3);
    expect(roomLines[0]?.reservationNightId).toBeNull();
    expect(
      new Set(roomLines.slice(1).map((line) => line.reservationNightId)),
    ).toEqual(new Set(nights.map((night) => night.id)));
  });

  it.each([
    { pax: 2, expectedAmount: 100_000 },
    { pax: 3, expectedAmount: 150_000 },
  ])("posts BB for $pax pax as $expectedAmount IDR", async ({ pax, expectedAmount }) => {
    const user = await createUser();
    await createHotelSettings();
    const roomType = await createRoomType();
    const guest = await createGuest();
    await createStayChargeArticles();
    const { reservation } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-08-04",
      nightlyRates: [550_000],
      status: ReservationStatus.CHECKED_IN,
      arrangementType: ArrangementType.BB,
      adults: pax,
      mealSnapshots: [
        {
          mealPlan: ArrangementType.BB,
          mealPax: pax,
          mealUnitPrice: 50_000,
          mealAmount: expectedAmount,
        },
      ],
    });
    const folio = await createFolio(reservation.id);

    expect(
      await postPendingStayCharges({
        folioId: folio.id,
        postedById: user.id,
        now: FROZEN_NOW,
      }),
    ).toBe(2);

    const breakfastLine = await prisma.folioLineItem.findFirstOrThrow({
      where: { folioId: folio.id, article: { code: "MEAL-BB" } },
      select: { quantity: true, unitPrice: true, amount: true },
    });
    expect(breakfastLine.quantity.toNumber()).toBe(pax);
    expect(breakfastLine.unitPrice.toNumber()).toBe(50_000);
    expect(breakfastLine.amount.toNumber()).toBe(expectedAmount);
  });
});

describe.each([
  ReservationStatus.CHECKED_OUT,
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
])("terminal reservation status %s", (status) => {
  it("rejects inclusion, stay-fee, and valid reservation edits without guest or reservation writes", async () => {
    const user = await createUser();
    await createHotelSettings();
    const roomType = await createRoomType();
    const guest = await createGuest();
    const { reservation } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      arrivalDate: "2026-08-05",
      nightlyRates: [550_000],
      status,
      arrangementType: ArrangementType.BB,
      adults: 2,
      mealSnapshots: [
        {
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: 50_000,
          mealAmount: 100_000,
        },
      ],
    });

    const guestBefore = await prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    });
    const reservationBefore = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    const nightsBefore = await prisma.reservationNight.findMany({
      where: { reservationId: reservation.id },
      orderBy: { date: "asc" },
    });

    const mealPlanResult = await changeReservationMealPlan({
      reservationId: reservation.id,
      arrangementType: ArrangementType.HB,
    });
    const stayFeeResult = await setReservationStayFee({
      reservationId: reservation.id,
      kind: ReservationStayFeeKind.LATE_CHECK_OUT,
      selected: true,
    });
    const updateResult = await updateReservation(reservation.id, {
      fullName: "Nama yang tidak boleh tersimpan",
      idType: GuestIdType.KTP,
      idNumber: "EDITED-ID",
      phone: "081234567890",
      email: "edited@example.com",
      address: "Alamat yang tidak boleh tersimpan",
      nationality: "Indonesia",
      roomTypeId: roomType.id,
      roomId: null,
      arrivalDate: "2026-08-05",
      departureDate: "2026-08-06",
      adults: 2,
      children: 0,
      reservationType: ReservationType.INDIVIDUAL,
      arrangementType: ArrangementType.HB,
      notes: "Catatan yang tidak boleh tersimpan",
    });

    expect(mealPlanResult).toMatchObject({
      ok: false,
      disposition: "skipped",
    });
    expect(stayFeeResult).toMatchObject({
      ok: false,
      disposition: "skipped",
    });
    expect(updateResult).toMatchObject({ ok: false });

    const [guestAfter, reservationAfter, nightsAfter, stayFeeCount, lineItemCount] =
      await Promise.all([
        prisma.guest.findUniqueOrThrow({ where: { id: guest.id } }),
        prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
        prisma.reservationNight.findMany({
          where: { reservationId: reservation.id },
          orderBy: { date: "asc" },
        }),
        prisma.reservationStayFee.count({
          where: { reservationId: reservation.id },
        }),
        prisma.folioLineItem.count({
          where: { folio: { reservationId: reservation.id } },
        }),
      ]);

    expect(guestAfter).toEqual(guestBefore);
    expect(reservationAfter).toEqual(reservationBefore);
    expect(nightsAfter).toEqual(nightsBefore);
    expect(stayFeeCount).toBe(0);
    expect(lineItemCount).toBe(0);
  });
});
