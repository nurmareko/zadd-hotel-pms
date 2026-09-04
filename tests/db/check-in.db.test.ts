import { createHash } from "node:crypto";

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
import { GrcSnapshotSchema } from "@/lib/grc-snapshot";
import { prisma } from "@/lib/prisma";

import {
  createArticle,
  createFolio,
  createFolioPayment,
  createGuest,
  createHotelSettings,
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
        code: "DEPOSIT_STATE_INCONSISTENT",
        error:
          "Status deposit dan pembayaran folio tidak sesuai. Hentikan proses dan minta pemeriksaan data.",
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
        code: "DEPOSIT_STATE_INCONSISTENT",
        error:
          "Status deposit dan pembayaran folio tidak sesuai. Hentikan proses dan minta pemeriksaan data.",
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
        code: "ARRIVAL_NOT_DUE",
        error: "Check-in baru dapat dilakukan pada tanggal kedatangan.",
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
        code: "DEPOSIT_REQUIRED",
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
        code: "DEPOSIT_FOLIO_MISSING",
        error:
          "Folio deposit tidak ditemukan. Hentikan check-in dan periksa data reservasi.",
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

    it("blocks COLLECTED status with a folio but no DEPOSIT payment without mutating check-in state", async () => {
      const { guest, reservation, room } = await createBasicReservation({
        depositStatus: DepositStatus.COLLECTED,
      });
      await createFolio(reservation.id);

      const result = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );

      expect(result).toEqual({
        ok: false,
        code: "DEPOSIT_STATE_INCONSISTENT",
        error:
          "Status deposit dan pembayaran folio tidak sesuai. Hentikan proses dan minta pemeriksaan data.",
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
      expect(persistedReservation.purposeOfVisit).toBeNull();
      expect(persistedReservation.signatureDataUrl).toBeNull();
      expect(persistedReservation.signedAt).toBeNull();
      expect(persistedReservation.grcSnapshot).toBeNull();
      expect(persistedReservation.grcSnapshotVersion).toBeNull();
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
        code: "ROOM_OOO",
        error: "Kamar yang dipilih berstatus OOO. Pilih kamar lain.",
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
      const { user, guest, reservation, room, roomType } =
        await createBasicReservation({
          depositStatus: DepositStatus.COLLECTED,
        });
      const { folio } = await createConsistentCollectedDeposit(
        reservation.id,
        user.id,
      );
      await createHotelSettings({ address: "Jl. Snapshot No. 1" });
      const checkInOperator = await createUser();

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

      const snapshot = GrcSnapshotSchema.parse(persistedReservation.grcSnapshot);
      expect(persistedReservation.grcSnapshotVersion).toBe(1);
      expect(snapshot).toEqual({
        schemaVersion: 1,
        templateVersion: 1,
        capturedAt: FROZEN_NOW.toISOString(),
        header: {
          brandName: "ZADD Hotel Management",
          hotelAddress: "Jl. Snapshot No. 1",
        },
        reservation: {
          reservationNo: reservation.reservationNo,
          folioNo: folio.folioNo,
          arrival: "2026-08-05T00:00:00.000Z",
          departure: "2026-08-07T00:00:00.000Z",
          nights: 2,
          arrangementType: "RO",
          arrangementTypeLabel: "RO — Tanpa makan",
          reservationType: "INDIVIDUAL",
          reservationTypeLabel: "Individual",
        },
        guest: {
          fullName: "Tamu Setelah Check-in",
          idType: "KTP",
          idNumber: "3273010101010001",
          phone: "081234567890",
          email: "tamu@example.com",
          nationality: "Indonesia",
        },
        stay: {
          roomNumber: room.number,
          roomTypeName: roomType.name,
          adults: 2,
          children: 0,
          stayTotal: "735000",
          usesNightlyRates: true,
          nightlySchedule: [
            { date: "2026-08-05T00:00:00.000Z", rateAmount: "325000" },
            { date: "2026-08-06T00:00:00.000Z", rateAmount: "410000" },
          ],
        },
        grcMetadata: {
          purposeOfVisit: "Bisnis",
          grcFilledAt: FROZEN_NOW.toISOString(),
          filledByName: checkInOperator.fullName,
          signedAt: FROZEN_NOW.toISOString(),
        },
        signatureSha256: createHash("sha256")
          .update("data:image/png;base64,aGVsbG8=", "utf8")
          .digest("hex"),
      });
      expect(snapshot.grcMetadata.filledByName).not.toBe(user.fullName);

      const retryResult = await completeCheckIn(
        checkInFormData(reservation.id, room.id, {
          guestFullName: "Nama dari Retry",
          signatureDataUrl: "data:image/png;base64,d29ybGQ=",
        }),
        { redirectAfterCheckIn: false },
      );
      expect(retryResult).toEqual({
        ok: false,
        code: "RESERVATION_NOT_ELIGIBLE",
        error:
          "Reservasi tidak lagi memenuhi syarat check-in. Muat ulang halaman dan periksa statusnya.",
      });

      await prisma.guest.update({
        where: { id: guest.id },
        data: { fullName: "Nama Operasional Terbaru" },
      });
      const afterGuestEdit = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { grcSnapshot: true, guest: { select: { fullName: true } } },
      });
      expect(afterGuestEdit.guest.fullName).toBe("Nama Operasional Terbaru");
      expect(GrcSnapshotSchema.parse(afterGuestEdit.grcSnapshot)).toEqual(snapshot);

      const groupGuest = await createGuest();
      const groupRoomType = await createRoomType();
      const firstGroupRoom = await createRoom(groupRoomType.id);
      const firstSibling = await createReservationFixture({
        userId: user.id,
        roomTypeId: groupRoomType.id,
        guestId: groupGuest.id,
        nightlyRates: [200_000],
        depositStatus: DepositStatus.COLLECTED,
        adults: 1,
        children: 0,
        groupBookingId: "GROUP-SNAPSHOT",
      });
      const secondGroupRoom = await createRoom(groupRoomType.id);
      const secondSibling = await createReservationFixture({
        userId: user.id,
        roomTypeId: groupRoomType.id,
        guestId: groupGuest.id,
        nightlyRates: [250_000],
        depositStatus: DepositStatus.COLLECTED,
        adults: 2,
        children: 1,
        groupBookingId: "GROUP-SNAPSHOT",
      });
      await createConsistentCollectedDeposit(
        firstSibling.reservation.id,
        user.id,
        200_000,
      );
      await createConsistentCollectedDeposit(
        secondSibling.reservation.id,
        user.id,
        250_000,
      );

      expect(
        await completeCheckIn(
          checkInFormData(firstSibling.reservation.id, firstGroupRoom.id, {
            guestFullName: "Nama Sibling Pertama",
          }),
          { redirectAfterCheckIn: false },
        ),
      ).toEqual({ ok: true });
      const firstSnapshotBeforeSiblingCheckIn = await prisma.reservation.findUniqueOrThrow({
        where: { id: firstSibling.reservation.id },
        select: { grcSnapshot: true },
      });

      expect(
        await completeCheckIn(
          checkInFormData(secondSibling.reservation.id, secondGroupRoom.id, {
            guestFullName: "Nama Sibling Kedua",
          }),
          { redirectAfterCheckIn: false },
        ),
      ).toEqual({ ok: true });

      const [firstAfterSiblingCheckIn, secondAfterCheckIn] = await Promise.all([
        prisma.reservation.findUniqueOrThrow({
          where: { id: firstSibling.reservation.id },
          select: { grcSnapshot: true },
        }),
        prisma.reservation.findUniqueOrThrow({
          where: { id: secondSibling.reservation.id },
          select: { grcSnapshot: true },
        }),
      ]);
      const firstGroupSnapshot = GrcSnapshotSchema.parse(
        firstAfterSiblingCheckIn.grcSnapshot,
      );
      const secondGroupSnapshot = GrcSnapshotSchema.parse(
        secondAfterCheckIn.grcSnapshot,
      );

      expect(firstAfterSiblingCheckIn.grcSnapshot).toEqual(
        firstSnapshotBeforeSiblingCheckIn.grcSnapshot,
      );
      expect(firstGroupSnapshot.guest.fullName).toBe("Nama Sibling Pertama");
      expect(firstGroupSnapshot.stay).toMatchObject({
        roomNumber: firstGroupRoom.number,
        adults: 1,
        children: 0,
        stayTotal: "200000",
      });
      expect(secondGroupSnapshot.guest.fullName).toBe("Nama Sibling Kedua");
      expect(secondGroupSnapshot.stay).toMatchObject({
        roomNumber: secondGroupRoom.number,
        adults: 2,
        children: 1,
        stayTotal: "250000",
      });
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
        code: "RESERVATION_NOT_ELIGIBLE",
        error:
          "Reservasi tidak lagi memenuhi syarat check-in. Muat ulang halaman dan periksa statusnya.",
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

    it("returns STAY_FEE_UNAVAILABLE and rolls back when a pending stay fee cannot be posted", async () => {
      const { user, reservation, room } = await createBasicReservation({
        depositStatus: DepositStatus.COLLECTED,
      });
      await createConsistentCollectedDeposit(
        reservation.id,
        user.id,
      );
      // Create pending stay fee without creating the corresponding Article
      const fee = await prisma.reservationStayFee.create({
        data: {
          reservationId: reservation.id,
          kind: ReservationStayFeeKind.EARLY_CHECK_IN,
          unitPrice: 100_000,
          status: ReservationStayFeeStatus.PENDING,
          selectedById: user.id,
        },
      });

      const result = await completeCheckIn(
        checkInFormData(reservation.id, room.id),
        { redirectAfterCheckIn: false },
      );

      expect(result).toEqual({
        ok: false,
        code: "STAY_FEE_UNAVAILABLE",
        error:
          "Biaya fleksibilitas belum dapat dicatat. Periksa konfigurasi biaya lalu coba lagi.",
      });

      // Verify transaction rollback
      const persistedReservation = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
      });
      expect(persistedReservation.status).toBe(ReservationStatus.CONFIRMED);

      const persistedRoom = await prisma.room.findUniqueOrThrow({
        where: { id: room.id },
      });
      expect(persistedRoom.status).toBe(RoomStatus.VC);

      const persistedFee = await prisma.reservationStayFee.findUniqueOrThrow({
        where: { id: fee.id },
      });
      expect(persistedFee.status).toBe(ReservationStayFeeStatus.PENDING);
    });
  });

  // The updateMany CAS zero-row race is intentionally not covered here: producing
  // that interleaving deterministically requires coordinated concurrent sessions.
});
