import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";
import { permanentRedirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  articleFindMany: vi.fn(),
  cookieSet: vi.fn(),
  cookies: vi.fn(),
  logActivity: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  resolveNightlySchedule: vi.fn(),
  roomTypeFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findMany: mocks.articleFindMany },
    roomType: { findMany: mocks.roomTypeFindMany },
    $transaction: mocks.transaction,
  },
  TRANSACTION_OPTIONS: {},
}));
vi.mock("@/lib/pricing-resolver", () => {
  class PricingResolutionError extends Error {}

  return {
    PricingResolutionError,
    resolveNightlySchedule: mocks.resolveNightlySchedule,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();

  return { ...actual, redirect: mocks.redirect };
});

import { PricingResolutionError } from "@/lib/pricing-resolver";
import { ReservationStayFeeError } from "@/lib/reservation-stay-fees";
import { STAY_FEE_DEFINITIONS } from "@/lib/reservation-stay-fee-definitions";
import {
  cancelReservation,
  createReservation,
  getReservationQuote,
  updateReservation,
} from "./actions";

const validCreateInput = {
  fullName: "Tamu Uji",
  idType: "KTP",
  idNumber: "",
  phone: "",
  email: "",
  address: "",
  nationality: "Indonesia",
  arrivalDate: "2026-10-01",
  departureDate: "2026-10-02",
  reservationType: "INDIVIDUAL",
  arrangementType: "RO",
  notes: "",
  stayFeeKinds: [],
  rooms: [{ roomTypeId: 1, roomId: 10, adults: 1, children: 0 }],
};

const validEditInput = {
  fullName: "Tamu Uji",
  idType: "KTP",
  idNumber: "",
  phone: "",
  email: "",
  address: "",
  nationality: "Indonesia",
  roomTypeId: 1,
  roomId: 10,
  arrivalDate: "2026-10-01",
  departureDate: "2026-10-02",
  adults: 1,
  children: 0,
  reservationType: "INDIVIDUAL",
  arrangementType: "RO",
  notes: "",
};

function transactionClient(options: {
  roomType?: { id: number; baseRate: number; capacity: number } | null;
  room?: {
    id: number;
    number: string;
    roomTypeId: number;
    status: RoomStatus;
  } | null;
  overlap?: { id: number } | null;
  blocked?: boolean;
  reservation?: {
    id: number;
    status: ReservationStatus;
    folio: { id: number } | null;
  } | null;
  updatedCount?: number;
} = {}) {
  return {
    article: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn().mockResolvedValue(1),
    roomBlock: { findMany: vi.fn(async () => options.blocked ? [{ id: 1, roomId: 10, startDate: new Date("2026-10-01"), endDate: new Date("2026-10-02"), status: "ACTIVE", reason: "MAINTENANCE" }] : []) },
    roomType: {
      findUnique: vi.fn(async () => options.roomType ?? null),
    },
    room: {
      findUnique: vi.fn(async () => options.room ?? null),
    },
    reservation: {
      findFirst: vi.fn(async () => options.overlap ?? null),
      findUnique: vi.fn(async () => options.reservation ?? null),
      updateMany: vi.fn(async () => ({ count: options.updatedCount ?? 1 })),
    },
    reservationStayFee: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
}

function genuineRedirectError() {
  try {
    permanentRedirect("/app/fo/reservasi");
  } catch (error) {
    return error;
  }

  throw new Error("Next.js permanentRedirect did not throw");
}

function runTransactionWith(tx: ReturnType<typeof transactionClient>) {
  mocks.transaction.mockImplementationOnce(
    async (callback: (client: typeof tx) => unknown) => callback(tx),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "FO" } });
  mocks.articleFindMany.mockResolvedValue([]);
  mocks.cookies.mockResolvedValue({ set: mocks.cookieSet });
  mocks.logActivity.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation(() => undefined);
  mocks.revalidatePath.mockImplementation(() => undefined);
  mocks.roomTypeFindMany.mockResolvedValue([{ id: 1, capacity: 2 }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("per-room custom rates", () => {
  function standardSchedule(rates = [500_000, 600_000]) {
    return rates.map((rate, index) => ({
      date: new Date(`2026-10-0${index + 1}T00:00:00Z`),
      rate: new Prisma.Decimal(rate),
      baseRate: new Prisma.Decimal(400_000),
      sourceRule: { id: `rule-${index}`, name: "Tarif", selectorKind: "DATE_RANGE" },
    }));
  }

  function creationTransaction() {
    const base = transactionClient();
    const tx = {
      ...base,
      article: { findMany: vi.fn().mockResolvedValue([]) },
      roomType: { findUnique: vi.fn().mockResolvedValue({ id: 1, name: "Standar", capacity: 2, baseRate: 400_000, _count: { rooms: 20 } }) },
      guest: { create: vi.fn().mockResolvedValue({ id: 88 }) },
      reservation: {
        ...base.reservation,
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValueOnce({ id: 77 }).mockResolvedValueOnce({ id: 78 }).mockResolvedValueOnce({ id: 79 }),
      },
      reservationNight: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    runTransactionWith(tx);
    return tx;
  }

  it.each([undefined, "", "   ", "0", "450000", "500000", "100000000"])("quotes and persists custom rate %j consistently across variable nights", async (customRate) => {
    const schedule = standardSchedule();
    mocks.resolveNightlySchedule.mockResolvedValue(schedule);
    const input = {
      ...validCreateInput,
      departureDate: "2026-10-03",
      rooms: [{ ...validCreateInput.rooms[0], roomId: null, customRate, customRateReason: "  Negosiasi  " }],
    };
    const effective = customRate?.trim() ? [Number(customRate), Number(customRate)] : [500_000, 600_000];
    const quote = await getReservationQuote(input);
    expect(quote).toMatchObject({ ok: true, roomTotal: String(effective[0] + effective[1]), deposits: [String(effective[0])], standardFirstNightRates: [500_000] });
    const tx = creationTransaction();
    expect(await createReservation(input)).toMatchObject({ ok: true });
    expect(mocks.resolveNightlySchedule).toHaveBeenLastCalledWith({ roomTypeId: 1, arrivalDate: "2026-10-01", departureDate: "2026-10-03" }, tx);
    expect(tx.reservation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rateAmount: new Prisma.Decimal(effective[0]), deposit: new Prisma.Decimal(effective[0]) }) }));
    const nights = tx.reservationNight.createMany.mock.calls[0][0].data;
    expect(nights.map((night: Prisma.ReservationNightCreateManyInput) => Number(night.rateAmount))).toEqual(effective);
    expect(nights.map((night: Prisma.ReservationNightCreateManyInput) => night.revenueClass)).toEqual(["PAID", "PAID"]);
    expect(nights.map((night: Prisma.ReservationNightCreateManyInput) => night.sourcePricingRuleId)).toEqual(effective.map((rate, index) => rate === Number(schedule[index].rate) ? `rule-${index}` : null));
    const audit = mocks.logActivity.mock.calls[0][0];
    expect(audit).toMatchObject({ action: "RESERVATION_CREATED", reservationId: 77 });
    if (customRate?.trim()) {
      expect(audit.metadata).toEqual({
        rateOverride: true,
        standardRate: 500_000, customRate: Number(customRate), variance: Number(customRate) - 500_000, reason: "Negosiasi",
        nights: [500_000, 600_000].map((standardRate, index) => ({ date: `2026-10-0${index + 1}`, standardRate, customRate: Number(customRate), variance: Number(customRate) - standardRate })),
      });
    } else {
      expect(audit).not.toHaveProperty("metadata");
    }
    expect(schedule.map((night) => night.rate.toNumber())).toEqual([500_000, 600_000]);
  });

  it("keeps mixed rooms independent and omits empty reasons from audit metadata", async () => {
    mocks.resolveNightlySchedule.mockResolvedValue(standardSchedule());
    const input = { ...validCreateInput, departureDate: "2026-10-03", rooms: ["0", undefined, "700000"].map((customRate) => ({ ...validCreateInput.rooms[0], roomId: null, customRate, customRateReason: "   " })) };
    expect(await getReservationQuote(input)).toMatchObject({ ok: true, roomTotal: "2500000", deposits: ["0", "500000", "700000"], standardFirstNightRates: [500_000, 500_000, 500_000] });
    const tx = creationTransaction();
    expect(await createReservation(input)).toMatchObject({ ok: true });
    expect(tx.reservationNight.createMany.mock.calls.map(([args]) => args.data.map((night: Prisma.ReservationNightCreateManyInput) => Number(night.rateAmount)))).toEqual([[0, 0], [500_000, 600_000], [700_000, 700_000]]);
    expect(mocks.logActivity.mock.calls.map(([args]) => args.metadata?.customRate)).toEqual([0, undefined, 700_000]);
    for (const [audit] of mocks.logActivity.mock.calls) expect(audit.metadata ?? {}).not.toHaveProperty("reason");
    expect(mocks.resolveNightlySchedule).toHaveBeenCalledTimes(2);
  });

  it("does not log an override when every standard night matches", async () => {
    mocks.resolveNightlySchedule.mockResolvedValue(standardSchedule([500_000, 500_000]));
    creationTransaction();
    expect(await createReservation({ ...validCreateInput, departureDate: "2026-10-03", rooms: [{ ...validCreateInput.rooms[0], roomId: null, customRate: "500000" }] })).toMatchObject({ ok: true });
    expect(mocks.logActivity.mock.calls[0][0]).not.toHaveProperty("metadata");
  });

  it.each(["-1", "1.5", "100000001", "invalid", null, true])("rejects invalid custom rate %j before quote or persistence", async (customRate) => {
    const input = { ...validCreateInput, rooms: [{ ...validCreateInput.rooms[0], customRate }] };
    expect(await getReservationQuote(input)).toMatchObject({ ok: false, code: "INVALID_RESERVATION_DATA" });
    expect(await createReservation(input)).toMatchObject({ ok: false, code: "INVALID_RESERVATION_DATA", field: "rooms" });
    expect(mocks.resolveNightlySchedule).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps inclusions additive with a zero room rate", async () => {
    mocks.resolveNightlySchedule.mockResolvedValue(standardSchedule());
    mocks.articleFindMany.mockResolvedValue([{ code: "MEAL-BB", defaultPrice: new Prisma.Decimal(75_000) }]);
    const input = { ...validCreateInput, arrangementType: "BB", departureDate: "2026-10-03", rooms: [{ ...validCreateInput.rooms[0], roomId: null, adults: 2, customRate: "0" }] };
    expect(await getReservationQuote(input)).toMatchObject({ ok: true, roomTotal: "0", inclusionTotal: "300000", reservationTotal: "300000", deposits: ["0"] });
    const tx = creationTransaction();
    tx.article.findMany.mockResolvedValue([{ code: "MEAL-BB", defaultPrice: new Prisma.Decimal(75_000) }]);
    expect(await createReservation(input)).toMatchObject({ ok: true });
    expect(tx.reservationNight.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ rateAmount: new Prisma.Decimal(0), mealAmount: new Prisma.Decimal(150_000), mealPax: 2 })]) });
  });

  it("rejects oversized reasons with Indonesian action validation", async () => {
    expect(await createReservation({ ...validCreateInput, rooms: [{ ...validCreateInput.rooms[0], customRateReason: "a".repeat(256) }] })).toMatchObject({ ok: false, field: "rooms", error: "Alasan tarif khusus maksimal 255 karakter" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("fails creation rather than bypassing missing standard pricing for zero", async () => {
    mocks.resolveNightlySchedule.mockRejectedValueOnce(new PricingResolutionError("Missing pricing"));
    const tx = creationTransaction();
    expect(await createReservation({ ...validCreateInput, rooms: [{ ...validCreateInput.rooms[0], roomId: null, customRate: "0" }] })).toMatchObject({ ok: false, code: "PRICING_QUOTE_FAILED" });
    expect(tx.reservation.create).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("does not bypass standard pricing resolution for a zero override", async () => {
    mocks.resolveNightlySchedule.mockRejectedValueOnce(new PricingResolutionError("Missing pricing"));
    expect(await getReservationQuote({ ...validCreateInput, rooms: [{ ...validCreateInput.rooms[0], customRate: "0" }] })).toMatchObject({ ok: false, code: "PRICING_QUOTE_FAILED" });
  });
});

describe("reservation stay fee creation", () => {
  it.each([
    { roomCount: 1, fees: "omitted" },
    { roomCount: 1, fees: "empty" },
    { roomCount: 2, fees: "omitted" },
    { roomCount: 2, fees: "empty" },
    { roomCount: 1, fees: "selected" },
    { roomCount: 2, fees: "selected" },
  ])("creates $roomCount rooms with $fees fees", async ({ roomCount, fees }) => {
    const base = transactionClient();
    const kind = "EARLY_CHECK_IN" as const;
    const definition = STAY_FEE_DEFINITIONS[kind];
    const tx = {
      ...base,
      article: {
        ...base.article,
        findUnique: vi.fn().mockResolvedValue({
          id: 9, code: definition.articleCode, type: "MISC",
          defaultPrice: new Prisma.Decimal(definition.unitPrice),
        }),
      },
      roomType: { findUnique: vi.fn().mockResolvedValue({ id: 1, name: "Standar", capacity: 2, baseRate: 500_000, _count: { rooms: 5 } }) },
      guest: { create: vi.fn().mockResolvedValue({ id: 88 }) },
      reservation: {
        ...base.reservation,
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValueOnce({ id: 77 }).mockResolvedValueOnce({ id: 78 }),
      },
      reservationNight: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      reservationStayFee: { ...base.reservationStayFee, create: vi.fn() },
    };
    mocks.resolveNightlySchedule.mockResolvedValueOnce([
      { date: new Date("2026-10-01T00:00:00Z"), rate: new Prisma.Decimal(500_000), sourceRule: null },
    ]);
    runTransactionWith(tx);
    const redirectError = genuineRedirectError();
    mocks.redirect.mockImplementationOnce(() => { throw redirectError; });
    const input = {
      ...validCreateInput,
      rooms: Array.from({ length: roomCount }, () => ({ ...validCreateInput.rooms[0], roomId: null })),
      ...(fees === "selected" ? { stayFeeKinds: [kind] } : {}),
    };
    if (fees === "omitted") Reflect.deleteProperty(input, "stayFeeKinds");

    const result = await createReservation(input);
    expect(result).toEqual({
      ok: true,
      data: {
        reservationIds: Array.from({ length: roomCount }, (_, index) => 77 + index),
        reservationNumbers: tx.reservation.create.mock.calls.map(([args]) => args.data.reservationNo),
        guestName: input.fullName,
        groupBookingId: roomCount > 1 ? expect.any(String) : null,
        redirectUrl: "/app/fo/reservasi/list?from=2026-10-01&to=2026-10-01",
      },
    });
    expect(mocks.redirect).not.toHaveBeenCalled();

    expect(tx.reservation.create).toHaveBeenCalledTimes(roomCount);
    expect(tx.reservationNight.createMany).toHaveBeenCalledTimes(roomCount);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    if (fees === "selected") {
      expect(tx.reservationStayFee.create).toHaveBeenCalledTimes(roomCount);
      for (let index = 0; index < roomCount; index += 1) {
        expect(tx.reservationStayFee.create).toHaveBeenNthCalledWith(index + 1, {
          data: { reservationId: 77 + index, kind, unitPrice: new Prisma.Decimal(definition.unitPrice), status: "PENDING", selectedById: 1 },
        });
      }
    } else {
      expect(tx.article.findUnique).not.toHaveBeenCalled();
      expect(tx.reservationStayFee.create).not.toHaveBeenCalled();
    }
  });
});

describe("numeric codes and room occupants", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ...[undefined, "", "   ", " Tamu Uji ", " Sari Putri "].map((occupantName) => ({ occupantName, existingCount: 9 })),
    { occupantName: undefined, existingCount: 99_997 },
    { occupantName: undefined, existingCount: 99_999 },
  ])("assigns occupant $occupantName with $existingCount existing codes", async ({ occupantName, existingCount }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T18:00:00Z"));
    const base = transactionClient();
    const tx = {
      ...base,
      roomType: { findUnique: vi.fn().mockResolvedValue({ id: 1, name: "Standar", capacity: 2, baseRate: 500_000, _count: { rooms: 5 } }) },
      guest: { create: vi.fn().mockResolvedValueOnce({ id: 88 }).mockResolvedValueOnce({ id: 89 }) },
      reservation: {
        ...base.reservation,
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(existingCount),
        create: vi.fn().mockResolvedValueOnce({ id: 77 }).mockResolvedValueOnce({ id: 78 }),
      },
      reservationNight: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    mocks.resolveNightlySchedule.mockResolvedValueOnce([
      { date: new Date("2026-10-01T00:00:00Z"), rate: new Prisma.Decimal(500_000), sourceRule: null },
    ]);
    runTransactionWith(tx);
    const result = await createReservation({
      ...validCreateInput,
      phone: "08123456789",
      email: "booker@example.com",
      rooms: [
        { ...validCreateInput.rooms[0], roomId: null },
        { ...validCreateInput.rooms[0], roomId: null, occupantName },
      ],
    });
    if (existingCount === 99_999) {
      expect(result).toMatchObject({ ok: false });
      expect(tx.reservation.create).not.toHaveBeenCalled();
      expect(tx.reservationNight.createMany).not.toHaveBeenCalled();
      return;
    }
    expect(result).toMatchObject({ ok: true, data: { reservationNumbers: existingCount === 9
      ? ["2026100900010", "2026100900011"]
      : ["2026100999998", "2026100999999"] } });
    expect(tx.reservation.count).toHaveBeenCalledWith({ where: { reservationNo: { startsWith: "20261009" } } });
    expect(tx.$executeRaw).toHaveBeenCalledWith(expect.any(Array), "reservation-no-20261009");
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.reservation.count.mock.invocationCallOrder[0]);
    const customOccupant = occupantName?.trim() === "Sari Putri";
    expect(tx.guest.create).toHaveBeenCalledTimes(customOccupant ? 2 : 1);
    if (customOccupant) {
      expect(tx.guest.create).toHaveBeenLastCalledWith({
        data: { fullName: "Sari Putri", phone: "08123456789", email: "booker@example.com" },
        select: { id: true },
      });
    }
    const reservations = tx.reservation.create.mock.calls.map(([args]) => args.data);
    expect(reservations.map((room) => room.guestId)).toEqual([88, customOccupant ? 89 : 88]);
    expect(reservations[0].groupBookingId).toEqual(expect.any(String));
    expect(reservations[1].groupBookingId).toBe(reservations[0].groupBookingId);
    reservations.forEach((room) => expect(room.reservationNo).toMatch(/^\d{13}$/));
  });
});

describe("reservation guest linking", () => {
  it.each([{ fullName: "" }, { idType: "" }, { email: "invalid" }])(
    "still validates guest fields when linking: %j",
    async (fields) => {
      await expect(createReservation({ ...validCreateInput, guestId: 42, ...fields })).resolves.toMatchObject({
        ok: false,
        code: "INVALID_RESERVATION_DATA",
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it.each([0, -2, 1.5, "invalid", ""])("rejects invalid guestId %s before the transaction", async (guestId) => {
    await expect(createReservation({ ...validCreateInput, guestId })).resolves.toMatchObject({
      ok: false,
      code: "INVALID_RESERVATION_DATA",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { guestId: "42", existing: { id: 42 }, expectedId: 42 },
    { guestId: 42, existing: null, expectedId: 88 },
    { guestId: undefined, existing: null, expectedId: 88 },
    { guestId: null, existing: null, expectedId: 88 },
  ])("updates/reuses or creates the guest for $guestId (existing: $existing)", async ({ guestId, existing, expectedId }) => {
    const base = transactionClient({
      room: { id: 10, number: "101", roomTypeId: 1, status: RoomStatus.VC },
    });
    const tx = {
      ...base,
      roomType: { findUnique: vi.fn().mockResolvedValue({ id: 1, name: "Standar", capacity: 2, baseRate: 500_000, _count: { rooms: 5 } }) },
      guest: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({ id: 42 }),
        create: vi.fn().mockResolvedValue({ id: 88 }),
      },
      reservation: {
        ...base.reservation,
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 77 }),
      },
      reservationNight: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    mocks.resolveNightlySchedule.mockResolvedValueOnce([
      { date: new Date("2026-10-01T00:00:00Z"), rate: new Prisma.Decimal(500_000), sourceRule: null },
    ]);
    runTransactionWith(tx);
    const redirectError = genuineRedirectError();
    mocks.redirect.mockImplementationOnce(() => { throw redirectError; });
    const fields = {
      fullName: "Nama Diperbarui", idType: "PASSPORT", idNumber: "A123",
      phone: "08123456789", email: "tamu@example.com", address: "Bandung", nationality: "Indonesia",
    };

    await expect(createReservation({ ...validCreateInput, ...fields, guestId })).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({ guestName: fields.fullName, redirectUrl: "/app/fo/reservasi/list?from=2026-10-01&to=2026-10-01" }),
    });

    if (guestId != null) {
      expect(tx.guest.findUnique).toHaveBeenCalledWith({ where: { id: 42 }, select: { id: true } });
    } else {
      expect(tx.guest.findUnique).not.toHaveBeenCalled();
    }
    if (existing) {
      expect(tx.guest.update).toHaveBeenCalledWith({ where: { id: 42 }, data: fields, select: { id: true } });
      expect(tx.guest.create).not.toHaveBeenCalled();
    } else {
      expect(tx.guest.create).toHaveBeenCalledWith({ data: fields, select: { id: true } });
      expect(tx.guest.update).not.toHaveBeenCalled();
    }
    expect(tx.reservation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ guestId: expectedId, rateAmount: new Prisma.Decimal(500_000), deposit: new Prisma.Decimal(500_000) }),
    }));
    expect(tx.reservationNight.createMany).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
  });
});

describe("catalog-backed reservation snapshots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  function mealTransaction() {
    const base = transactionClient({
      room: { id: 10, number: "101", roomTypeId: 1, status: RoomStatus.VC },
    });
    return {
      ...base,
      article: { findMany: vi.fn().mockResolvedValue([{ code: "MEAL-BB", defaultPrice: new Prisma.Decimal(90000) }]) },
      roomType: { findUnique: vi.fn().mockResolvedValue({ id: 1, name: "Standar", capacity: 2, baseRate: new Prisma.Decimal(500000), _count: { rooms: 5 } }) },
      guest: { create: vi.fn().mockResolvedValue({ id: 1 }), update: vi.fn() },
      reservation: {
        ...base.reservation,
        findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 77 }), update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: 77, guestId: 1, roomTypeId: 1,
          arrivalDate: new Date("2026-10-01"), departureDate: new Date("2026-10-02"),
          adults: 1, children: 0, arrangementType: "BB", status: "CONFIRMED", folio: null,
          reservationNights: [
            { id: "future", date: new Date("2026-10-01"), mealPlan: "BB", mealPax: 1,
              mealUnitPrice: new Prisma.Decimal(65000), mealAmount: new Prisma.Decimal(65000), folioLineItems: [] },
            { id: "past", date: new Date("2026-09-23"), mealPlan: "BB", mealPax: 1,
              mealUnitPrice: new Prisma.Decimal(50000), mealAmount: new Prisma.Decimal(50000), folioLineItems: [] },
            { id: "posted", date: new Date("2026-10-02"), mealPlan: "BB", mealPax: 1,
              mealUnitPrice: new Prisma.Decimal(50000), mealAmount: new Prisma.Decimal(50000), folioLineItems: [{ id: 9 }] },
          ],
        }),
      },
      reservationNight: { createMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
  }

  it("uses transaction-local catalog prices, not caller-supplied prices, for new bookings", async () => {
    const tx = mealTransaction();
    runTransactionWith(tx);
    mocks.resolveNightlySchedule.mockResolvedValueOnce([
      { date: new Date("2026-10-01"), rate: new Prisma.Decimal(500000), sourceRule: null },
    ]);
    await createReservation({ ...validCreateInput, arrangementType: "BB", mealUnitPrice: 1 });
    expect(tx.reservationNight.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      mealPlan: "BB", mealUnitPrice: new Prisma.Decimal(90000), mealAmount: new Prisma.Decimal(90000),
    })] });
  });

  it("pax-only changes keep stored prices and exclude past and posted nights", async () => {
    const tx = mealTransaction();
    runTransactionWith(tx);
    await updateReservation(77, { ...validEditInput, adults: 2 });
    expect(tx.article.findMany).not.toHaveBeenCalled();
    expect(tx.reservationNight.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: expect.objectContaining({ id: "future" }),
      data: { mealPlan: "BB", mealPax: 2, mealUnitPrice: new Prisma.Decimal(65000), mealAmount: new Prisma.Decimal(130000) },
    });
  });

  it("fails the transaction when a pax snapshot write loses its eligibility", async () => {
    const tx = mealTransaction();
    tx.reservationNight.updateMany.mockResolvedValue({ count: 0 });
    runTransactionWith(tx);
    expect(await updateReservation(77, { ...validEditInput, adults: 2 })).toMatchObject({ ok: false });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("extensions preserve retained meal prices and snapshot the active price for added nights", async () => {
    const tx = mealTransaction();
    const reservation = await tx.reservation.findUnique();
    tx.reservation.findUnique.mockResolvedValue({ ...reservation,
      reservationNights: reservation.reservationNights.filter((night: { id: string }) => night.id === "future"),
    });
    runTransactionWith(tx);
    mocks.resolveNightlySchedule.mockResolvedValueOnce([1, 2].map((day) => ({
      date: new Date(`2026-10-0${day}`), rate: new Prisma.Decimal(500000), sourceRule: null,
    })));
    await updateReservation(77, { ...validEditInput, departureDate: "2026-10-03" });
    expect(tx.reservationNight.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ mealUnitPrice: new Prisma.Decimal(65000), mealAmount: new Prisma.Decimal(65000) }),
      expect.objectContaining({ mealUnitPrice: new Prisma.Decimal(90000), mealAmount: new Prisma.Decimal(90000) }),
    ] });
  });

  it("quotes active prices without accepting a client price", async () => {
    mocks.articleFindMany.mockResolvedValue([{ code: "MEAL-BB", defaultPrice: new Prisma.Decimal(90000) }]);
    mocks.resolveNightlySchedule.mockResolvedValueOnce([
      { date: new Date("2026-10-01"), rate: new Prisma.Decimal(500000), sourceRule: null },
    ]);
    const result = await getReservationQuote({ ...validCreateInput, arrangementType: "BB" });
    expect(result).toMatchObject({
      ok: true, inclusionTotal: "90000",
      inclusionRooms: [{ pax: 1, nights: 1, unitPrice: "90000", total: "90000" }],
    });
  });
});

describe("reservation action failure boundary", () => {
  it("distinguishes a missing session from an insufficient role", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "SESSION_EXPIRED",
      error: "Sesi Anda telah berakhir. Silakan masuk kembali.",
    });

    mocks.auth.mockResolvedValueOnce({ user: { id: "2", role: "HK" } });
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      error: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
    });
  });

  it("returns Indonesian field validation without losing its target", async () => {
    await expect(
      createReservation({ ...validCreateInput, fullName: "" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "INVALID_RESERVATION_DATA",
      error: "Nama tamu wajib diisi",
      field: "fullName",
    });

    const malformedResult = await createReservation({
      ...validCreateInput,
      fullName: null,
    });
    expect(malformedResult).toMatchObject({
      ok: false,
      code: "INVALID_RESERVATION_DATA",
      error: "Data reservasi tidak valid. Periksa kembali formulir.",
      field: "fullName",
    });
    if (!malformedResult.ok) {
      expect(malformedResult.error).not.toMatch(/invalid input|expected string/i);
    }
  });

  it("maps invalid room type, invalid room, blocked room, and unavailable room", async () => {
    mocks.roomTypeFindMany.mockResolvedValueOnce([]);
    runTransactionWith(transactionClient({ roomType: null }));
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "INVALID_ROOM_TYPE",
      field: "rooms.0.roomTypeId",
    });

    runTransactionWith(
      transactionClient({
        roomType: { id: 1, baseRate: 500_000, capacity: 2 },
        room: null,
      }),
    );
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "INVALID_ROOM",
      field: "rooms.0.roomId",
    });

    runTransactionWith(
      transactionClient({
        roomType: { id: 1, baseRate: 500_000, capacity: 2 },
        room: { id: 10, number: "101", roomTypeId: 1, status: RoomStatus.OOO },
        blocked: true,
      }),
    );
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "ROOM_BLOCKED",
      error: "Kamar diblokir untuk Pemeliharaan pada 2026-10-01 hingga sebelum 2026-10-02. Pilih kamar atau tanggal lain.",
      field: "rooms.0.roomId",
    });

    runTransactionWith(
      transactionClient({
        roomType: { id: 1, baseRate: 500_000, capacity: 2 },
        room: { id: 10, number: "101", roomTypeId: 1, status: RoomStatus.VC },
        overlap: { id: 99 },
      }),
    );
    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "ROOM_UNAVAILABLE",
      error:
        "Kamar 101 sudah tidak tersedia untuk tanggal tersebut. Pilih kamar lain.",
      field: "rooms.0.roomId",
    });
  });

  it("maps unavailable stay-fee configuration to dedicated safe copy", async () => {
    mocks.transaction.mockRejectedValueOnce(
      new ReservationStayFeeError("internal stay-fee configuration detail"),
    );

    await expect(
      createReservation({
        ...validCreateInput,
        stayFeeKinds: ["EARLY_CHECK_IN"],
      }),
    ).resolves.toEqual({
      ok: false,
      code: "STAY_FEE_UNAVAILABLE",
      error:
        "Biaya fleksibilitas yang dipilih sedang tidak tersedia. Hapus pilihan atau hubungi admin.",
      field: "stayFeeKinds",
    });
  });

  it("maps a missing reservation and stale cancellation without changing status", async () => {
    runTransactionWith(transactionClient({ reservation: null }));
    await expect(cancelReservation(77)).resolves.toMatchObject({
      ok: false,
      code: "RESERVATION_NOT_FOUND",
    });

    runTransactionWith(
      transactionClient({
        reservation: {
          id: 77,
          status: ReservationStatus.CONFIRMED,
          folio: null,
        },
        updatedCount: 0,
      }),
    );
    await expect(cancelReservation(77)).resolves.toMatchObject({
      ok: false,
      code: "RESERVATION_CONFLICT",
      error:
        "Reservasi berubah sejak halaman ini dibuka. Muat ulang data lalu coba lagi.",
    });
  });

  it("contains known and unknown quote exceptions", async () => {
    const internalMessage = "selector model PricingRule database id=991";
    mocks.resolveNightlySchedule.mockRejectedValueOnce(
      new PricingResolutionError(internalMessage),
    );
    const knownResult = await getReservationQuote({
      rooms: [{ roomTypeId: 1, adults: 1, children: 0 }],
      arrangementType: "RO",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-02",
    });

    expect(knownResult).toMatchObject({
      ok: false,
      code: "PRICING_QUOTE_FAILED",
      error: "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
    });
    expect(knownResult).not.toEqual(expect.objectContaining({ error: internalMessage }));

    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    mocks.resolveNightlySchedule.mockRejectedValueOnce(new Error(internalMessage));
    const unknownResult = await getReservationQuote({
      rooms: [{ roomTypeId: 1, adults: 1, children: 0 }],
      arrangementType: "RO",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-02",
    });

    expect(unknownResult).toMatchObject({
      ok: false,
      code: "PRICING_QUOTE_FAILED",
      error: "Ringkasan harga tidak dapat dihitung. Silakan coba lagi.",
    });
    expect(unknownResult).not.toEqual(expect.objectContaining({ error: internalMessage }));
  });

  it("returns committed create success data when activity logging fails", async () => {
    const redirectError = genuineRedirectError();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockResolvedValueOnce({
      ok: true,
      reservationIds: [77],
      reservationNumbers: ["RES-20261001-001"],
      guestName: validCreateInput.fullName,
      groupBookingId: null,
    });
    mocks.logActivity.mockRejectedValueOnce(new Error("activity service unavailable"));
    mocks.redirect.mockImplementationOnce(() => {
      throw redirectError;
    });

    await expect(createReservation(validCreateInput, "kalender")).resolves.toEqual({
      ok: true,
      data: {
        reservationIds: [77],
        reservationNumbers: ["RES-20261001-001"],
        guestName: validCreateInput.fullName,
        groupBookingId: null,
        redirectUrl: "/app/fo/reservasi/kalender",
      },
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Reservation post-commit side effect failed",
      { action: "create", sideEffect: "activity-log" },
      expect.any(Error),
    );
  });

  it("returns committed edit success data when activity logging fails", async () => {
    const redirectError = genuineRedirectError();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockResolvedValueOnce({ ok: true });
    mocks.logActivity.mockRejectedValueOnce(new Error("activity service unavailable"));
    mocks.redirect.mockImplementationOnce(() => {
      throw redirectError;
    });

    await expect(updateReservation(77, validEditInput)).resolves.toEqual({
      ok: true,
      data: { reservationId: 77, redirectUrl: "/app/fo/reservasi/77?mode=view" },
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      "Reservation post-commit side effect failed",
      { action: "edit", sideEffect: "activity-log" },
      expect.any(Error),
    );
  });

  it("keeps a committed cancellation successful when activity logging fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockResolvedValueOnce({ ok: true });
    mocks.logActivity.mockRejectedValueOnce(new Error("activity service unavailable"));

    await expect(cancelReservation(77)).resolves.toEqual({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      "Reservation post-commit side effect failed",
      { action: "cancel", sideEffect: "activity-log" },
      expect.any(Error),
    );
  });

  it("does not revalidate when the authoritative transaction fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockRejectedValueOnce(new Error("transaction failed"));

    await expect(createReservation(validCreateInput)).resolves.toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibuat. Silakan coba lagi.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("contains unexpected create, edit, and cancellation exceptions", async () => {
    const internalMessage = "Prisma P2028 database transaction stack";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mocks.transaction.mockRejectedValueOnce(new Error(internalMessage));
    const createResult = await createReservation(validCreateInput);
    expect(createResult).toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibuat. Silakan coba lagi.",
    });

    mocks.transaction.mockRejectedValueOnce(new Error(internalMessage));
    const editResult = await updateReservation(77, validEditInput);
    expect(editResult).toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Perubahan reservasi tidak dapat disimpan. Silakan coba lagi.",
    });

    mocks.transaction.mockRejectedValueOnce(new Error(internalMessage));
    const cancelResult = await cancelReservation(77);
    expect(cancelResult).toMatchObject({
      ok: false,
      code: "UNEXPECTED_FAILURE",
      error: "Reservasi tidak dapat dibatalkan. Silakan coba lagi.",
    });

    for (const result of [createResult, editResult, cancelResult]) {
      if (!result.ok) {
        expect(result.error).not.toContain(internalMessage);
      }
    }
    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
