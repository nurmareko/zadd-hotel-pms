import {
  ArticleType,
  FolioStatus,
  ReservationStatus,
  ReservationType,
  RoomStatus,
} from "@prisma/client";
import { addDays, startOfDay } from "date-fns";

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
  { number: "106", floor: 1, roomTypeCode: "STD", status: RoomStatus.VD },
  { number: "107", floor: 1, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "108", floor: 1, roomTypeCode: "STD", status: RoomStatus.OOO },
  { number: "201", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "202", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "203", floor: 2, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "204", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VD },
  { number: "205", floor: 2, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "206", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "207", floor: 2, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "208", floor: 2, roomTypeCode: "DLX", status: RoomStatus.VC },
  { number: "301", floor: 3, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "302", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "303", floor: 3, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "304", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "305", floor: 3, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "306", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
  { number: "307", floor: 3, roomTypeCode: "STD", status: RoomStatus.VD },
  { number: "308", floor: 3, roomTypeCode: "SUP", status: RoomStatus.VC },
];

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
  deposit?: number;
  notes?: string;
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
    deposit: 850000,
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
    deposit: 850000,
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
    notes: "Cancelled by guest before arrival.",
  },
];

function dateFromOffset(today: Date, offset: number) {
  const date = addDays(today, offset);
  date.setHours(12, 0, 0, 0);

  return date;
}

async function findSeedUser() {
  const foUser = await prisma.user.findUnique({ where: { username: "fo1" } });

  if (foUser) {
    return foUser;
  }

  const adminUser = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (adminUser) {
    return adminUser;
  }

  throw new Error("Run the main Prisma seed first so demo reservations have a creator.");
}

async function main() {
  try {
    const today = startOfDay(new Date());
    const createdBy = await findSeedUser();
    const roomTypesByCode = new Map<RoomTypeCode, { id: number; baseRate: unknown }>();
    const roomsByNumber = new Map<string, { id: number }>();
    const guestsByFullName = new Map<string, { id: number }>();

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
      const grcFilledAt =
        reservation.status === ReservationStatus.CHECKED_IN
          ? arrivalDate
          : null;

      const seededReservation = await prisma.reservation.upsert({
        where: { reservationNo: reservation.reservationNo },
        create: {
          reservationNo: reservation.reservationNo,
          type: ReservationType.REGULAR,
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
          purposeOfVisit:
            reservation.status === ReservationStatus.CHECKED_IN
              ? "Hospitality praktikum"
              : null,
          createdById: createdBy.id,
        },
        update: {
          type: ReservationType.REGULAR,
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
          purposeOfVisit:
            reservation.status === ReservationStatus.CHECKED_IN
              ? "Hospitality praktikum"
              : null,
          createdById: createdBy.id,
        },
      });

      if (reservation.status === ReservationStatus.CHECKED_IN) {
        if (!reservation.roomNumber) {
          throw new Error(`${reservation.reservationNo} needs an assigned room.`);
        }

        const roomSeed = rooms.find(
          (roomToFind) => roomToFind.number === reservation.roomNumber,
        );
        const checkedInRoomType = roomSeed
          ? roomTypesByCode.get(roomSeed.roomTypeCode)
          : null;

        if (!roomSeed || !checkedInRoomType) {
          throw new Error(`Missing seed data for room ${reservation.roomNumber}`);
        }

        await prisma.room.upsert({
          where: { number: reservation.roomNumber },
          create: {
            number: reservation.roomNumber,
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
      }

      if ((index + 1) % 5 === 0) {
        console.log(`✓ seeded ${index + 1} reservations...`);
      }
    }

    console.log(`✓ seeded ${reservations.length} reservations`);

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
    console.log("✓ demo seed complete");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
