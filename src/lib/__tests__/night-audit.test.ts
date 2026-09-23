import { ArrangementType, Prisma, RoomStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAuditStayChargeLines,
  classifyNightAuditRevenues,
  executeNightAudit,
  MAX_AUDIT_ATTEMPTS,
  type NightAuditStayChargeReservation,
} from "@/lib/night-audit";
import { ROOM_CHARGE_ARTICLE_CODE, STAY_CHARGE_ARTICLE_CODES, type StayChargeArticle } from "@/lib/stay-charges";

const { transaction, tx } = vi.hoisted(() => ({
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    nightAudit: { findUnique: vi.fn(), create: vi.fn() },
    article: { findMany: vi.fn() },
    reservation: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    room: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    roomBlock: { findFirst: vi.fn() },
    cleaningSession: { findFirst: vi.fn() },
    housekeepingLog: { create: vi.fn() },
    fBOrder: { aggregate: vi.fn(), count: vi.fn() },
    folioLineItem: { findMany: vi.fn(), createMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction }, TRANSACTION_OPTIONS: {} }));

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("classifyNightAuditRevenues", () => {
  it.each([
    { code: "ROOM-CHARGE", type: "ROOM" as const, bucket: "roomRevenue" as const },
    { code: "ROOM-CUSTOM", type: "ROOM" as const, bucket: "roomRevenue" as const },
    { code: "MEAL-BB", type: "FB" as const, bucket: "inclusionRevenue" as const },
    { code: "LAUNDRY", type: "MISC" as const, bucket: "otherRevenue" as const },
  ])("classifies daytime $code as $bucket", ({ code, type, bucket }) => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [],
      existingDaytimeFolioLines: [{ amount: decimal("123.45"), article: { code, type } }],
      closedFbRevenueTotal: null,
      roomArticleId: 1,
    });

    expect(revenue[bucket].toString()).toBe("123.45");
    expect(revenue.fbRevenue.toString()).toBe(type === "FB" ? "123.45" : "0");
    expect(revenue.totalRevenue.toString()).toBe("123.45");
  });

  it("combines shortfalls, daytime charges, and closed F&B orders exactly once", () => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [
        { articleId: 1, amount: decimal(500_000) },
        { articleId: 2, amount: decimal(100_000) },
      ],
      existingDaytimeFolioLines: [
        { amount: decimal(400_000), article: { code: "ROOM-CHARGE", type: "ROOM" } },
        { amount: decimal(50_000), article: { code: "MEAL-BB", type: "FB" } },
        { amount: decimal(25_000), article: { code: "LAUNDRY", type: "MISC" } },
      ],
      closedFbRevenueTotal: "75000",
      roomArticleId: 1,
    });

    expect(revenue.roomRevenue.toString()).toBe("900000");
    expect(revenue.inclusionRevenue.toString()).toBe("150000");
    expect(revenue.closedFbOrderRevenue.toString()).toBe("75000");
    expect(revenue.fbRevenue.toString()).toBe("225000");
    expect(revenue.otherRevenue.toString()).toBe("25000");
    expect(revenue.totalRevenue.toString()).toBe("1150000");
    expect(revenue.totalRevenue.equals(
      revenue.roomRevenue.plus(revenue.fbRevenue).plus(revenue.otherRevenue),
    )).toBe(true);
  });

  it("gives ROOM-CHARGE code precedence over FB type without double counting", () => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [],
      existingDaytimeFolioLines: [
        { amount: decimal(100), article: { code: "ROOM-CHARGE", type: "FB" } },
      ],
      closedFbRevenueTotal: null,
      roomArticleId: 1,
    });
    expect(revenue.roomRevenue.toString()).toBe("100");
    expect(revenue.inclusionRevenue.toString()).toBe("0");
    expect(revenue.fbRevenue.toString()).toBe("0");
    expect(revenue.totalRevenue.toString()).toBe("100");
  });

  it("returns zero revenue when there are no charges or room article", () => {
    const revenue = classifyNightAuditRevenues({
      shortfallLineItems: [],
      existingDaytimeFolioLines: [],
      closedFbRevenueTotal: undefined,
      roomArticleId: undefined,
    });
    expect(Object.values(revenue).every((value) => value.isZero())).toBe(true);
  });
});

describe("executeNightAudit room-block reconciliation", () => {
  const now = new Date("2026-08-05T17:30:00Z"); // Aug 6 in WIB; reconcile Aug 7.
  const nextBusinessDate = date("2026-08-07");
  const run = () => executeNightAudit({ runById: 7, now });

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(async (operation) => operation(tx));
    tx.nightAudit.findUnique.mockResolvedValue(null);
    tx.nightAudit.create.mockResolvedValue({ id: 1, runAt: now, runBy: { fullName: "Auditor" } });
    tx.article.findMany.mockResolvedValue(STAY_CHARGE_ARTICLE_CODES.map((code, index) => ({
      id: index + 1, code, name: code, type: index === 0 ? "ROOM" : "FB", defaultPrice: decimal(0),
    })));
    tx.reservation.findMany.mockResolvedValue([]);
    tx.reservation.count.mockResolvedValue(0);
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.room.count.mockResolvedValue(1);
    tx.room.findMany.mockResolvedValue([{ id: 10 }]);
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status: RoomStatus.VC });
    tx.room.updateMany.mockResolvedValue({ count: 1 });
    tx.roomBlock.findFirst.mockResolvedValue({ id: 20 });
    tx.cleaningSession.findFirst.mockResolvedValue(null);
    tx.fBOrder.aggregate.mockResolvedValue({ _sum: { total: null } });
    tx.fBOrder.count.mockResolvedValue(0);
    tx.folioLineItem.findMany.mockResolvedValue([]);
  });

  it.each([RoomStatus.VC, RoomStatus.VD, RoomStatus.VCU, RoomStatus.OC, RoomStatus.OD])("activates a covering block from %s with no physical occupant", async (status) => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status });
    const result = await run();
    expect(result.ok).toBe(true);
    expect(tx.room.updateMany).toHaveBeenCalledWith({ where: { id: 10, status }, data: { status: "OOO" } });
    expect(tx.housekeepingLog.create).toHaveBeenCalledWith({ data: {
      roomId: 10, oldStatus: status, newStatus: "OOO", updatedById: 7, updatedAt: now,
      note: "Blokir kamar #20 aktif pada pergantian hari bisnis.",
    } });
    if (result.ok) expect(result.summary.transactionWriteCount).toBe(3);
  });

  it.each([
    ["starts on next day", "2026-08-07", "2026-08-08", "ACTIVE", "VC", "OOO"],
    ["already started", "2026-08-01", "2026-08-08", "ACTIVE", "VD", "OOO"],
    ["ends on next day", "2026-08-01", "2026-08-07", "ACTIVE", "OOO", "VD"],
    ["expired", "2026-08-01", "2026-08-06", "ACTIVE", "OOO", "VD"],
    ["future block", "2026-08-08", "2026-08-09", "ACTIVE", "VC", null],
    ["released block", "2026-08-01", "2026-08-08", "RELEASED", "VC", null],
    ["still covered", "2026-08-01", "2026-08-08", "ACTIVE", "OOO", null],
  ])("uses half-open next-business-day coverage: %s", async (_, start, end, blockStatus, status, expected) => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status });
    tx.roomBlock.findFirst.mockImplementation(async ({ where }) => {
      expect(where).toEqual({ roomId: 10, status: "ACTIVE", startDate: { lte: nextBusinessDate }, endDate: { gt: nextBusinessDate } });
      return blockStatus === where.status && date(start) <= where.startDate.lte && date(end) > where.endDate.gt ? { id: 20 } : null;
    });
    expect((await run()).ok).toBe(true);
    if (expected) {
      expect(tx.room.updateMany).toHaveBeenCalledWith({ where: { id: 10, status }, data: { status: expected } });
    } else {
      expect(tx.room.updateMany).not.toHaveBeenCalled();
      expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
    }
  });

  it("clears orphan OOO and logs the exact expiry note", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status: "OOO" });
    tx.roomBlock.findFirst.mockResolvedValue(null);
    await run();
    expect(tx.housekeepingLog.create).toHaveBeenCalledWith({ data: {
      roomId: 10, oldStatus: "OOO", newStatus: "VD", updatedById: 7, updatedAt: now,
      note: "Blokir kamar telah berakhir. Kamar dialihkan ke VD untuk pembersihan.",
    } });
  });

  it.each(["VC", "OOO"])("protects physical occupants and all-date cleaning sessions from %s transitions", async (status) => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status });
    tx.roomBlock.findFirst.mockResolvedValue(status === "OOO" ? null : { id: 20 });
    for (const guard of [tx.reservation.findFirst, tx.cleaningSession.findFirst]) {
      guard.mockResolvedValue({ id: 99 });
      const result = await run();
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.summary.warnings.join(" ")).toContain("101");
      expect(tx.room.updateMany).not.toHaveBeenCalled();
      expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
      guard.mockResolvedValue(null);
    }
    expect(tx.reservation.findFirst).toHaveBeenCalledWith({ where: { roomId: 10, status: "CHECKED_IN" }, select: { id: true } });
    expect(tx.cleaningSession.findFirst).toHaveBeenCalledWith({ where: { roomId: 10, startedAt: { not: null }, finishedAt: null }, select: { id: true } });
  });

  it("selects candidates in lock order and rechecks state after the physical room lock", async () => {
    await run();
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(tx.room.findMany).toHaveBeenCalledWith({
      where: { OR: [{ status: "OOO" }, { roomBlocks: { some: { status: "ACTIVE", startDate: { lte: nextBusinessDate }, endDate: { gt: nextBusinessDate } } } }] },
      select: { id: true }, orderBy: { id: "asc" },
    });
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain('SELECT id FROM "room" WHERE id = ? FOR UPDATE');
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(10);
    for (const read of [tx.room.findUnique, tx.roomBlock.findFirst, tx.reservation.findFirst, tx.cleaningSession.findFirst]) {
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(read.mock.invocationCallOrder[0]);
    }
    expect(tx.room.count.mock.invocationCallOrder[0]).toBeLessThan(tx.room.updateMany.mock.invocationCallOrder[0]);
  });

  it("locks multiple candidates in order before updating their freshly read status", async () => {
    tx.room.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    tx.room.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, number: String(where.id), status: "VD" }));
    await run();
    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([10, 11]);
    expect(tx.room.updateMany.mock.calls.map(([args]) => args.where)).toEqual([
      { id: 10, status: "VD" }, { id: 11, status: "VD" },
    ]);
    expect(tx.housekeepingLog.create).toHaveBeenCalledTimes(2);
  });

  it("keeps OOO when a replacement covering block is found after locking", async () => {
    tx.room.findUnique.mockResolvedValue({ id: 10, number: "101", status: "OOO" });
    tx.roomBlock.findFirst.mockResolvedValue(null);
    tx.$queryRaw.mockImplementation(async () => {
      tx.roomBlock.findFirst.mockResolvedValue({ id: 21 });
      return [{ id: 10 }];
    });
    expect((await run()).ok).toBe(true);
    expect(tx.roomBlock.findFirst).toHaveBeenCalled();
    expect(tx.room.updateMany).not.toHaveBeenCalled();
    expect(tx.housekeepingLog.create).not.toHaveBeenCalled();
  });

  it("does not activate a candidate whose block no longer covers the date after locking", async () => {
    tx.$queryRaw.mockImplementation(async () => {
      tx.roomBlock.findFirst.mockResolvedValue(null);
      return [{ id: 10 }];
    });
    expect((await run()).ok).toBe(true);
    expect(tx.roomBlock.findFirst).toHaveBeenCalled();
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });

  it("does not write when the locked room has disappeared", async () => {
    tx.room.findUnique.mockResolvedValue(null);
    expect((await run()).ok).toBe(true);
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });

  it("retries conditional-write conflicts without logging a failed transition", async () => {
    tx.room.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await run()).ok).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(tx.housekeepingLog.create).toHaveBeenCalledTimes(1);
    expect(tx.nightAudit.create).toHaveBeenCalledTimes(1);
  });

  it("aborts on log failure before creating the audit row", async () => {
    tx.housekeepingLog.create.mockRejectedValue(new Error("log unavailable"));
    await expect(run()).rejects.toThrow("log unavailable");
    expect(tx.nightAudit.create).not.toHaveBeenCalled();
  });

  it("does not reconcile an already completed audit", async () => {
    tx.nightAudit.findUnique.mockResolvedValue({ id: 1 });
    expect((await run()).ok).toBe(false);
    expect(tx.room.findMany).not.toHaveBeenCalled();
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });
});

describe("night audit domain logic", () => {
  it("exports MAX_AUDIT_ATTEMPTS = 3", () => {
    expect(MAX_AUDIT_ATTEMPTS).toBe(3);
  });

  it("buildAuditStayChargeLines generates shortfall lines for room and inclusions", () => {
    const articles: StayChargeArticle[] = [
      {
        id: 1,
        code: ROOM_CHARGE_ARTICLE_CODE,
        name: "Room Charge",
        type: "ROOM",
        defaultPrice: decimal(500_000),
      },
      {
        id: 2,
        code: "MEAL-BB",
        name: "Breakfast",
        type: "FB",
        defaultPrice: decimal(50_000),
      },
    ];

    const reservation: NightAuditStayChargeReservation = {
      reservationId: 101,
      reservationNo: "RSV-101",
      folioId: 201,
      arrivalDate: date("2026-08-05"),
      departureDate: date("2026-08-07"),
      reservationNights: [
        {
          id: "night-1",
          reservationId: 101,
          date: date("2026-08-05"),
          rateAmount: decimal(500_000),
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: decimal(50_000),
          mealAmount: decimal(100_000),
        },
        {
          id: "night-2",
          reservationId: 101,
          date: date("2026-08-06"),
          rateAmount: decimal(500_000),
          mealPlan: ArrangementType.BB,
          mealPax: 2,
          mealUnitPrice: decimal(50_000),
          mealAmount: decimal(100_000),
        },
      ],
    };

    // When running audit on business date 2026-08-05, only night-1 should be posted
    const lines = buildAuditStayChargeLines({
      reservation,
      existingLineItems: [],
      articles,
      businessDate: date("2026-08-05"),
      postedById: 1,
      postedAt: date("2026-08-05"),
      label: "2026-08-05",
    });

    expect(lines).toHaveLength(2); // 1 room charge + 1 breakfast inclusion
    const roomLine = lines.find((l) => l.articleId === 1);
    const mealLine = lines.find((l) => l.articleId === 2);

    expect(roomLine).toBeDefined();
    expect(roomLine?.amount.toString()).toBe("500000");
    expect(roomLine?.reservationNightId).toBe("night-1");
    expect(roomLine?.description).toBe("Night Audit Room Charge - 2026-08-05");

    expect(mealLine).toBeDefined();
    expect(mealLine?.amount.toString()).toBe("100000");
    expect(mealLine?.reservationNightId).toBe("night-1");
    expect(mealLine?.description).toBe("Night Audit Breakfast Inclusion - 2026-08-05");
  });

  it("buildAuditStayChargeLines returns empty array if night was already posted", () => {
    const articles: StayChargeArticle[] = [
      {
        id: 1,
        code: ROOM_CHARGE_ARTICLE_CODE,
        name: "Room Charge",
        type: "ROOM",
        defaultPrice: decimal(500_000),
      },
    ];

    const reservation: NightAuditStayChargeReservation = {
      reservationId: 101,
      reservationNo: "RSV-101",
      folioId: 201,
      arrivalDate: date("2026-08-05"),
      departureDate: date("2026-08-06"),
      reservationNights: [
        {
          id: "night-1",
          reservationId: 101,
          date: date("2026-08-05"),
          rateAmount: decimal(500_000),
          mealPlan: null,
          mealPax: null,
          mealUnitPrice: null,
          mealAmount: null,
        },
      ],
    };

    // Already posted by checkout catch-up
    const existingLineItems = [
      {
        articleId: 1,
        fbOrderId: null,
        reservationNightId: "night-1",
      },
    ];

    const lines = buildAuditStayChargeLines({
      reservation,
      existingLineItems,
      articles,
      businessDate: date("2026-08-05"),
      postedById: 1,
      postedAt: date("2026-08-05"),
      label: "2026-08-05",
    });

    expect(lines).toHaveLength(0);
  });
});
