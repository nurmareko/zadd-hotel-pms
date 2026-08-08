import {
  ArticleType,
  FolioStatus,
  PaymentMethod,
  PaymentPurpose,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { completeCheckout, recordFinalPayment } from "@/app/app/fo/check-out/[folioId]/actions";
import { postCharge, recordPayment } from "@/lib/folio/actions";
import { prisma } from "@/lib/prisma";
import {
  createArticle,
  createFolio,
  createFolioLine,
  createFolioPayment,
  createGuest,
  createHotelSettings,
  createReservationFixture,
  createRoom,
  createRoomType,
  createUser,
  resetTestDatabase,
} from "./fixtures";

const FROZEN_NOW = new Date("2026-08-05T05:00:00.000Z");
const ROOM_CHARGE = 100_000;

type UserFixture = Awaited<ReturnType<typeof createUser>>;
type ArticleFixture = Awaited<ReturnType<typeof createArticle>>;
type GuestFixture = Awaited<ReturnType<typeof createGuest>>;
type RoomTypeFixture = Awaited<ReturnType<typeof createRoomType>>;

let user: UserFixture;
let roomChargeArticle: ArticleFixture;
let guest: GuestFixture;
let roomType: RoomTypeFixture;

function paymentFormData({
  folioId,
  amount,
  balance,
}: {
  folioId: number;
  amount: number;
  balance?: number;
}) {
  const formData = new FormData();
  formData.set("folioId", String(folioId));
  formData.set("amount", String(amount));
  formData.set("method", PaymentMethod.CASH);

  if (balance !== undefined) {
    formData.set("balance", String(balance));
  }

  return formData;
}

function checkoutFormData(folioId: number, staleBalance?: number) {
  const formData = new FormData();
  formData.set("folioId", String(folioId));
  formData.set("confirmed", "true");

  if (staleBalance !== undefined) {
    formData.set("balance", String(staleBalance));
  }

  return formData;
}

function chargeFormData({
  folioId,
  articleId,
  description = "Laundry",
  quantity = 2,
  unitPrice = 25_000,
}: {
  folioId: number;
  articleId: number;
  description?: string;
  quantity?: number;
  unitPrice?: number;
}) {
  const formData = new FormData();
  formData.set("folioId", String(folioId));
  formData.set("articleId", String(articleId));
  formData.set("description", description);
  formData.set("quantity", String(quantity));
  formData.set("unitPrice", String(unitPrice));
  return formData;
}

async function createCheckoutFolio({
  folioStatus = FolioStatus.OPEN,
  paymentAmount,
}: {
  folioStatus?: FolioStatus;
  paymentAmount?: number;
} = {}) {
  const room = await createRoom(roomType.id, RoomStatus.OC);
  const { reservation, nights } = await createReservationFixture({
    userId: user.id,
    roomTypeId: roomType.id,
    guestId: guest.id,
    roomId: room.id,
    arrivalDate: "2026-08-05",
    nightlyRates: [ROOM_CHARGE],
    status: ReservationStatus.CHECKED_IN,
  });
  const folio = await createFolio(reservation.id, folioStatus);

  await createFolioLine({
    folioId: folio.id,
    articleId: roomChargeArticle.id,
    postedById: user.id,
    reservationNightId: nights[0].id,
    amount: ROOM_CHARGE,
  });

  if (paymentAmount !== undefined) {
    await createFolioPayment({
      folioId: folio.id,
      receivedById: user.id,
      amount: paymentAmount,
    });
  }

  return { folio, reservation, room };
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

beforeEach(async () => {
  await resetTestDatabase();

  user = await createUser();
  await createHotelSettings({ serviceChargePercent: 0, taxPercent: 0 });
  roomChargeArticle = await createArticle({
    code: "ROOM-CHARGE",
    name: "Room Charge",
    type: ArticleType.ROOM,
    defaultPrice: null,
  });
  roomType = await createRoomType({ baseRate: ROOM_CHARGE });
  guest = await createGuest();
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("postCharge", () => {
  it("rejects posting a manual charge when a stale read observes a closed folio as open", async () => {
    const { folio } = await createCheckoutFolio({
      folioStatus: FolioStatus.CLOSED,
    });
    const article = await createArticle({
      code: "LAUNDRY",
      name: "Laundry",
      type: ArticleType.MISC,
      defaultPrice: 25_000,
    });
    const staleFolioLookup = vi
      .spyOn(prisma.folio, "findUnique")
      .mockResolvedValueOnce({
        ...folio,
        status: FolioStatus.OPEN,
      });

    let result: Awaited<ReturnType<typeof postCharge>>;
    try {
      result = await postCharge(
        chargeFormData({ folioId: folio.id, articleId: article.id }),
      );
    } finally {
      staleFolioLookup.mockRestore();
    }

    expect(result).toEqual({
      ok: false,
      error: "Tidak dapat memposting charge ke folio yang sudah ditutup",
    });
    expect(
      await prisma.folioLineItem.count({
        where: { folioId: folio.id, articleId: article.id },
      }),
    ).toBe(0);
    expect(
      await prisma.activityLog.count({
        where: {
          userId: user.id,
          folioId: folio.id,
          action: "FOLIO_CHARGE_POSTED",
        },
      }),
    ).toBe(0);
  });

  it("posts a manual charge to an open folio with the computed amount and activity event", async () => {
    const { folio } = await createCheckoutFolio();
    const article = await createArticle({
      code: "LAUNDRY",
      name: "Laundry",
      type: ArticleType.MISC,
      defaultPrice: 25_000,
    });

    const result = await postCharge(
      chargeFormData({ folioId: folio.id, articleId: article.id }),
    );

    expect(result).toEqual({ ok: true });
    const lineItem = await prisma.folioLineItem.findFirstOrThrow({
      where: { folioId: folio.id, articleId: article.id },
    });
    expect(lineItem.description).toBe("Laundry");
    expect(lineItem.quantity.toNumber()).toBe(2);
    expect(lineItem.unitPrice.toNumber()).toBe(25_000);
    expect(lineItem.amount.toNumber()).toBe(50_000);
    expect(lineItem.postedById).toBe(user.id);
    expect(lineItem.postedAt).toEqual(FROZEN_NOW);
    const activity = await prisma.activityLog.findFirstOrThrow({
      where: {
        userId: user.id,
        folioId: folio.id,
        action: "FOLIO_CHARGE_POSTED",
      },
    });
    expect(activity.metadata).toEqual({ amount: 50_000 });
  });
});

describe("recordPayment", () => {
  it("rejects recording a payment on a closed folio", async () => {
    const { folio } = await createCheckoutFolio({
      folioStatus: FolioStatus.CLOSED,
    });

    const result = await recordPayment(
      paymentFormData({ folioId: folio.id, amount: ROOM_CHARGE }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Cannot record payment on a closed folio",
    });
    expect(await prisma.payment.count({ where: { folioId: folio.id } })).toBe(0);
  });
});

describe("recordFinalPayment", () => {
  it("rejects recording a final payment on a closed folio", async () => {
    const { folio } = await createCheckoutFolio({
      folioStatus: FolioStatus.CLOSED,
    });

    const result = await recordFinalPayment(
      paymentFormData({ folioId: folio.id, amount: ROOM_CHARGE }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Cannot record payment on a closed folio",
    });
    expect(await prisma.payment.count({ where: { folioId: folio.id } })).toBe(0);
  });

  it("records an exact recomputed balance as a settlement", async () => {
    const { folio } = await createCheckoutFolio();

    const result = await recordFinalPayment(
      paymentFormData({
        folioId: folio.id,
        amount: ROOM_CHARGE,
        balance: 1,
      }),
    );

    expect(result).toEqual({ ok: true });
    const payment = await prisma.payment.findFirstOrThrow({
      where: { folioId: folio.id },
    });
    expect(payment.amount.toNumber()).toBe(ROOM_CHARGE);
    expect(payment.purpose).toBe(PaymentPurpose.SETTLEMENT);
  });

  it("records a payment below the recomputed balance as a regular payment", async () => {
    const { folio } = await createCheckoutFolio();

    const result = await recordFinalPayment(
      paymentFormData({ folioId: folio.id, amount: 40_000 }),
    );

    expect(result).toEqual({ ok: true });
    const payment = await prisma.payment.findFirstOrThrow({
      where: { folioId: folio.id },
    });
    expect(payment.amount.toNumber()).toBe(40_000);
    expect(payment.purpose).toBe(PaymentPurpose.PAYMENT);
  });

  it("rejects an amount above the recomputed balance", async () => {
    const { folio } = await createCheckoutFolio();

    const result = await recordFinalPayment(
      paymentFormData({ folioId: folio.id, amount: ROOM_CHARGE + 1 }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Jumlah pembayaran melebihi saldo terbaru",
    });
    expect(await prisma.payment.count({ where: { folioId: folio.id } })).toBe(0);
  });
});

describe("completeCheckout", () => {
  it("blocks a positive recomputed balance despite a crafted stale balance field", async () => {
    const { folio, reservation, room } = await createCheckoutFolio();

    const result = await completeCheckout(checkoutFormData(folio.id, 0));

    expect(result).toEqual({
      ok: false,
      error: "Saldo masih belum lunas (Rp 100.000). Catat pembayaran final dahulu.",
    });

    const [storedFolio, storedReservation, storedRoom] = await Promise.all([
      prisma.folio.findUniqueOrThrow({ where: { id: folio.id } }),
      prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
      prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
    ]);
    expect(storedFolio.status).toBe(FolioStatus.OPEN);
    expect(storedReservation.status).toBe(ReservationStatus.CHECKED_IN);
    expect(storedRoom.status).toBe(RoomStatus.OC);
  });

  it("allows a zero balance and closes the folio, checks out the reservation, and marks the room VD", async () => {
    const { folio, reservation, room } = await createCheckoutFolio({
      paymentAmount: ROOM_CHARGE,
    });

    const result = await completeCheckout(checkoutFormData(folio.id));

    expect(result).toEqual({ ok: true });
    const [storedFolio, storedReservation, storedRoom] = await Promise.all([
      prisma.folio.findUniqueOrThrow({ where: { id: folio.id } }),
      prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
      prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
    ]);
    expect(storedFolio.status).toBe(FolioStatus.CLOSED);
    expect(storedFolio.closedAt).not.toBeNull();
    expect(storedReservation.status).toBe(ReservationStatus.CHECKED_OUT);
    expect(storedRoom.status).toBe(RoomStatus.VD);
  });

  it("allows a credit balance and completes all checkout state transitions", async () => {
    const { folio, reservation, room } = await createCheckoutFolio({
      paymentAmount: ROOM_CHARGE + 25_000,
    });

    const result = await completeCheckout(checkoutFormData(folio.id));

    expect(result).toEqual({ ok: true });
    const [storedFolio, storedReservation, storedRoom] = await Promise.all([
      prisma.folio.findUniqueOrThrow({ where: { id: folio.id } }),
      prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
      prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
    ]);
    expect(storedFolio.status).toBe(FolioStatus.CLOSED);
    expect(storedReservation.status).toBe(ReservationStatus.CHECKED_OUT);
    expect(storedRoom.status).toBe(RoomStatus.VD);
  });
});
