import {
  ArrangementType,
  ArticleType,
  FolioStatus,
  PaymentMethod,
  ReservationStatus,
  ReservationType,
  ReservationUsageType,
  RoomStatus,
} from "@prisma/client";
import { addDays, startOfDay } from "date-fns";

import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";

const roomTypes = [
  { code: "STD", name: "Standard", capacity: 2, baseRate: 550000 },
  { code: "DLX", name: "Deluxe", capacity: 2, baseRate: 850000 },
  { code: "SUP", name: "Superior", capacity: 4, baseRate: 1250000 },
] as const;

type RoomTypeCode = (typeof roomTypes)[number]["code"];

const rooms: Array<{
  number: string;
  floor: number;
  roomTypeCode: RoomTypeCode;
  status: RoomStatus;
}> = [
  { number: "101", floor: 1, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "102", floor: 1, roomTypeCode: "STD", status: RoomStatus.VD },
  { number: "103", floor: 1, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "104", floor: 1, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "105", floor: 1, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "106", floor: 1, roomTypeCode: "STD", status: RoomStatus.VCU },
  { number: "107", floor: 1, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "108", floor: 1, roomTypeCode: "STD", status: RoomStatus.OOO },
  { number: "201", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "202", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "203", floor: 2, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "204", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VD },
  { number: "205", floor: 2, roomTypeCode: "SUP", status: RoomStatus.VCU },
  { number: "206", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "207", floor: 2, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "208", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "301", floor: 3, roomTypeCode: "STD", status: RoomStatus.OD },
  { number: "302", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "303", floor: 3, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "304", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "305", floor: 3, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "306", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "307", floor: 3, roomTypeCode: "STD", status: RoomStatus.VD },
  { number: "308", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
];

const hkRoomStatuses: Record<string, RoomStatus> = {
  "101": RoomStatus.OC,
  "102": RoomStatus.VD,
  "103": RoomStatus.OC,
  "104": RoomStatus.VC,
  "105": RoomStatus.VC,
  "106": RoomStatus.VCU,
  "107": RoomStatus.VC,
  "108": RoomStatus.OOO,
  "201": RoomStatus.VC,
  "202": RoomStatus.OC,
  "203": RoomStatus.OC,
  "204": RoomStatus.VD,
  "205": RoomStatus.VCU,
  "206": RoomStatus.VC,
  "207": RoomStatus.VC,
  "208": RoomStatus.VC,
  "301": RoomStatus.OD,
  "302": RoomStatus.VC,
  "303": RoomStatus.VC,
  "304": RoomStatus.VC,
  "305": RoomStatus.VC,
  "306": RoomStatus.VC,
  "307": RoomStatus.VD,
  "308": RoomStatus.VC,
};

const guests = [
  "Andi Pratama",
  "Siti Nuraini",
  "Budi Santoso",
  "Hendra Kusuma",
  "Lina Marlina",
  "Tomi Wijaya",
  "Sari Indah",
  "Rina Anggraini",
] as const;

const purposeOfVisitPool = ["Bisnis", "Liburan", "Keluarga", "Acara"] as const;

const articles = [
  {
    code: "ROOM-CHARGE",
    name: "Room Charge",
    type: ArticleType.ROOM,
    defaultPrice: null,
  },
  {
    code: "BREAKFAST",
    name: "Breakfast",
    type: ArticleType.FB,
    defaultPrice: 75000,
  },
  {
    code: "COFFEE-BREAK",
    name: "Coffee Break",
    type: ArticleType.FB,
    defaultPrice: 50000,
  },
  {
    code: "LUNCH",
    name: "Lunch",
    type: ArticleType.FB,
    defaultPrice: 150000,
  },
  {
    code: "DINNER",
    name: "Dinner",
    type: ArticleType.FB,
    defaultPrice: 175000,
  },
  {
    code: "LAUNDRY",
    name: "Laundry",
    type: ArticleType.MISC,
    defaultPrice: 50000,
  },
  {
    code: "MINIBAR",
    name: "Minibar",
    type: ArticleType.MISC,
    defaultPrice: 45000,
  },
  {
    code: "TAX-10",
    name: "Tax 10%",
    type: ArticleType.TAX,
    defaultPrice: null,
  },
] as const;

const menuItems = [
  { code: "COFFEE", name: "Coffee", category: "Beverage", price: 28000 },
  { code: "TEA", name: "Tea", category: "Beverage", price: 22000 },
  { code: "NASI-GORENG", name: "Nasi Goreng", category: "Main", price: 65000 },
  { code: "MIE-GORENG", name: "Mie Goreng", category: "Main", price: 60000 },
  { code: "SANDWICH", name: "Sandwich", category: "Snack", price: 55000 },
  {
    code: "FRIES",
    name: "French Fries",
    category: "Snack",
    price: 42000,
  },
  {
    code: "WATER",
    name: "Mineral Water",
    category: "Beverage",
    price: 18000,
  },
  {
    code: "ORANGE-JUICE",
    name: "Orange Juice",
    category: "Beverage",
    price: 35000,
  },
] as const;

const reservations: Array<{
  reservationNo: string;
  guestFullName: (typeof guests)[number];
  roomTypeCode: RoomTypeCode;
  roomNumber: string | null;
  arrivalOffset: number;
  departureOffset: number;
  adults: number;
  children?: number;
  status: ReservationStatus;
  arrangementType: ArrangementType;
  reservationType: ReservationType;
  deposit?: number;
  notes?: string;
  comment?: string;
}> = [
  {
    reservationNo: "DEMO-RSV-001",
    guestFullName: "Sari Indah",
    roomTypeCode: "STD",
    roomNumber: "102",
    arrivalOffset: -6,
    departureOffset: -4,
    adults: 2,
    status: ReservationStatus.CHECKED_OUT,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 550000,
  },
  {
    reservationNo: "DEMO-RSV-002",
    guestFullName: "Rina Anggraini",
    roomTypeCode: "SUP",
    roomNumber: "203",
    arrivalOffset: -5,
    departureOffset: -2,
    adults: 2,
    children: 2,
    status: ReservationStatus.CHECKED_OUT,
    arrangementType: ArrangementType.RB,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 1250000,
  },
  {
    reservationNo: "DEMO-RSV-003",
    guestFullName: "Budi Santoso",
    roomTypeCode: "DLX",
    roomNumber: "105",
    arrivalOffset: -4,
    departureOffset: -1,
    adults: 2,
    status: ReservationStatus.CHECKED_OUT,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.OTA,
    deposit: 850000,
  },
  {
    reservationNo: "DEMO-RSV-004",
    guestFullName: "Andi Pratama",
    roomTypeCode: "STD",
    roomNumber: "101",
    arrivalOffset: -2,
    departureOffset: 2,
    adults: 1,
    status: ReservationStatus.CHECKED_IN,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 550000,
  },
  {
    reservationNo: "DEMO-RSV-005",
    guestFullName: "Siti Nuraini",
    roomTypeCode: "DLX",
    roomNumber: "103",
    arrivalOffset: -1,
    departureOffset: 3,
    adults: 2,
    status: ReservationStatus.CHECKED_IN,
    arrangementType: ArrangementType.RB,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
    comment: "Late arrival requested, prepare quiet room.",
  },
  {
    reservationNo: "DEMO-RSV-006",
    guestFullName: "Hendra Kusuma",
    roomTypeCode: "DLX",
    roomNumber: "202",
    arrivalOffset: -3,
    departureOffset: 1,
    adults: 1,
    status: ReservationStatus.CHECKED_IN,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.COMPANY,
    deposit: 850000,
    comment: "Company booking, billing contact follows later.",
  },
  {
    reservationNo: "DEMO-RSV-007",
    guestFullName: "Lina Marlina",
    roomTypeCode: "SUP",
    roomNumber: "203",
    arrivalOffset: 0,
    departureOffset: 4,
    adults: 2,
    children: 1,
    status: ReservationStatus.CHECKED_IN,
    arrangementType: ArrangementType.FBM,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 1250000,
  },
  {
    reservationNo: "DEMO-RSV-008",
    guestFullName: "Tomi Wijaya",
    roomTypeCode: "STD",
    roomNumber: "301",
    arrivalOffset: -1,
    departureOffset: 5,
    adults: 1,
    status: ReservationStatus.CHECKED_IN,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 550000,
  },
  {
    reservationNo: "DEMO-RSV-009",
    guestFullName: "Budi Santoso",
    roomTypeCode: "DLX",
    roomNumber: "105",
    arrivalOffset: 1,
    departureOffset: 4,
    adults: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
  },
  {
    reservationNo: "DEMO-RSV-010",
    guestFullName: "Sari Indah",
    roomTypeCode: "DLX",
    roomNumber: "201",
    arrivalOffset: 2,
    departureOffset: 6,
    adults: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RB,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
  },
  {
    reservationNo: "DEMO-RSV-011",
    guestFullName: "Rina Anggraini",
    roomTypeCode: "DLX",
    roomNumber: "204",
    arrivalOffset: 3,
    departureOffset: 5,
    adults: 1,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
  },
  {
    reservationNo: "DEMO-RSV-012",
    guestFullName: "Andi Pratama",
    roomTypeCode: "SUP",
    roomNumber: "302",
    arrivalOffset: 5,
    departureOffset: 9,
    adults: 2,
    children: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 1250000,
  },
  {
    reservationNo: "DEMO-RSV-013",
    guestFullName: "Siti Nuraini",
    roomTypeCode: "SUP",
    roomNumber: "306",
    arrivalOffset: 7,
    departureOffset: 10,
    adults: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RB,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 1250000,
  },
  {
    reservationNo: "DEMO-RSV-014",
    guestFullName: "Hendra Kusuma",
    roomTypeCode: "SUP",
    roomNumber: "304",
    arrivalOffset: 4,
    departureOffset: 8,
    adults: 1,
    status: ReservationStatus.CANCELLED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    notes: "Cancelled by guest before arrival.",
  },
];

function dateFromOffset(today: Date, offset: number) {
  const date = addDays(today, offset);
  date.setHours(12, 0, 0, 0);

  return date;
}

function purposeOfVisitForReservation(index: number) {
  return purposeOfVisitPool[index % purposeOfVisitPool.length];
}

function hoursAgo(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() - hours);

  return date;
}

function nightAuditPostedAt(date: Date) {
  const postedAt = new Date(date);
  postedAt.setHours(23, 0, 0, 0);

  return postedAt;
}

function stayNights(arrivalDate: Date, departureDate: Date) {
  const nights: Date[] = [];

  for (
    let night = new Date(arrivalDate);
    night < departureDate;
    night = addDays(night, 1)
  ) {
    nights.push(nightAuditPostedAt(night));
  }

  return nights;
}

async function findSeedUser() {
  const foUser = await prisma.user.findUnique({ where: { username: "fo1" } });

  if (!foUser) {
    throw new Error(
      "Run the main Prisma seed first so demo data can be attributed to fo1.",
    );
  }

  return foUser;
}

async function findHousekeepingUser() {
  const hkUser = await prisma.user.findUnique({ where: { username: "hk1" } });

  if (!hkUser) {
    throw new Error(
      "Run the main Prisma seed first so housekeeping logs can be attributed to hk1.",
    );
  }

  return hkUser;
}

async function seedHousekeepingLogs({
  roomsByNumber,
  updatedById,
}: {
  roomsByNumber: Map<string, { id: number }>;
  updatedById: number;
}) {
  const seededRoomIds = [...roomsByNumber.values()].map((room) => room.id);

  await prisma.housekeepingLog.deleteMany({
    where: { roomId: { in: seededRoomIds } },
  });

  for (const [number, status] of Object.entries(hkRoomStatuses)) {
    const room = roomsByNumber.get(number);

    if (!room) {
      throw new Error(`Missing room ${number} for HK demo logs.`);
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { status },
    });
  }

  const logData = [
    {
      roomNumber: "101",
      oldStatus: RoomStatus.VC,
      newStatus: RoomStatus.OC,
      note: "Check-in tamu, kamar digunakan.",
      updatedAt: hoursAgo(44),
    },
    {
      roomNumber: "102",
      oldStatus: RoomStatus.OC,
      newStatus: RoomStatus.OD,
      note: "Tamu masih in-house, kamar perlu turn-down.",
      updatedAt: hoursAgo(62),
    },
    {
      roomNumber: "102",
      oldStatus: RoomStatus.OD,
      newStatus: RoomStatus.VD,
      note: "Check-out selesai, masuk antrean pembersihan.",
      updatedAt: hoursAgo(27),
    },
    {
      roomNumber: "103",
      oldStatus: RoomStatus.VC,
      newStatus: RoomStatus.OC,
      note: "Check-in tamu, kamar terisi.",
      updatedAt: hoursAgo(29),
    },
    {
      roomNumber: "106",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VD,
      note: "Pembersihan dimulai oleh petugas lantai 1.",
      updatedAt: hoursAgo(35),
      cleaningStartedAt: hoursAgo(35),
      cleaningCompletedAt: hoursAgo(34),
    },
    {
      roomNumber: "106",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VCU,
      note: "Kamar selesai dibersihkan, menunggu inspeksi supervisor.",
      updatedAt: hoursAgo(34),
    },
    {
      roomNumber: "108",
      oldStatus: RoomStatus.VC,
      newStatus: RoomStatus.OOO,
      note: "AC tidak dingin, menunggu engineering.",
      updatedAt: hoursAgo(51),
    },
    {
      roomNumber: "202",
      oldStatus: RoomStatus.VC,
      newStatus: RoomStatus.OC,
      note: "Check-in tamu korporat.",
      updatedAt: hoursAgo(53),
    },
    {
      roomNumber: "203",
      oldStatus: RoomStatus.VC,
      newStatus: RoomStatus.OC,
      note: "Family room terisi.",
      updatedAt: hoursAgo(19),
    },
    {
      roomNumber: "204",
      oldStatus: RoomStatus.OC,
      newStatus: RoomStatus.VD,
      note: "Check-out selesai, prioritas untuk kedatangan berikutnya.",
      updatedAt: hoursAgo(23),
    },
    {
      roomNumber: "204",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VD,
      note: "Pembersihan sedang berjalan.",
      updatedAt: hoursAgo(1),
      cleaningStartedAt: hoursAgo(1),
    },
    {
      roomNumber: "205",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VD,
      note: "Linen dan amenity diganti lengkap.",
      updatedAt: hoursAgo(48),
      cleaningStartedAt: hoursAgo(48),
      cleaningCompletedAt: hoursAgo(47),
    },
    {
      roomNumber: "205",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VCU,
      note: "Siap inspeksi sebelum dijual.",
      updatedAt: hoursAgo(47),
    },
    {
      roomNumber: "301",
      oldStatus: RoomStatus.OC,
      newStatus: RoomStatus.OD,
      note: "Tamu minta pembersihan sore, prioritas karena departure dekat.",
      updatedAt: hoursAgo(5),
    },
    {
      roomNumber: "307",
      oldStatus: RoomStatus.OC,
      newStatus: RoomStatus.VD,
      note: "Kamar kosong setelah check-out grup.",
      updatedAt: hoursAgo(31),
    },
  ].map((log) => {
    const room = roomsByNumber.get(log.roomNumber);

    if (!room) {
      throw new Error(`Missing room ${log.roomNumber} for HK log.`);
    }

    return {
      roomId: room.id,
      oldStatus: log.oldStatus,
      newStatus: log.newStatus,
      note: log.note,
      updatedById,
      updatedAt: log.updatedAt,
      cleaningStartedAt: log.cleaningStartedAt ?? null,
      cleaningCompletedAt: log.cleaningCompletedAt ?? null,
    };
  });

  await prisma.housekeepingLog.createMany({ data: logData });

  console.log(
    `✓ seeded ${logData.length} housekeeping log entries across ${Object.keys(hkRoomStatuses).length} rooms`,
  );
}

async function main() {
  try {
    const today = startOfDay(new Date());
    const createdBy = await findSeedUser();
    const housekeepingUser = await findHousekeepingUser();
    const roomTypesByCode = new Map<RoomTypeCode, { id: number; baseRate: unknown }>();
    const roomsByNumber = new Map<string, { id: number }>();
    const guestsByFullName = new Map<string, { id: number }>();
    let grcCheckedInCount = 0;
    let grcCheckedOutCount = 0;

    for (const roomType of roomTypes) {
      const seededRoomType = await prisma.roomType.upsert({
        where: { code: roomType.code },
        create: {
          code: roomType.code,
          name: roomType.name,
          capacity: roomType.capacity,
          baseRate: roomType.baseRate,
        },
        update: {
          name: roomType.name,
          capacity: roomType.capacity,
          baseRate: roomType.baseRate,
        },
      });

      roomTypesByCode.set(roomType.code, {
        id: seededRoomType.id,
        baseRate: seededRoomType.baseRate,
      });
    }

    console.log(`✓ seeded ${roomTypes.length} room types`);

    for (const room of rooms) {
      const roomType = roomTypesByCode.get(room.roomTypeCode);

      if (!roomType) {
        throw new Error(`Missing room type ${room.roomTypeCode}`);
      }

      const seededRoom = await prisma.room.upsert({
        where: { number: room.number },
        create: {
          number: room.number,
          floor: room.floor,
          roomTypeId: roomType.id,
          status: room.status,
        },
        update: {
          floor: room.floor,
          roomTypeId: roomType.id,
          status: room.status,
        },
      });

      roomsByNumber.set(room.number, { id: seededRoom.id });
    }

    console.log(`✓ seeded ${rooms.length} rooms`);

    for (const fullName of guests) {
      const existingGuest = await prisma.guest.findFirst({ where: { fullName } });
      const seededGuest = await prisma.guest.upsert({
        where: { id: existingGuest?.id ?? -1 },
        create: {
          fullName,
          nationality: "Indonesia",
        },
        update: {
          fullName,
          nationality: "Indonesia",
        },
      });

      guestsByFullName.set(fullName, { id: seededGuest.id });
    }

    console.log(`✓ seeded ${guests.length} guests`);

    for (const article of articles) {
      await prisma.article.upsert({
        where: { code: article.code },
        create: article,
        update: article,
      });
    }

    console.log(`✓ seeded ${articles.length} articles`);

    for (const menuItem of menuItems) {
      await prisma.menuItem.upsert({
        where: { code: menuItem.code },
        create: {
          ...menuItem,
          isActive: true,
        },
        update: {
          ...menuItem,
          isActive: true,
        },
      });
    }

    console.log(`✓ seeded ${menuItems.length} menu items`);

    const checkedInReservations: Array<{
      reservationNo: string;
      reservationId: number;
      arrivalDate: Date;
    }> = [];
    const checkedOutReservations: Array<{
      reservationNo: string;
      reservationId: number;
      arrivalDate: Date;
      departureDate: Date;
      rateAmount: number;
    }> = [];

    for (const [index, reservation] of reservations.entries()) {
      const guest = guestsByFullName.get(reservation.guestFullName);
      const roomType = roomTypesByCode.get(reservation.roomTypeCode);
      const room =
        reservation.roomNumber === null
          ? null
          : roomsByNumber.get(reservation.roomNumber);

      if (!guest) {
        throw new Error(`Missing guest ${reservation.guestFullName}`);
      }

      if (!roomType) {
        throw new Error(`Missing room type ${reservation.roomTypeCode}`);
      }

      if (reservation.roomNumber && !room) {
        throw new Error(`Missing room ${reservation.roomNumber}`);
      }

      const arrivalDate = dateFromOffset(today, reservation.arrivalOffset);
      const departureDate = dateFromOffset(today, reservation.departureOffset);
      const hasCompletedGrc =
        reservation.status === ReservationStatus.CHECKED_IN
          || reservation.status === ReservationStatus.CHECKED_OUT;
      const grcFilledAt = hasCompletedGrc ? arrivalDate : null;
      const purposeOfVisit = hasCompletedGrc
        ? purposeOfVisitForReservation(index)
        : null;

      const seededReservation = await prisma.reservation.upsert({
        where: { reservationNo: reservation.reservationNo },
        create: {
          reservationNo: reservation.reservationNo,
          type: ReservationUsageType.REGULAR,
          arrangementType: reservation.arrangementType,
          reservationType: reservation.reservationType,
          comment: reservation.comment ?? null,
          guestId: guest.id,
          roomTypeId: roomType.id,
          roomId: room?.id,
          arrivalDate,
          departureDate,
          adults: reservation.adults,
          children: reservation.children ?? 0,
          status: reservation.status,
          rateAmount: Number(roomType.baseRate),
          deposit: reservation.deposit ?? 0,
          notes: reservation.notes,
          grcFilledAt,
          purposeOfVisit,
          createdById: createdBy.id,
        },
        update: {
          type: ReservationUsageType.REGULAR,
          arrangementType: reservation.arrangementType,
          reservationType: reservation.reservationType,
          comment: reservation.comment ?? null,
          guestId: guest.id,
          roomTypeId: roomType.id,
          roomId: room?.id,
          arrivalDate,
          departureDate,
          adults: reservation.adults,
          children: reservation.children ?? 0,
          status: reservation.status,
          rateAmount: Number(roomType.baseRate),
          deposit: reservation.deposit ?? 0,
          notes: reservation.notes,
          grcFilledAt,
          purposeOfVisit,
          createdById: createdBy.id,
        },
      });

      if (hasCompletedGrc && !room) {
        throw new Error(`${reservation.reservationNo} needs an assigned room.`);
      }

      if (reservation.status === ReservationStatus.CHECKED_IN) {
        const roomNumber = reservation.roomNumber;

        if (!roomNumber) {
          throw new Error(`${reservation.reservationNo} needs an assigned room.`);
        }

        const roomSeed = rooms.find(
          (roomToFind) => roomToFind.number === roomNumber,
        );
        const checkedInRoomType = roomSeed
          ? roomTypesByCode.get(roomSeed.roomTypeCode)
          : null;

        if (!roomSeed || !checkedInRoomType) {
          throw new Error(`Missing seed data for room ${roomNumber}`);
        }

        await prisma.room.upsert({
          where: { number: roomNumber },
          create: {
            number: roomNumber,
            floor: roomSeed.floor,
            roomTypeId: checkedInRoomType.id,
            status: RoomStatus.OC,
          },
          update: {
            status: RoomStatus.OC,
          },
        });

        checkedInReservations.push({
          reservationNo: reservation.reservationNo,
          reservationId: seededReservation.id,
          arrivalDate,
        });
        grcCheckedInCount += 1;
      }

      if (reservation.status === ReservationStatus.CHECKED_OUT) {
        checkedOutReservations.push({
          reservationNo: reservation.reservationNo,
          reservationId: seededReservation.id,
          arrivalDate,
          departureDate,
          rateAmount: Number(roomType.baseRate),
        });
        grcCheckedOutCount += 1;
      }

      if ((index + 1) % 5 === 0) {
        console.log(`✓ seeded ${index + 1} reservations...`);
      }
    }

    console.log(`✓ seeded ${reservations.length} reservations`);
    console.log(
      `✓ populated GRC data for ${grcCheckedInCount} checked-in and ${grcCheckedOutCount} checked-out reservations`,
    );

    await seedHousekeepingLogs({
      roomsByNumber,
      updatedById: housekeepingUser.id,
    });

    for (const [index, reservation] of checkedInReservations.entries()) {
      await prisma.folio.upsert({
        where: { reservationId: reservation.reservationId },
        create: {
          folioNo: `DEMO-FOL-${String(index + 1).padStart(3, "0")}`,
          reservationId: reservation.reservationId,
          status: FolioStatus.OPEN,
          openedAt: reservation.arrivalDate,
        },
        update: {
          status: FolioStatus.OPEN,
          openedAt: reservation.arrivalDate,
          closedAt: null,
        },
      });
    }

    console.log(`✓ seeded ${checkedInReservations.length} open folios`);

    const [roomChargeArticle, hotelSettings] = await Promise.all([
      prisma.article.findUnique({ where: { code: "ROOM-CHARGE" } }),
      prisma.hotelSettings.findUnique({ where: { id: 1 } }),
    ]);

    if (!roomChargeArticle) {
      throw new Error("Missing ROOM-CHARGE article.");
    }

    if (!hotelSettings) {
      throw new Error("Run the main Prisma seed first so hotel settings exist.");
    }

    let closedFolioCount = 0;
    let closedFolioLineItemCount = 0;
    let totalMismatchCount = 0;

    for (const [index, reservation] of checkedOutReservations.entries()) {
      const folioNo = `FOL-DEMO-${String(index + 1).padStart(3, "0")}`;
      const nights = stayNights(reservation.arrivalDate, reservation.departureDate);
      const folio = await prisma.folio.upsert({
        where: { folioNo },
        create: {
          folioNo,
          reservationId: reservation.reservationId,
          status: FolioStatus.CLOSED,
          openedAt: reservation.arrivalDate,
          closedAt: reservation.departureDate,
        },
        update: {
          reservationId: reservation.reservationId,
          status: FolioStatus.CLOSED,
          openedAt: reservation.arrivalDate,
          closedAt: reservation.departureDate,
        },
      });

      await prisma.folioLineItem.deleteMany({ where: { folioId: folio.id } });
      await prisma.payment.deleteMany({ where: { folioId: folio.id } });

      await prisma.folioLineItem.createMany({
        data: nights.map((postedAt) => ({
          folioId: folio.id,
          articleId: roomChargeArticle.id,
          fbOrderId: null,
          quantity: 1,
          unitPrice: reservation.rateAmount,
          amount: reservation.rateAmount,
          description: "Room charge",
          postedById: createdBy.id,
          postedAt,
        })),
      });

      const lineItems = await prisma.folioLineItem.findMany({
        where: { folioId: folio.id },
        include: { article: true },
      });
      const totalsBeforePayment = computeFolioTotals(lineItems, [], hotelSettings);
      const expectedSubtotal = reservation.rateAmount * nights.length;

      if (Math.round(totalsBeforePayment.subtotal) !== expectedSubtotal) {
        totalMismatchCount += 1;
      }

      await prisma.payment.create({
        data: {
          folioId: folio.id,
          fbOrderId: null,
          amount: totalsBeforePayment.totalCharges,
          method: PaymentMethod.CASH,
          reference: null,
          receivedById: createdBy.id,
          receivedAt: reservation.departureDate,
        },
      });

      closedFolioCount += 1;
      closedFolioLineItemCount += lineItems.length;
    }

    console.log(
      `✓ seeded ${closedFolioCount} closed folios with ${closedFolioLineItemCount} line items`,
    );
    console.log(
      `✓ folio subtotal check: ${
        totalMismatchCount === 0 ? "all matched expected room-night totals" : `${totalMismatchCount} mismatch(es)`
      }`,
    );
    console.log("✓ demo seed complete");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
