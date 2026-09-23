import {
  ArticleType,
  DepositStatus,
  FBOrderStatus,
  FolioStatus,
  PaymentMethod,
  ReservationStatus,
  ReservationStayFeeKind,
  RoomStatus,
  TableStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chargeOrderToRoom, payOrderDirect } from "@/app/app/fb/orders/[orderId]/actions";
import { setReservationStayFee } from "@/app/app/fo/reservasi/[id]/actions";
import { computeFolioTotals } from "@/lib/folio-totals";
import { hotelTodayDateOnly } from "@/lib/date-only";
import {
  buildNightAuditPlan,
  executeNightAudit,
} from "@/lib/night-audit";
import { prisma } from "@/lib/prisma";
import { ROOM_CHARGE_ARTICLE_CODE } from "@/lib/stay-charges";
import { STAY_FEE_DEFINITIONS } from "@/lib/reservation-stay-fee-definitions";

import {
  createArticle,
  createFBOrder,
  createFolio,
  createFolioLine,
  createGuest,
  createHotelSettings,
  createReservationFixture,
  createRoom,
  createRoomType,
  createUser,
  resetTestDatabase,
} from "./fixtures";

const FROZEN_NOW = new Date("2026-08-05T05:00:00.000Z"); // 12:00 WIB
const BUSINESS_DATE = hotelTodayDateOnly(FROZEN_NOW);

async function setupStayChargeArticles() {
  const roomArticle = await createArticle({
    code: ROOM_CHARGE_ARTICLE_CODE,
    type: ArticleType.ROOM,
    name: "Room Charge",
  });
  const bbArticle = await createArticle({
    code: "MEAL-BB",
    type: ArticleType.FB,
    defaultPrice: 50_000,
    name: "Breakfast",
  });
  const hbArticle = await createArticle({
    code: "MEAL-HB",
    type: ArticleType.FB,
    defaultPrice: 150_000,
    name: "Half Board",
  });
  const fbArticle = await createArticle({
    code: "MEAL-FB",
    type: ArticleType.FB,
    defaultPrice: 250_000,
    name: "Full Board",
  });

  return { roomArticle, bbArticle, hbArticle, fbArticle };
}

describe("Night Audit Database Integration Tests", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.TEST_AUTH_ROLE = "ACC";
  });

  describe("Stay fee Night Audit boundary", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(FROZEN_NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
      delete process.env.TEST_AUTH_ROLE;
      delete process.env.TEST_AUTH_USER_ID;
    });

    it.each([
      ReservationStayFeeKind.EARLY_CHECK_IN,
      ReservationStayFeeKind.LATE_CHECK_OUT,
    ])("rejects checked-in %s after a successful audit without mutations", async (kind) => {
      const user = await createUser();
      await createHotelSettings();
      await setupStayChargeArticles();
      const definition = STAY_FEE_DEFINITIONS[kind];
      await createArticle({
        code: definition.articleCode,
        type: ArticleType.MISC,
        defaultPrice: definition.unitPrice,
        name: definition.label,
      });
      const roomType = await createRoomType();
      const room = await createRoom(roomType.id, RoomStatus.OC);
      const guest = await createGuest();
      const { reservation } = await createReservationFixture({
        userId: user.id,
        roomTypeId: roomType.id,
        guestId: guest.id,
        roomId: room.id,
        arrivalDate: "2026-08-05",
        nightlyRates: [550_000, 550_000],
        status: ReservationStatus.CHECKED_IN,
        depositStatus: DepositStatus.COLLECTED,
      });
      await createFolio(reservation.id);

      const audit = await executeNightAudit({ runById: user.id, now: FROZEN_NOW });
      expect(audit).toMatchObject({ ok: true });

      const readState = async () => ({
        reservations: await prisma.reservation.findMany({ orderBy: { id: "asc" } }),
        rooms: await prisma.room.findMany({ orderBy: { id: "asc" } }),
        fees: await prisma.reservationStayFee.findMany({ orderBy: { id: "asc" } }),
        folios: await prisma.folio.findMany({ orderBy: { id: "asc" } }),
        lines: await prisma.folioLineItem.findMany({ orderBy: { id: "asc" } }),
        payments: await prisma.payment.findMany({ orderBy: { id: "asc" } }),
        audits: await prisma.nightAudit.findMany({ orderBy: { id: "asc" } }),
      });
      const before = await readState();
      expect(before.fees).toHaveLength(0);
      expect(before.audits).toHaveLength(1);

      const result = await setReservationStayFee({
        reservationId: reservation.id,
        kind,
        selected: true,
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Audit malam untuk tanggal bisnis hari ini sudah selesai. Biaya fleksibilitas tidak dapat diposting.",
        disposition: "skipped",
      });
      expect(await readState()).toEqual(before);
    });
  });

  describe("F&B payment Night Audit boundary", () => {
    const AFTER_AUDIT_TIME = new Date("2026-08-05T16:30:00.000Z"); // 23:30 WIB
    const NEXT_WIB_DATE = new Date("2026-08-05T17:05:00.000Z"); // Aug 6, 00:05 WIB

    beforeEach(() => {
      // Freeze application timestamps only; PostgreSQL/Prisma timers must keep running.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(AFTER_AUDIT_TIME);
    });

    afterEach(() => {
      vi.useRealTimers();
      delete process.env.TEST_AUTH_ROLE;
      delete process.env.TEST_AUTH_USER_ID;
    });

    async function setupBilledRoomCharge() {
      const user = await createUser();
      process.env.TEST_AUTH_ROLE = "FB";
      const settings = await createHotelSettings({
        serviceChargePercent: 10,
        taxPercent: 10,
      });
      await setupStayChargeArticles();
      const dinnerArticle = await createArticle({
        code: "DINNER",
        type: ArticleType.FB,
        defaultPrice: 50_000,
      });
      const roomType = await createRoomType({ baseRate: 500_000 });
      const room = await createRoom(roomType.id, RoomStatus.OC);
      const guest = await createGuest();
      const { reservation } = await createReservationFixture({
        userId: user.id,
        roomTypeId: roomType.id,
        guestId: guest.id,
        roomId: room.id,
        arrivalDate: "2026-08-05",
        nightlyRates: [500_000, 500_000],
        status: ReservationStatus.CHECKED_IN,
        depositStatus: DepositStatus.COLLECTED,
      });
      const folio = await createFolio(reservation.id);
      const table = await prisma.restaurantTable.create({
        data: { number: "T201", status: TableStatus.OCCUPIED },
      });
      const menuItem = await prisma.menuItem.create({
        data: {
          code: "DINNER-201",
          name: "Makan malam",
          category: "Makanan",
          price: 50_000,
        },
      });
      const order = await createFBOrder({
        waitedById: user.id,
        status: FBOrderStatus.BILLED,
        subtotal: 100_000,
        serviceCharge: 10_000,
        tax: 11_000,
        total: 121_000,
        tableNo: table.number,
      });
      await prisma.fBOrder.update({
        where: { id: order.id },
        data: { tableId: table.id, openedAt: AFTER_AUDIT_TIME },
      });
      const item = await prisma.fBOrderItem.create({
        data: {
          fbOrderId: order.id,
          menuItemId: menuItem.id,
          quantity: 2,
          unitPrice: 50_000,
          amount: 100_000,
        },
      });
      return { user, settings, dinnerArticle, room, folio, table, order, item };
    }

    async function readBillingState() {
      // Include all rows so a partial selection cannot leave an unnoticed split order.
      return {
        orders: await prisma.fBOrder.findMany({ orderBy: { id: "asc" } }),
        items: await prisma.fBOrderItem.findMany({ orderBy: { id: "asc" } }),
        folios: await prisma.folio.findMany({ orderBy: { id: "asc" } }),
        lines: await prisma.folioLineItem.findMany({ orderBy: { id: "asc" } }),
        tables: await prisma.restaurantTable.findMany({ orderBy: { id: "asc" } }),
        payments: await prisma.payment.findMany({ orderBy: { id: "asc" } }),
        audits: await prisma.nightAudit.findMany({ orderBy: { id: "asc" } }),
      };
    }

    it.each([
      { selection: "full", quantity: 2 },
      { selection: "partial", quantity: 1 },
    ])("rejects $selection billing after today's audit without any billing mutations", async ({ quantity }) => {
      const { user, room, order, item } = await setupBilledRoomCharge();
      const audit = await executeNightAudit({ runById: user.id, now: new Date() });
      expect(audit.ok).toBe(true);
      const before = await readBillingState();

      const result = await chargeOrderToRoom({
        orderId: order.id,
        roomNumber: room.number,
        selectedItems: [{ orderItemId: item.id, quantity }],
      });

      expect(result).toEqual({
        ok: false,
        error: "Audit malam untuk tanggal bisnis hari ini sudah selesai. Pesanan tidak dapat ditagihkan ke kamar.",
      });
      expect(await readBillingState()).toEqual(before);
    });

    it.each([
      { method: PaymentMethod.CASH, selection: "full", quantity: 2 },
      { method: PaymentMethod.CASH, selection: "partial", quantity: 1 },
      { method: PaymentMethod.CARD, selection: "full", quantity: 2 },
      { method: PaymentMethod.CARD, selection: "partial", quantity: 1 },
    ])("rejects $selection direct $method payment after today's audit without mutations", async ({ method, quantity }) => {
      const { user, table, order, item } = await setupBilledRoomCharge();
      expect(await executeNightAudit({ runById: user.id, now: new Date() }))
        .toMatchObject({ ok: true });
      const before = await readBillingState();

      const result = await payOrderDirect({
        orderId: order.id,
        method,
        amountTendered: 121_000,
        selectedItems: [{ orderItemId: item.id, quantity }],
      });

      expect(result).toEqual({
        ok: false,
        error: "Audit malam untuk tanggal bisnis hari ini sudah selesai. Pembayaran pesanan tidak dapat diproses.",
      });
      expect(await readBillingState()).toEqual(before);
      expect(await prisma.fBOrder.findUniqueOrThrow({ where: { id: order.id } }))
        .toMatchObject({ status: FBOrderStatus.BILLED, closedAt: null });
      expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
        .toMatchObject({ status: TableStatus.OCCUPIED });
      expect(await prisma.payment.count()).toBe(0);
    });

    it.each([PaymentMethod.CASH, PaymentMethod.CARD])(
      "accepts direct %s payment on the next WIB date and includes revenue only in that audit",
      async (method) => {
        const { user, table, order, item } = await setupBilledRoomCharge();
        expect(await executeNightAudit({ runById: user.id, now: new Date() }))
          .toMatchObject({ ok: true, summary: { fbRevenue: "0" } });
        const priorAudit = await prisma.nightAudit.findUniqueOrThrow({
          where: { businessDate: BUSINESS_DATE },
        });
        vi.setSystemTime(NEXT_WIB_DATE);

        const result = await payOrderDirect({
          orderId: order.id,
          method,
          amountTendered: 121_000,
          selectedItems: [{ orderItemId: item.id, quantity: 2 }],
        });

        expect(result).toMatchObject({
          ok: true, receiptOrderId: order.id, paymentMethod: method,
          paidTotal: "121000", fullyPaid: true,
        });
        expect(await prisma.fBOrder.findUniqueOrThrow({ where: { id: order.id } }))
          .toMatchObject({ status: FBOrderStatus.CLOSED, paymentMethod: method, closedAt: NEXT_WIB_DATE });
        expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
          .toMatchObject({ status: TableStatus.AVAILABLE });
        const payments = await prisma.payment.findMany();
        expect(payments).toHaveLength(1);
        expect(payments[0]).toMatchObject({
          fbOrderId: order.id, folioId: null, method, receivedAt: NEXT_WIB_DATE,
        });
        expect(payments[0].amount.toString()).toBe("121000");

        expect(await executeNightAudit({ runById: user.id, now: new Date() }))
          .toMatchObject({ ok: true, summary: { fbRevenue: "121000", totalRevenue: "621000" } });
        const nextAudit = await prisma.nightAudit.findUniqueOrThrow({
          where: { businessDate: hotelTodayDateOnly(NEXT_WIB_DATE) },
        });
        expect(nextAudit.fbRevenue.toString()).toBe("121000");
        expect(nextAudit.totalRevenue.toString()).toBe("621000");
        expect(await prisma.nightAudit.findUniqueOrThrow({ where: { id: priorAudit.id } }))
          .toEqual(priorAudit);
      },
    );

    it("bills before audit, counts inclusive F&B revenue once, and does not tax it again on the folio", async () => {
      const { user, settings, dinnerArticle, room, folio, table, order, item } =
        await setupBilledRoomCharge();

      const result = await chargeOrderToRoom({
        orderId: order.id,
        roomNumber: room.number,
        selectedItems: [{ orderItemId: item.id, quantity: 2 }],
      });
      expect(result).toMatchObject({
        ok: true,
        receiptOrderId: order.id,
        paymentMethod: PaymentMethod.CHARGE_TO_ROOM,
        paidTotal: "121000",
        folioId: folio.id,
        fullyPaid: true,
      });
      const closedOrder = await prisma.fBOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(closedOrder).toMatchObject({
        status: FBOrderStatus.CLOSED,
        paymentMethod: PaymentMethod.CHARGE_TO_ROOM,
        chargedFolioId: folio.id,
        closedAt: AFTER_AUDIT_TIME,
      });
      expect(closedOrder.subtotal.toString()).toBe("100000");
      expect(closedOrder.serviceCharge.toString()).toBe("10000");
      expect(closedOrder.tax.toString()).toBe("11000");
      expect(closedOrder.total.toString()).toBe("121000");
      expect(await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
        .toMatchObject({ status: TableStatus.AVAILABLE });

      const billedLines = await prisma.folioLineItem.findMany({
        where: { folioId: folio.id },
        include: { article: true },
      });
      expect(billedLines).toHaveLength(1);
      expect(billedLines[0]).toMatchObject({
        articleId: dinnerArticle.id,
        fbOrderId: order.id,
        postedAt: AFTER_AUDIT_TIME,
      });
      expect(billedLines[0].amount.toString()).toBe("121000");
      expect(computeFolioTotals(billedLines, [], settings)).toEqual({
        subtotal: 0, serviceCharge: 0, tax: 0, taxableExtras: 0,
        inclusiveCharges: 121_000,
                totalCharges: 121_000, totalPaid: 0, balance: 121_000,
      });

      const audit = await executeNightAudit({ runById: user.id, now: new Date() });
      expect(audit).toMatchObject({
        ok: true,
        summary: {
          roomRevenue: "500000",
          fbRevenue: "121000",
          otherRevenue: "0",
          totalRevenue: "621000",
          lineItemsPosted: 1,
        },
      });
      const savedAudit = await prisma.nightAudit.findUniqueOrThrow({
        where: { businessDate: BUSINESS_DATE },
      });
      expect(savedAudit.fbRevenue.toString()).toBe("121000");
      expect(savedAudit.otherRevenue.toString()).toBe("0");
      expect(savedAudit.totalRevenue.toString()).toBe("621000");
      const auditedLines = await prisma.folioLineItem.findMany({
        where: { folioId: folio.id },
        include: { article: true },
      });
      expect(auditedLines).toHaveLength(2);
      expect(auditedLines.filter((line) => line.fbOrderId === order.id)).toHaveLength(1);
      expect(computeFolioTotals(auditedLines, [], settings)).toEqual({
        subtotal: 500_000, serviceCharge: 50_000, tax: 55_000, taxableExtras: 0,
        inclusiveCharges: 121_000,
                totalCharges: 726_000, totalPaid: 0, balance: 726_000,
      });
    });

    it("allows billing on the next WIB date even while UTC is still the audited date", async () => {
      const { user, room, folio, order, item } = await setupBilledRoomCharge();
      expect(await executeNightAudit({ runById: user.id, now: new Date() }))
        .toMatchObject({ ok: true });
      vi.setSystemTime(NEXT_WIB_DATE);

      const result = await chargeOrderToRoom({
        orderId: order.id,
        roomNumber: room.number,
        selectedItems: [{ orderItemId: item.id, quantity: 2 }],
      });
      expect(result).toMatchObject({ ok: true, paidTotal: "121000", fullyPaid: true });
      expect(await prisma.fBOrder.findUniqueOrThrow({ where: { id: order.id } }))
        .toMatchObject({ status: FBOrderStatus.CLOSED, closedAt: NEXT_WIB_DATE });
      const lines = await prisma.folioLineItem.findMany({
        where: { folioId: folio.id, fbOrderId: order.id },
      });
      expect(lines).toHaveLength(1);
      expect(lines[0].postedAt).toEqual(NEXT_WIB_DATE);
      const priorAudit = await prisma.nightAudit.findUniqueOrThrow({
        where: { businessDate: BUSINESS_DATE },
      });
      expect(priorAudit.fbRevenue.toString()).toBe("0");
      expect(await prisma.nightAudit.count()).toBe(1);
    });
  });

  it("Test 1: Baseline Night Audit Run - commits authoritative 17-field snapshot and posts stay charges", async () => {
    const user = await createUser();
    await createHotelSettings();
    const { roomArticle } = await setupStayChargeArticles();

    const laundryArticle = await createArticle({
      code: "LAUNDRY",
      type: ArticleType.MISC,
      defaultPrice: 75_000,
      name: "Laundry",
    });

    const roomType = await createRoomType({ baseRate: 500_000 });
    const room1 = await createRoom(roomType.id, RoomStatus.OC);
    await createRoom(roomType.id, RoomStatus.VC);

    const guest = await createGuest();
    const { reservation } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      roomId: room1.id,
      arrivalDate: "2026-08-05",
      nightlyRates: [500_000, 500_000],
      status: ReservationStatus.CHECKED_IN,
      depositStatus: DepositStatus.COLLECTED,
    });
    const folio = await createFolio(reservation.id, FolioStatus.OPEN);

    // Closed F&B order for today's operating day
    await createFBOrder({
      waitedById: user.id,
      total: 120_000,
      status: FBOrderStatus.CLOSED,
      closedAt: FROZEN_NOW,
    });

    // Manual other folio charge for today
    await createFolioLine({
      folioId: folio.id,
      articleId: laundryArticle.id,
      amount: 75_000,
      postedById: user.id,
      postedAt: FROZEN_NOW,
    });

    const result = await executeNightAudit({
      runById: user.id,
      now: FROZEN_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.roomRevenue).toBe("500000");
    expect(result.summary.fbRevenue).toBe("120000");
    expect(result.summary.otherRevenue).toBe("75000");
    expect(result.summary.totalRevenue).toBe("695000");
    expect(result.summary.roomsCharged).toBe(1);
    expect(result.summary.lineItemsPosted).toBe(1);

    // Assert stay charge was posted to folio
    const folioLines = await prisma.folioLineItem.findMany({
      where: { folioId: folio.id },
    });
    expect(folioLines).toHaveLength(2); // 1 manual laundry + 1 stay charge
    const roomLine = folioLines.find((l) => l.articleId === roomArticle.id);
    expect(roomLine).toBeDefined();
    expect(roomLine!.amount.toString()).toBe("500000");

    // Assert that all 17 fields in NightAudit match expected state
    const audit = await prisma.nightAudit.findUniqueOrThrow({
      where: { businessDate: BUSINESS_DATE },
    });

    expect(typeof audit.id).toBe("number"); // 1
    expect(audit.businessDate).toEqual(BUSINESS_DATE); // 2
    expect(audit.status).toBe("COMPLETED"); // 3
    expect(audit.runAt instanceof Date).toBe(true); // 4
    expect(audit.runById).toBe(user.id); // 5
    expect(audit.totalRooms).toBe(2); // 6
    expect(audit.roomsOccupied).toBe(1); // 7
    expect(Number(audit.occupancyRate)).toBe(50); // 8 (50.00%)
    expect(audit.roomRevenue.toString()).toBe("500000"); // 9
    expect(audit.fbRevenue.toString()).toBe("120000"); // 10
    expect(audit.otherRevenue.toString()).toBe("75000"); // 11
    expect(audit.totalRevenue.toString()).toBe("695000"); // 12
    expect(audit.checkInCount).toBe(1); // 13
    expect(audit.checkOutCount).toBe(0); // 14
    expect(audit.inHouseCount).toBe(1); // 15
    expect(audit.roomNightsSold).toBeNull(); // 16
    expect(audit.createdAt instanceof Date).toBe(true); // 17
  });

  it("Test 2: Concurrent Mutation Immunity (Issue #184 Test) - re-queries revenues inside tx", async () => {
    const user = await createUser();
    await createHotelSettings();
    await setupStayChargeArticles();

    const otherArticle = await createArticle({
      code: "MINIBAR",
      type: ArticleType.MISC,
      defaultPrice: 50_000,
      name: "Minibar",
    });

    const roomType = await createRoomType({ baseRate: 500_000 });
    const room = await createRoom(roomType.id, RoomStatus.OC);
    const guest = await createGuest();
    const { reservation } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      roomId: room.id,
      arrivalDate: "2026-08-05",
      nightlyRates: [500_000],
      status: ReservationStatus.CHECKED_IN,
      depositStatus: DepositStatus.COLLECTED,
    });
    const folio = await createFolio(reservation.id, FolioStatus.OPEN);

    // Initial closed F&B order: 100.000
    await createFBOrder({
      waitedById: user.id,
      total: 100_000,
      status: FBOrderStatus.CLOSED,
      closedAt: FROZEN_NOW,
    });

    // Initial manual folio charge: 50.000
    await createFolioLine({
      folioId: folio.id,
      articleId: otherArticle.id,
      amount: 50_000,
      postedById: user.id,
      postedAt: FROZEN_NOW,
    });

    // 1. Capture advisory preview (stale snapshot before concurrent mutations)
    const preview = await buildNightAuditPlan({
      runById: user.id,
      now: FROZEN_NOW,
    });
    expect(preview.closedFbRevenue).toBe("100000");
    expect(preview.otherRevenue).toBe("50000");
    expect(preview.totalRevenue).toBe("650000");

    // 2. Concurrently close an additional F&B order (+Rp 200.000)
    await createFBOrder({
      waitedById: user.id,
      total: 200_000,
      status: FBOrderStatus.CLOSED,
      closedAt: FROZEN_NOW,
    });

    // 3. Concurrently add an additional manual folio charge (+Rp 150.000)
    await createFolioLine({
      folioId: folio.id,
      articleId: otherArticle.id,
      amount: 150_000,
      postedById: user.id,
      postedAt: FROZEN_NOW,
    });

    // 4. Execute audit
    const result = await executeNightAudit({
      runById: user.id,
      now: FROZEN_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The committed NightAudit must include the concurrent mutations!
    expect(result.summary.fbRevenue).toBe("300000"); // 100k + 200k
    expect(result.summary.otherRevenue).toBe("200000"); // 50k + 150k
    expect(result.summary.totalRevenue).toBe("1000000"); // 500k room + 300k fb + 200k other

    const audit = await prisma.nightAudit.findUniqueOrThrow({
      where: { businessDate: BUSINESS_DATE },
    });
    expect(audit.fbRevenue.toString()).toBe("300000");
    expect(audit.otherRevenue.toString()).toBe("200000");
    expect(audit.totalRevenue.toString()).toBe("1000000");
  });

  it("Test 3: Occupancy & In-House Drift Immunity - reflects stays checked in after preview", async () => {
    const user = await createUser();
    await createHotelSettings();
    await setupStayChargeArticles();

    const roomType = await createRoomType({ baseRate: 500_000 });
    const room1 = await createRoom(roomType.id, RoomStatus.OC);
    const room2 = await createRoom(roomType.id, RoomStatus.VC);

    const guest1 = await createGuest();
    const { reservation: res1 } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest1.id,
      roomId: room1.id,
      arrivalDate: "2026-08-05",
      nightlyRates: [500_000],
      status: ReservationStatus.CHECKED_IN,
      depositStatus: DepositStatus.COLLECTED,
    });
    await createFolio(res1.id, FolioStatus.OPEN);

    // Advisory preview captures 1 in-house, 50% occupancy
    const preview = await buildNightAuditPlan({
      runById: user.id,
      now: FROZEN_NOW,
    });
    expect(preview.inHouseCount).toBe(1);
    expect(preview.metrics.roomsOccupied).toBe(1);
    expect(preview.metrics.occupancyRate).toBe("50");

    // Concurrently check in a second reservation
    const guest2 = await createGuest();
    const { reservation: res2 } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest2.id,
      roomId: room2.id,
      arrivalDate: "2026-08-05",
      nightlyRates: [400_000],
      status: ReservationStatus.CHECKED_IN,
      depositStatus: DepositStatus.COLLECTED,
    });
    await createFolio(res2.id, FolioStatus.OPEN);
    await prisma.room.update({
      where: { id: room2.id },
      data: { status: RoomStatus.OC },
    });

    // Execute audit
    const result = await executeNightAudit({
      runById: user.id,
      now: FROZEN_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.roomsCharged).toBe(2);
    expect(result.summary.roomRevenue).toBe("900000"); // 500k + 400k

    const audit = await prisma.nightAudit.findUniqueOrThrow({
      where: { businessDate: BUSINESS_DATE },
    });
    expect(audit.inHouseCount).toBe(2);
    expect(audit.roomsOccupied).toBe(2);
    expect(Number(audit.occupancyRate)).toBe(100);
  });

  it("Test 4: Idempotency & Duplicate Prevention - rejects duplicate audit with clean Indonesian copy", async () => {
    const user = await createUser();
    await createHotelSettings();
    await setupStayChargeArticles();

    const roomType = await createRoomType({ baseRate: 500_000 });
    const room = await createRoom(roomType.id, RoomStatus.OC);
    const guest = await createGuest();
    const { reservation } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      roomId: room.id,
      arrivalDate: "2026-08-05",
      nightlyRates: [500_000],
      status: ReservationStatus.CHECKED_IN,
      depositStatus: DepositStatus.COLLECTED,
    });
    const folio = await createFolio(reservation.id, FolioStatus.OPEN);

    // First execution succeeds
    const firstResult = await executeNightAudit({
      runById: user.id,
      now: FROZEN_NOW,
    });
    expect(firstResult.ok).toBe(true);

    const initialLineItemCount = await prisma.folioLineItem.count({
      where: { folioId: folio.id },
    });
    expect(initialLineItemCount).toBe(1);

    // Second execution must fail cleanly without posting extra charges
    const secondResult = await executeNightAudit({
      runById: user.id,
      now: FROZEN_NOW,
    });
    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) {
      expect(secondResult.error).toContain("sudah selesai");
    }

    const postAttemptLineItemCount = await prisma.folioLineItem.count({
      where: { folioId: folio.id },
    });
    expect(postAttemptLineItemCount).toBe(initialLineItemCount); // 0 extra charges posted

    const auditCount = await prisma.nightAudit.count({
      where: { businessDate: BUSINESS_DATE },
    });
    expect(auditCount).toBe(1);
  });

  it("Test 5: Blocker Rollback - rolls back all writes if a folio is unexpectedly CLOSED", async () => {
    const user = await createUser();
    await createHotelSettings();
    await setupStayChargeArticles();

    const roomType = await createRoomType({ baseRate: 500_000 });
    const room = await createRoom(roomType.id, RoomStatus.OC);
    const guest = await createGuest();
    const { reservation } = await createReservationFixture({
      userId: user.id,
      roomTypeId: roomType.id,
      guestId: guest.id,
      roomId: room.id,
      arrivalDate: "2026-08-05",
      nightlyRates: [500_000],
      status: ReservationStatus.CHECKED_IN,
      depositStatus: DepositStatus.COLLECTED,
    });
    // Folio is unexpectedly CLOSED
    const folio = await createFolio(reservation.id, FolioStatus.CLOSED);

    const result = await executeNightAudit({
      runById: user.id,
      now: FROZEN_NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blockingErrors).toBeDefined();
      expect(result.blockingErrors?.some((b) => b.kind === "FOLIO_NOT_OPEN")).toBe(true);
    }

    // Assert complete rollback: no line items and no NightAudit row
    const lineItemCount = await prisma.folioLineItem.count({
      where: { folioId: folio.id },
    });
    expect(lineItemCount).toBe(0);

    const auditCount = await prisma.nightAudit.count({
      where: { businessDate: BUSINESS_DATE },
    });
    expect(auditCount).toBe(0);
  });
});
