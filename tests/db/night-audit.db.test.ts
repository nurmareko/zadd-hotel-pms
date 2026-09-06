import {
  ArticleType,
  DepositStatus,
  FBOrderStatus,
  FolioStatus,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import { hotelTodayDateOnly } from "@/lib/date-only";
import {
  buildNightAuditPlan,
  executeNightAudit,
} from "@/lib/night-audit";
import { prisma } from "@/lib/prisma";
import { ROOM_CHARGE_ARTICLE_CODE } from "@/lib/stay-charges";

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
