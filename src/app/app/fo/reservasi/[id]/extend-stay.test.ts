import { Prisma, ReservationStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  reservationFindUnique: vi.fn(),
  reservationFindFirst: vi.fn(),
  reservationUpdate: vi.fn(),
  roomFindUnique: vi.fn(),
  nightCreateMany: vi.fn(),
  activityCreate: vi.fn(),
  getActiveRoomBlocks: vi.fn(),
  validateRoomTypeCapacity: vi.fn(),
  resolveNightlySchedule: vi.fn(),
  getMealPlanPrices: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
  TRANSACTION_OPTIONS: {},
}));
vi.mock("@/lib/check-in/actions", () => ({
  getCheckInReviewData: vi.fn(),
  getFreshCheckInReview: vi.fn(),
}));
vi.mock("@/lib/reservation-inclusions/actions", () => ({
  changeReservationMealPlan: vi.fn(),
  setReservationStayFee: vi.fn(),
}));
vi.mock("@/lib/room-blocks/queries", () => ({
  getActiveRoomBlocks: mocks.getActiveRoomBlocks,
}));
vi.mock("@/lib/reservation-capacity", () => ({
  validateRoomTypeCapacity: mocks.validateRoomTypeCapacity,
}));
vi.mock("@/lib/pricing-resolver", () => {
  class PricingResolutionError extends Error {}
  return { PricingResolutionError, resolveNightlySchedule: mocks.resolveNightlySchedule };
});
vi.mock("@/lib/arrangement-inclusions", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/arrangement-inclusions")>(),
  getMealPlanPrices: mocks.getMealPlanPrices,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { dateOnlyBoundary } from "@/lib/date-only";
import { PricingResolutionError } from "@/lib/pricing-resolver";
import { createReservationNightMealSnapshot } from "@/lib/reservation-night-schedule";

import { extendReservationStay } from "./actions";

const input = { reservationId: 77, newDepartureDate: "2026-10-05" };
const oldDeparture = new Date("2026-10-03T00:00:00.000Z");
const newDeparture = new Date("2026-10-05T00:00:00.000Z");

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    reservationNo: "RSV-000077",
    status: ReservationStatus.CHECKED_IN,
    roomId: 10,
    roomTypeId: 2,
    room: { id: 10, number: "102" },
    arrivalDate: new Date("2026-10-01T00:00:00.000Z"),
    departureDate: oldDeparture,
    arrangementType: "BB",
    adults: 2,
    children: 1,
    rateAmount: new Prisma.Decimal(400_000),
    deposit: new Prisma.Decimal(200_000),
    depositStatus: "COLLECTED",
    signedAt: new Date("2026-10-01T07:00:00.000Z"),
    grcSnapshot: { version: 1, departureDate: "2026-10-03" },
    grcSnapshotVersion: 1,
    ...overrides,
  };
}

function forbiddenWrites() {
  return {
    create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
  };
}

function transactionClient() {
  return {
    $queryRaw: mocks.queryRaw,
    reservation: {
      ...forbiddenWrites(),
      findUnique: mocks.reservationFindUnique,
      findFirst: mocks.reservationFindFirst,
      update: mocks.reservationUpdate,
    },
    room: { ...forbiddenWrites(), findUnique: mocks.roomFindUnique },
    reservationNight: { ...forbiddenWrites(), createMany: mocks.nightCreateMany },
    folio: forbiddenWrites(),
    folioLineItem: forbiddenWrites(),
    payment: forbiddenWrites(),
    guest: forbiddenWrites(),
    reservationStayFee: forbiddenWrites(),
    activityLog: { create: mocks.activityCreate },
  };
}

let tx: ReturnType<typeof transactionClient>;
let committed: boolean;

function expectNoWrites() {
  for (const model of Object.values(tx)) {
    if (typeof model === "function") continue;
    for (const [method, mock] of Object.entries(model)) {
      if (!method.startsWith("find")) expect(mock, method).not.toHaveBeenCalled();
    }
  }
}

function expectFailure(result: unknown) {
  expect(result).toEqual({ ok: false, error: expect.any(String) });
  expect((result as { error: string }).error.trim()).not.toBe("");
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

function serializationConflict(code = "P2034") {
  return new Prisma.PrismaClientKnownRequestError("Transaction conflict", {
    code, clientVersion: "6.19.0",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  tx = transactionClient();
  committed = false;
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "FO" } });
  mocks.transaction.mockImplementation(async (operation) => {
    const result = await operation(tx);
    committed = true;
    return result;
  });
  mocks.queryRaw.mockResolvedValue([{ id: 77 }]);
  mocks.reservationFindUnique.mockResolvedValue(reservation());
  mocks.reservationFindFirst.mockResolvedValue(null);
  mocks.roomFindUnique.mockResolvedValue({ id: 10, number: "102", roomTypeId: 2, status: "OC" });
  mocks.getActiveRoomBlocks.mockResolvedValue([]);
  mocks.validateRoomTypeCapacity.mockResolvedValue({ ok: true });
  mocks.getMealPlanPrices.mockResolvedValue({ RO: 0, BB: 90_000, HB: 180_000, FB: 280_000 });
  mocks.resolveNightlySchedule.mockResolvedValue([
    {
      date: oldDeparture,
      rate: new Prisma.Decimal(550_000),
      baseRate: new Prisma.Decimal(500_000),
      sourceRule: { id: "weekend-rule", name: "Weekend", selectorKind: "DAY_OF_WEEK" },
    },
    {
      date: new Date("2026-10-04T00:00:00.000Z"),
      rate: new Prisma.Decimal(500_000),
      baseRate: new Prisma.Decimal(500_000),
      sourceRule: null,
    },
  ]);
  mocks.nightCreateMany.mockResolvedValue({ count: 2 });
  mocks.reservationUpdate.mockResolvedValue(reservation({ departureDate: newDeparture }));
  mocks.activityCreate.mockResolvedValue({ id: 1 });
  mocks.revalidatePath.mockImplementation(() => {
    expect(committed, "revalidation must run after the transaction resolves").toBe(true);
  });
});

describe("extendReservationStay authorization and input", () => {
  it.each(["FO", "ADMIN", "GM"])("allows reservations:write for %s", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "7", role } });
    await expect(extendReservationStay(input)).resolves.toEqual({
      ok: true, data: { newDepartureDate: "2026-10-05", additionalNights: 2 },
    });
  });

  it.each([null, "HK", "FB", "ACC", "UNKNOWN"])("rejects unauthorized role %s before a transaction", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { id: "7", role } } : null);
    expectFailure(await extendReservationStay(input));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it.each([undefined, null, {}, "77", [],
    { ...input, reservationId: 0 }, { ...input, reservationId: -1 },
    { ...input, reservationId: 1.5 }, { ...input, reservationId: "abc" },
    { ...input, reservationId: "" }, { ...input, reservationId: Infinity },
    { ...input, reservationId: null }, { newDepartureDate: input.newDepartureDate },
  ])("rejects malformed input %j before a transaction", async (value) => {
    expectFailure(await extendReservationStay(value));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it.each([undefined, null, "", "2026-1-05", "2026-10-5", "05-10-2026",
    "2026-10-05T00:00:00Z", " 2026-10-05", "2026-10-05 ", "2026-02-29",
    "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-01", "2026-10-00",
    new Date("2026-10-05"),
  ])("requires a strict, real YYYY-MM-DD date: %j", async (date) => {
    expectFailure(await extendReservationStay({ ...input, newDepartureDate: date }));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("coerces a positive integer reservation ID", async () => {
    await expect(extendReservationStay({ ...input, reservationId: "77" })).resolves.toMatchObject({ ok: true });
    expect(mocks.reservationFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 77 } }));
  });

  it("accepts a real leap day", async () => {
    mocks.reservationFindUnique.mockResolvedValue(reservation({ departureDate: new Date("2028-02-28") }));
    mocks.resolveNightlySchedule.mockResolvedValue([
      { date: new Date("2028-02-28"), rate: new Prisma.Decimal(500_000), sourceRule: null },
    ]);
    mocks.nightCreateMany.mockResolvedValue({ count: 1 });
    await expect(extendReservationStay({ ...input, newDepartureDate: "2028-02-29" })).resolves.toEqual({
      ok: true, data: { newDepartureDate: "2028-02-29", additionalNights: 1 },
    });
  });
});

describe("extendReservationStay transaction guards", () => {
  it("locks the reservation then room and reads authoritative reservation fields in a Serializable transaction", async () => {
    await expect(extendReservationStay(input)).resolves.toMatchObject({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }));
    expect(mocks.reservationFindUnique).toHaveBeenCalledWith({
      where: { id: 77 },
      select: expect.objectContaining({
        id: true, status: true, roomId: true, roomTypeId: true, departureDate: true,
        arrangementType: true, adults: true, children: true,
      }),
    });
    const [reservationLock, roomLock] = mocks.queryRaw.mock.calls;
    expect(reservationLock[0].join("?")).toMatch(/SELECT\s+id\s+FROM\s+"reservation"[\s\S]*FOR UPDATE/);
    expect(reservationLock.slice(1)).toEqual([77]);
    expect(roomLock[0].join("?")).toMatch(/SELECT\s+id\s+FROM\s+"room"[\s\S]*FOR UPDATE/);
    expect(roomLock.slice(1)).toEqual([10]);
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.reservationFindUnique.mock.invocationCallOrder[0]);
    expect(mocks.reservationFindUnique.mock.invocationCallOrder[0]).toBeLessThan(mocks.queryRaw.mock.invocationCallOrder[1]);
    expect(mocks.queryRaw.mock.invocationCallOrder[1]).toBeLessThan(mocks.getActiveRoomBlocks.mock.invocationCallOrder[0]);
  });

  it("rejects a missing reservation", async () => {
    mocks.reservationFindUnique.mockResolvedValue(null);
    expectFailure(await extendReservationStay(input));
    expectNoWrites();
  });

  it.each(Object.values(ReservationStatus).filter((status) => status !== "CHECKED_IN"))(
    "rejects reservation status %s", async (status) => {
      mocks.reservationFindUnique.mockResolvedValue(reservation({ status }));
      expectFailure(await extendReservationStay(input));
      expectNoWrites();
    },
  );

  it("rejects a checked-in reservation without an assigned room", async () => {
    mocks.reservationFindUnique.mockResolvedValue(reservation({ roomId: null }));
    expectFailure(await extendReservationStay(input));
    expectNoWrites();
  });

  it.each(["2026-10-03", "2026-10-02"])("rejects a departure that does not extend the stay: %s", async (date) => {
    expectFailure(await extendReservationStay({ ...input, newDepartureDate: date }));
    expectNoWrites();
    expect(mocks.resolveNightlySchedule).not.toHaveBeenCalled();
  });

  it("rejects an active room block in the added range", async () => {
    mocks.getActiveRoomBlocks.mockResolvedValue([{
      id: 3, roomId: 10, startDate: "2026-10-04", endDate: "2026-10-06",
      status: "ACTIVE", reason: "MAINTENANCE",
    }]);
    expectFailure(await extendReservationStay(input));
    expect(mocks.getActiveRoomBlocks).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 10, range: { startDate: "2026-10-03", endDate: "2026-10-05" },
    }), tx);
    expectNoWrites();
  });

  it("rejects a conflicting assigned-room reservation", async () => {
    mocks.reservationFindFirst.mockResolvedValue({ id: 88, reservationNo: "RSV-000088" });
    expectFailure(await extendReservationStay(input));
    expectNoWrites();
  });

  it("checks half-open overlap and room-type inventory only for the added nights, excluding itself", async () => {
    await expect(extendReservationStay(input)).resolves.toMatchObject({ ok: true });
    expect(mocks.getActiveRoomBlocks).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 10, range: { startDate: "2026-10-03", endDate: "2026-10-05" },
    }), tx);
    expect(mocks.reservationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { not: 77 }, roomId: 10,
        status: { in: expect.arrayContaining(["CONFIRMED", "CHECKED_IN"]) },
        arrivalDate: { lt: newDeparture }, departureDate: { gt: oldDeparture },
      }),
    }));
    expect(mocks.validateRoomTypeCapacity).toHaveBeenCalledWith(expect.objectContaining({
      roomTypeId: 2, arrival: expect.any(Date), departure: expect.any(Date), excludeReservationId: 77,
    }), tx);
    const capacityInput = mocks.validateRoomTypeCapacity.mock.calls[0][0];
    expect(capacityInput.requestedCount ?? 1).toBe(1);
    // Match the capacity helper's local-calendar input contract in every server timezone.
    expect(dateOnlyBoundary(capacityInput.arrival)).toEqual(oldDeparture);
    expect(dateOnlyBoundary(capacityInput.departure)).toEqual(newDeparture);
  });

  it("preserves the room-type capacity error without writing", async () => {
    const error = "Tipe kamar Deluxe sudah penuh pada tanggal 2026-10-04.";
    mocks.validateRoomTypeCapacity.mockResolvedValue({ ok: false, error, field: "roomTypeId" });
    const result = await extendReservationStay(input);
    expect(result).toEqual({ ok: false, error });
    expectFailure(result);
    expectNoWrites();
    expect(mocks.resolveNightlySchedule).not.toHaveBeenCalled();
  });
});

describe("extendReservationStay append-only success", () => {
  it.each(["RO", "BB", "HB", "FB"] as const)("appends current %s meal and pricing snapshots without touching history or signed GRCs", async (plan) => {
    mocks.reservationFindUnique.mockResolvedValue(reservation({ arrangementType: plan }));
    await expect(extendReservationStay(input)).resolves.toEqual({
      ok: true, data: { newDepartureDate: "2026-10-05", additionalNights: 2 },
    });
    expect(mocks.resolveNightlySchedule).toHaveBeenCalledWith({
      roomTypeId: 2, arrivalDate: "2026-10-03", departureDate: "2026-10-05",
    }, tx);
    expect(mocks.getMealPlanPrices).toHaveBeenCalledWith(tx);
    const prices = { RO: 0, BB: 90_000, HB: 180_000, FB: 280_000 };
    // Use the real snapshot implementation, including RO's null fields.
    const mealSnapshot = createReservationNightMealSnapshot(plan, 3, new Prisma.Decimal(prices[plan]));
    expect(mocks.nightCreateMany).toHaveBeenCalledExactlyOnceWith({ data: [
      {
        reservationId: 77, date: oldDeparture, rateAmount: new Prisma.Decimal(550_000),
        revenueClass: "PAID", sourcePricingRuleId: "weekend-rule", ...mealSnapshot,
      },
      {
        reservationId: 77, date: new Date("2026-10-04T00:00:00.000Z"), rateAmount: new Prisma.Decimal(500_000),
        revenueClass: "PAID", sourcePricingRuleId: null, ...mealSnapshot,
      },
    ] });
    // Exact data guards arrival, legacy rate, deposit, signature and GRC snapshot fields too.
    expect(mocks.reservationUpdate).toHaveBeenCalledExactlyOnceWith({
      where: { id: 77 }, data: { departureDate: newDeparture },
    });
    for (const [modelName, model] of Object.entries(tx)) {
      if (typeof model === "function") continue;
      for (const [method, mock] of Object.entries(model)) {
        if (method.startsWith("find") ||
          (modelName === "reservationNight" && method === "createMany") ||
          (modelName === "reservation" && method === "update") ||
          (modelName === "activityLog" && method === "create")) continue;
        expect(mock, `${modelName}.${method} must not alter historical data`).not.toHaveBeenCalled();
      }
    }
    expect(mocks.activityCreate).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({
      userId: 7, reservationId: 77, action: "RESERVATION_UPDATED",
      metadata: expect.objectContaining({ event: "RESERVATION_EXTENDED" }),
    }) });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
    const paths = mocks.revalidatePath.mock.calls.map(([path]) => path);
    expect(new Set(paths).size).toBe(4);
    expect(paths.toSorted()).toEqual([
      "/app/fo",
      "/app/fo/reservasi/77",
      "/app/fo/reservasi/list",
      "/app/fo/reservasi/kalender",
    ].toSorted());
  });
});

describe("extendReservationStay failures and serialization retries", () => {
  it.each([
    new PricingResolutionError("Tarif tambahan tidak tersedia."),
    new Error("pricing database failure"),
  ])("contains pricing failure %s without writes or revalidation", async (error) => {
    mocks.resolveNightlySchedule.mockRejectedValue(error);
    expectFailure(await extendReservationStay(input));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expectNoWrites();
  });

  it("does not revalidate when the transactional audit write fails", async () => {
    mocks.activityCreate.mockRejectedValue(new Error("audit insert failed"));
    expectFailure(await extendReservationStay(input));
    expect(committed).toBe(false);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it.each(["P2034", "P2028"])("retries %s and succeeds on the third attempt", async (code) => {
    mocks.transaction.mockRejectedValueOnce(serializationConflict(code)).mockRejectedValueOnce(serializationConflict(code));
    await expect(extendReservationStay(input)).resolves.toEqual({
      ok: true, data: { newDepartureDate: "2026-10-05", additionalNights: 2 },
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
    expect(mocks.nightCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.activityCreate).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it.each(["P2034", "P2028"])("stops after three %s failures without revalidation", async (code) => {
    mocks.transaction.mockRejectedValue(serializationConflict(code));
    expectFailure(await extendReservationStay(input));
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
    expectNoWrites();
  });

  it("re-reads current departure after retry instead of appending from stale state", async () => {
    mocks.reservationFindUnique
      .mockResolvedValueOnce(reservation())
      .mockResolvedValueOnce(reservation({ departureDate: newDeparture }));
    mocks.validateRoomTypeCapacity.mockRejectedValueOnce(serializationConflict());
    expectFailure(await extendReservationStay(input));
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.reservationFindUnique).toHaveBeenCalledTimes(2);
    expectNoWrites();
  });

  it("does not retry unrelated database failures", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Database unavailable", {
      code: "P1001", clientVersion: "6.19.0",
    }));
    expectFailure(await extendReservationStay(input));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expectNoWrites();
  });
});
