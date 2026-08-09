import {
  ArticleType,
  DepositStatus,
  PaymentPurpose,
  ReservationStatus,
  ReservationStayFeeKind,
  ReservationStayFeeStatus,
  RoomStatus,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  collectCheckInDeposit,
  completeCheckIn,
} from "@/lib/check-in/actions";
import { prisma } from "@/lib/prisma";

import {
  createArticle,
  createFolio,
  createFolioPayment,
  createGuest,
  createReservationFixture,
  createRoom,
  createRoomType,
  createUser,
  resetTestDatabase,
} from "./fixtures";

const FROZEN_NOW = new Date("2026-08-05T05:00:00.000Z"); // 12:00 WIB
const FIRST_NIGHT_RATE = 325_000;

function depositFormData(
  reservationId: number,
  overrides: Record<string, string> = {},
) {
  const formData = new FormData();
  formData.set("reservationId", String(reservationId));
  formData.set("depositMethod", "CASH");
  formData.set("depositReference", "");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

function checkInFormData(
  reservationId: number,
  roomId: number,
  overrides: Record<string, string> = {},
) {
  const formData = new FormData();
  formData.set("reservationId", String(reservationId));
  formData.set("roomId", String(roomId));
  formData.set("guestFullName", "Tamu Setelah Check-in");
  formData.set("guestIdType", "KTP");
  formData.set("guestIdNumber", "3273010101010001");
  formData.set("guestPhone", "081234567890");
  formData.set("guestEmail", "tamu@example.com");
  formData.set("guestNationality", "Indonesia");
  formData.set("purposeOfVisit", "Bisnis");
  formData.set("purposeOfVisitOther", "");
  formData.set("signatureDataUrl", "data:image/png;base64,aGVsbG8=");
  formData.set("arrivalConfirmation", "on");
  formData.set("depositMethod", "");
  formData.set("depositReference", "");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

async function createBasicReservation(options: {
  arrivalDate?: string;
  depositStatus?: DepositStatus;
  roomStatus?: RoomStatus;
  nightlyRates?: number[];
} = {}) {
  const user = await createUser();
  const roomType = await createRoomType();
  const room = await createRoom(
    roomType.id,
    options.roomStatus ?? RoomStatus.VC,
  );
  const guest = await createGuest();
  const fixture = await createReservationFixture({
    userId: user.id,
    roomTypeId: roomType.id,
    guestId: guest.id,
    arrivalDate: options.arrivalDate,
    depositStatus: options.depositStatus,
    nightlyRates: options.nightlyRates ?? [FIRST_NIGHT_RATE, 410_000],
  });

  return { user, roomType, room, guest, ...fixture };
}

async function createConsistentCollectedDeposit(
  reservationId: number,
  userId: number,
  amount = FIRST_NIGHT_RATE,
) {
  const folio = await createFolio(reservationId);
  const payment = await createFolioPayment({
    folioId: folio.id,
    receivedById: userId,
    amount,
    purpose: PaymentPurpose.DEPOSIT,
  });

  return { folio, payment };
}

describe("check-in database actions", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FROZEN_NOW);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    vi.useRealTimers();
    await prisma.$disconnect();
  });

  describe("collectCheckInDeposit", () => {
    it("ignores a crafted amount, persists the first-night rate, and is idempotent with one DEPOSIT payment", async () => {
      const { reservation } = await createBasicReservation({
        nightlyRates: [FIRST_NIGHT_RATE, 999_000],
      });

      const firstResult = await collectCheckInDeposit(
        depositFormData(reservation.id, {
          amount: "1",
          depositAmount: "999999999",
        }),
      );
      const secondResult = await collectCheckInDeposit(
        depositFormData(reservation.id, { amount: "7" }),
      );

      expect(firstResult).toMatchObject({
        ok: true,
        payment: { amount: String(FIRST_NIGHT_RATE), method: "CASH" },
        alreadyCollected: false,
      });
      expect(secondResult).toMatchObject({
        ok: true,
        payment: { amount: String(FIRST_NIGHT_RATE), method: "CASH" },
        alreadyCollected: true,
      });

      const persisted = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: {
          deposit: true,
          depositStatus: true,
          folio: {
            select: {
              id: true,
              payments: {
                where: { purpose: PaymentPurpose.DEPOSIT },
                select: { amount: true },
              },
            },
          },
        },
      });

      expect(persisted.deposit.toString()).toBe(String(FIRST_NIGHT_RATE));
      expect(persisted.depositStatus).toBe(DepositStatus.COLLECTED);
      expect(persisted.folio).not.toBeNull();
      expect(persisted.folio?.payments).toHaveLength(1);
      expect(persisted.folio?.payments[0]?.amount.toString()).toBe(
        String(FIRST_NIGHT_RATE),
      );
      expect(await prisma.folio.count({ where: { reservationId: reservation.id } })).toBe(1);
    });

    it("rejects COLLECTED status without a matching deposit payment", async () => {
      const { reservation } = await createBasicReservation({
        depositStatus: DepositStatus.COLLECTED,
      });
      const folio = await createFolio(reservation.id);

      const result = await collectCheckInDeposit(
        depositFormData(reservation.id),
      );

      expect(result).toEqual({
        ok: false,
        error: "Status deposit tidak sesuai dengan pembayaran pada folio.",
      });
      expect(await prisma.payment.count({ where: { folioId: folio.id } })).toBe(0);
    });

    it("rejects a pre-existing DEPOSIT payment while status remains PENDING", async () => {
      const { user, reservation } = await createBasicReservation();
      const folio = await createFolio(reservation.id);
      await createFolioPayment({
        folioId: folio.id,
        receivedById: user.id,
        amount: FIRST_NIGHT_RATE,
        purpose: PaymentPurpose.DEPOSIT,
      });

      const result = await collectCheckInDeposit(
        depositFormData(reservation.id),
      );

      expect(result).toEqual({
        ok: false,
        error: "Pembayaran deposit sudah ada tetapi status deposit belum diperbarui.",
      });
      const persisted = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { depositStatus: true },
      });
      expect(persisted.depositStatus).toBe(DepositStatus.PENDING);
      expect(
        await prisma.payment.count({
          where: { folioId: folio.id, purpose: PaymentPurpose.DEPOSIT },
        }),
      ).toBe(1);
    });

    it("blocks collection before the WIB arrival date without creating a folio or payment", async () => {
      const { reservation } = await createBasicReservation({
        arrivalDate: "2026-08-06",
      });

      const result = await collectCheckInDeposit(
        depositFormData(reservation.id),
      );

      expect(result).toEqual({
        ok: false,
        error: "Deposit check-in baru dapat dikumpulkan pada hari kedatangan",
      });
      expect(await prisma.folio.count({ where: { reservationId: reservation.id } })).toBe(0);
      expect(await prisma.payment.count()).toBe(0);
    });

    it("reuses an existing open folio and commits the payment and reservation status together", async () => {
      const { reservation } = await createBasicReservation();
      const existingFolio = await createFolio(reservation.id);

      const result = await collectCheckInDeposit(
        depositFormData(reservation.id),
      );

      expect(result).toMatchObject({ ok: true, alreadyCollected: false });
      const persisted = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: {
          deposit: true,
          depositStatus: true,
          folio: {
            select: {
              id: true,
              payments: {
                where: { purpose: PaymentPurpose.DEPOSIT },
                select: { amount: true },
              },
            },
          },
        },
      });

      expect(persisted.folio?.id).toBe(existingFolio.id);
      expect(persisted.folio?.payments).toHaveLength(1);
      expect(persisted.deposit.toString()).toBe(String(FIRST_NIGHT_RATE));
      expect(persisted.depositStatus).toBe(DepositStatus.COLLECTED);
      expect(await prisma.folio.count({ where: { reservationId: reservation.id } })).toBe(1);
    });
  });

  describe("completeCheckIn", () => {
    it("blocks a PENDING deposit without mutating guest, reservation, or room", async () => {
      const { guest, reservation, room } = await createBasicReservation();

      const result = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );

      expect(result).toEqual({
        ok: false,
        error: "Deposit belum dibayar. Kumpulkan deposit sebelum check-in.",
      });
      const [persistedGuest, persistedReservation, persistedRoom] =
        await Promise.all([
          prisma.guest.findUniqueOrThrow({ where: { id: guest.id } }),
          prisma.reservation.findUniqueOrThrow({
            where: { id: reservation.id },
          }),
          prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
        ]);

      expect(persistedGuest.fullName).toBe(guest.fullName);
      expect(persistedReservation.status).toBe(ReservationStatus.CONFIRMED);
      expect(persistedReservation.roomId).toBeNull();
      expect(persistedReservation.grcFilledAt).toBeNull();
      expect(persistedRoom.status).toBe(RoomStatus.VC);
    });

    it("blocks COLLECTED status without a folio and leaves check-in state unchanged", async () => {
      const { guest, reservation, room } = await createBasicReservation({
        depositStatus: DepositStatus.COLLECTED,
      });

      const result = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );

      expect(result).toEqual({
        ok: false,
        error: "Folio deposit tidak ditemukan. Kumpulkan deposit sebelum check-in.",
      });
      const [persistedGuest, persistedReservation, persistedRoom] =
        await Promise.all([
          prisma.guest.findUniqueOrThrow({ where: { id: guest.id } }),
          prisma.reservation.findUniqueOrThrow({
            where: { id: reservation.id },
          }),
          prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
        ]);

      expect(persistedGuest.fullName).toBe(guest.fullName);
      expect(persistedReservation.status).toBe(ReservationStatus.CONFIRMED);
      expect(persistedReservation.roomId).toBeNull();
      expect(persistedRoom.status).toBe(RoomStatus.VC);
    });

    it("blocks an OOO room before mutation even when the deposit is consistent", async () => {
      const { user, guest, reservation, room } = await createBasicReservation({
        depositStatus: DepositStatus.COLLECTED,
        roomStatus: RoomStatus.OOO,
      });
      await createConsistentCollectedDeposit(reservation.id, user.id);

      const result = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );

      expect(result).toEqual({
        ok: false,
        error: `Kamar ${room.number} sedang out of order. Pilih kamar lain.`,
        field: "roomId",
      });
      const [persistedGuest, persistedReservation, persistedRoom] =
        await Promise.all([
          prisma.guest.findUniqueOrThrow({ where: { id: guest.id } }),
          prisma.reservation.findUniqueOrThrow({
            where: { id: reservation.id },
          }),
          prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
        ]);

      expect(persistedGuest.fullName).toBe(guest.fullName);
      expect(persistedReservation.status).toBe(ReservationStatus.CONFIRMED);
      expect(persistedReservation.roomId).toBeNull();
      expect(persistedRoom.status).toBe(RoomStatus.OOO);
    });

    it("atomically persists GRC data, checks in the reservation, and marks the room OC", async () => {
      const { user, guest, reservation, room } = await createBasicReservation({
        depositStatus: DepositStatus.COLLECTED,
      });
      const { folio } = await createConsistentCollectedDeposit(
        reservation.id,
        user.id,
      );

      const result = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );

      expect(result).toEqual({ ok: true });
      const [persistedGuest, persistedReservation, persistedRoom] =
        await Promise.all([
          prisma.guest.findUniqueOrThrow({ where: { id: guest.id } }),
          prisma.reservation.findUniqueOrThrow({
            where: { id: reservation.id },
          }),
          prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
        ]);

      expect(persistedGuest).toMatchObject({
        fullName: "Tamu Setelah Check-in",
        idType: "KTP",
        idNumber: "3273010101010001",
        phone: "081234567890",
        email: "tamu@example.com",
        nationality: "Indonesia",
      });
      expect(persistedReservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(persistedReservation.roomId).toBe(room.id);
      expect(persistedReservation.purposeOfVisit).toBe("Bisnis");
      expect(persistedReservation.signatureDataUrl).toBe(
        "data:image/png;base64,aGVsbG8=",
      );
      expect(persistedReservation.grcFilledAt).toEqual(FROZEN_NOW);
      expect(persistedReservation.signedAt).toEqual(FROZEN_NOW);
      expect(persistedReservation.deposit.toString()).toBe(
        String(FIRST_NIGHT_RATE),
      );
      expect(persistedRoom.status).toBe(RoomStatus.OC);
      expect(
        await prisma.activityLog.count({
          where: {
            reservationId: reservation.id,
            folioId: folio.id,
            roomId: room.id,
            action: "CHECK_IN_COMPLETED",
          },
        }),
      ).toBe(1);
    });

    it("posts a pending stay fee exactly once and does not duplicate it on a retry", async () => {
      const { user, reservation, room } = await createBasicReservation({
        depositStatus: DepositStatus.COLLECTED,
      });
      const { folio } = await createConsistentCollectedDeposit(
        reservation.id,
        user.id,
      );
      const feeArticle = await createArticle({
        code: "FEE-EARLY-CI",
        name: "Biaya Early Check-in",
        type: ArticleType.MISC,
        defaultPrice: 100_000,
      });
      const fee = await prisma.reservationStayFee.create({
        data: {
          reservationId: reservation.id,
          kind: ReservationStayFeeKind.EARLY_CHECK_IN,
          unitPrice: 100_000,
          status: ReservationStayFeeStatus.PENDING,
          selectedById: user.id,
        },
      });

      const firstResult = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );
      const retryResult = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );

      expect(firstResult).toEqual({ ok: true });
      expect(retryResult).toEqual({
        ok: false,
        error: "Reservasi tidak dalam status yang bisa check-in",
      });

      const persistedFee = await prisma.reservationStayFee.findUniqueOrThrow({
        where: { id: fee.id },
      });
      const feeLines = await prisma.folioLineItem.findMany({
        where: {
          folioId: folio.id,
          articleId: feeArticle.id,
        },
      });

      expect(persistedFee.status).toBe(ReservationStayFeeStatus.POSTED);
      expect(persistedFee.folioLineItemId).toBe(feeLines[0]?.id);
      expect(persistedFee.postedAt).toEqual(FROZEN_NOW);
      expect(feeLines).toHaveLength(1);
      expect(feeLines[0]?.quantity.toString()).toBe("1");
      expect(feeLines[0]?.unitPrice.toString()).toBe("100000");
      expect(feeLines[0]?.amount.toString()).toBe("100000");
    });
  });

  // The updateMany CAS zero-row race is intentionally not covered here: producing
  // that interleaving deterministically requires coordinated concurrent sessions.
});
