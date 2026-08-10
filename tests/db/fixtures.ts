import {
  ArrangementType,
  ArticleType,
  DepositStatus,
  FolioStatus,
  PaymentMethod,
  PaymentPurpose,
  Prisma,
  ReservationNightRevenueClass,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";

import { parseISODateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

let sequence = 0;

function nextKey(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export async function resetTestDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  if (tables.length > 0) {
    const identifiers = tables
      .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
      .join(", ");
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`,
    );
  }

  sequence = 0;
  delete process.env.TEST_AUTH_USER_ID;
  delete process.env.TEST_AUTH_ROLE;
}

export async function createUser() {
  const key = nextKey("user");
  const user = await prisma.user.create({
    data: {
      username: key,
      passwordHash: "not-used-in-db-tests",
      fullName: `Test User ${sequence}`,
    },
  });

  process.env.TEST_AUTH_USER_ID = String(user.id);
  process.env.TEST_AUTH_ROLE = "FO";
  return user;
}

export async function createHotelSettings({
  serviceChargePercent = 0,
  taxPercent = 0,
  address = null,
}: {
  serviceChargePercent?: Prisma.Decimal.Value;
  taxPercent?: Prisma.Decimal.Value;
  address?: string | null;
} = {}) {
  return prisma.hotelSettings.create({
    data: {
      id: 1,
      hotelName: "Hotel Test",
      address,
      taxPercent,
      serviceChargePercent,
      nightAuditTime: "23:00",
      currency: "IDR",
    },
  });
}

export async function createRoomType({
  baseRate = 550_000,
  capacity = 4,
}: {
  baseRate?: Prisma.Decimal.Value;
  capacity?: number;
} = {}) {
  const key = nextKey("RT");
  return prisma.roomType.create({
    data: { code: key, name: `Room Type ${sequence}`, capacity, baseRate },
  });
}

export async function createRoom(
  roomTypeId: number,
  status: RoomStatus = RoomStatus.VC,
) {
  return prisma.room.create({
    data: {
      number: String(100 + sequence + 1),
      floor: 1,
      roomTypeId,
      status,
    },
  });
}

export async function createGuest() {
  return prisma.guest.create({
    data: { fullName: `Guest ${nextKey("fixture")}` },
  });
}

export async function createArticle({
  code,
  type,
  defaultPrice,
  name = code,
}: {
  code: string;
  type: ArticleType;
  defaultPrice?: Prisma.Decimal.Value | null;
  name?: string;
}) {
  return prisma.article.create({
    data: { code, name, type, defaultPrice },
  });
}

export async function createReservationFixture({
  userId,
  roomTypeId,
  guestId,
  roomId = null,
  arrivalDate = "2026-08-05",
  nightlyRates = [550_000],
  status = ReservationStatus.CONFIRMED,
  depositStatus = DepositStatus.PENDING,
  arrangementType = ArrangementType.RO,
  adults = 2,
  children = 0,
  revenueClasses,
  mealSnapshots,
  groupBookingId = null,
}: {
  userId: number;
  roomTypeId: number;
  guestId: number;
  roomId?: number | null;
  arrivalDate?: string;
  nightlyRates?: Prisma.Decimal.Value[];
  status?: ReservationStatus;
  depositStatus?: DepositStatus;
  arrangementType?: ArrangementType;
  adults?: number;
  children?: number;
  revenueClasses?: ReservationNightRevenueClass[];
  mealSnapshots?: Array<{
    mealPlan: ArrangementType | null;
    mealPax: number | null;
    mealUnitPrice: Prisma.Decimal.Value | null;
    mealAmount: Prisma.Decimal.Value | null;
  }>;
  groupBookingId?: string | null;
}) {
  const arrival = parseISODateOnly(arrivalDate);
  const departure = new Date(
    arrival.getTime() + nightlyRates.length * 86_400_000,
  );
  const reservation = await prisma.reservation.create({
    data: {
      reservationNo: nextKey("RSV"),
      guestId,
      roomTypeId,
      roomId,
      groupBookingId,
      arrivalDate: arrival,
      departureDate: departure,
      adults,
      children,
      status,
      depositStatus,
      arrangementType,
      rateAmount: nightlyRates[0] ?? 0,
      createdById: userId,
    },
  });

  const nights = [];
  for (const [index, rateAmount] of nightlyRates.entries()) {
    const meal = mealSnapshots?.[index];
    nights.push(
      await prisma.reservationNight.create({
        data: {
          reservationId: reservation.id,
          date: new Date(arrival.getTime() + index * 86_400_000),
          rateAmount,
          revenueClass:
            revenueClasses?.[index] ?? ReservationNightRevenueClass.PAID,
          mealPlan: meal?.mealPlan,
          mealPax: meal?.mealPax,
          mealUnitPrice: meal?.mealUnitPrice,
          mealAmount: meal?.mealAmount,
        },
      }),
    );
  }

  return { reservation, nights };
}

export async function createFolio(
  reservationId: number,
  status: FolioStatus = FolioStatus.OPEN,
) {
  return prisma.folio.create({
    data: {
      folioNo: nextKey("FOL"),
      reservationId,
      status,
    },
  });
}

export async function createFolioLine({
  folioId,
  articleId,
  postedById,
  amount,
  reservationNightId = null,
  quantity = 1,
  unitPrice = amount,
}: {
  folioId: number;
  articleId: number;
  postedById: number;
  amount: Prisma.Decimal.Value;
  reservationNightId?: string | null;
  quantity?: Prisma.Decimal.Value;
  unitPrice?: Prisma.Decimal.Value;
}) {
  return prisma.folioLineItem.create({
    data: {
      folioId,
      articleId,
      postedById,
      reservationNightId,
      description: "Test charge",
      quantity,
      unitPrice,
      amount,
    },
  });
}

export async function createFolioPayment({
  folioId,
  receivedById,
  amount,
  purpose = PaymentPurpose.PAYMENT,
}: {
  folioId: number;
  receivedById: number;
  amount: Prisma.Decimal.Value;
  purpose?: PaymentPurpose;
}) {
  return prisma.payment.create({
    data: {
      folioId,
      fbOrderId: null,
      receivedById,
      amount,
      method: PaymentMethod.CASH,
      purpose,
    },
  });
}
