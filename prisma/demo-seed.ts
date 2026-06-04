import {
  ArrangementType,
  ArticleType,
  FBOrderStatus,
  FolioStatus,
  NightAuditStatus,
  PaymentMethod,
  ReservationStatus,
  ReservationType,
  ReservationUsageType,
  RoomStatus,
  TableLocation,
  TableStatus,
} from "@prisma/client";
import { addDays, format, subHours, subMinutes } from "date-fns";

import { computeFolioTotals } from "@/lib/folio-totals";
import { dateOnlyBoundary, hotelTodayDateOnly } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import { getRestaurantTableGridPosition } from "@/lib/restaurant-table-layout";

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
  { code: "COFFEE", name: "Kopi Tubruk", category: "Beverage", price: 28000 },
  { code: "TEA", name: "Teh Manis", category: "Beverage", price: 22000 },
  { code: "WATER", name: "Mineral Water", category: "Beverage", price: 18000 },
  { code: "ORANGE-JUICE", name: "Orange Juice", category: "Beverage", price: 35000 },
  { code: "NASI-GORENG", name: "Nasi Goreng Spesial", category: "Mains", price: 65000 },
  { code: "MIE-GORENG", name: "Mie Goreng Seafood", category: "Mains", price: 60000 },
  { code: "SATE-AYAM", name: "Sate Ayam", category: "Mains", price: 55000 },
  { code: "SANDWICH", name: "Club Sandwich", category: "Breakfast", price: 55000 },
  { code: "OMELETTE", name: "Omelette", category: "Breakfast", price: 42000 },
  { code: "FRIES", name: "French Fries", category: "Snacks", price: 42000 },
  { code: "PISANG-GORENG", name: "Pisang Goreng", category: "Dessert", price: 30000 },
  { code: "ES-CAMPUR", name: "Es Campur", category: "Dessert", price: 36000 },
] as const;

const restaurantTables = [
  { number: "T1", capacity: 2, location: TableLocation.INDOOR, status: TableStatus.AVAILABLE },
  { number: "T2", capacity: 2, location: TableLocation.INDOOR, status: TableStatus.AVAILABLE },
  { number: "T3", capacity: 4, location: TableLocation.INDOOR, status: TableStatus.OCCUPIED },
  { number: "T4", capacity: 4, location: TableLocation.INDOOR, status: TableStatus.AVAILABLE },
  { number: "T5", capacity: 4, location: TableLocation.INDOOR, status: TableStatus.AVAILABLE },
  { number: "T6", capacity: 2, location: TableLocation.INDOOR, status: TableStatus.OUT_OF_SERVICE, notes: "Kursi perlu diganti." },
  { number: "T7", capacity: 4, location: TableLocation.OUTDOOR, status: TableStatus.AVAILABLE },
  { number: "T8", capacity: 6, location: TableLocation.OUTDOOR, status: TableStatus.RESERVED, notes: "Reserved untuk dosen tamu." },
  { number: "T9", capacity: 8, location: TableLocation.PRIVATE, status: TableStatus.AVAILABLE },
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
  housekeepingNote?: string;
  addOns?: Array<{ label: string; delivered: boolean }>;
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
    housekeepingNote: "Fresh towels only; guest prefers no strong fragrance.",
    addOns: [{ label: "Welcome fruit", delivered: true }],
  },
  {
    reservationNo: "DEMO-RSV-006",
    guestFullName: "Hendra Kusuma",
    roomTypeCode: "DLX",
    roomNumber: "202",
    arrivalOffset: -3,
    departureOffset: 0,
    adults: 1,
    status: ReservationStatus.CHECKED_IN,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.COMPANY,
    deposit: 850000,
    comment: "Company booking, billing contact follows later.",
    housekeepingNote: "Turnover priority; laptop stand left at desk is guest-owned.",
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
    arrivalOffset: 0,
    departureOffset: 4,
    adults: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
    notes: "ETA 14:30",
    housekeepingNote: "Prepare baby bed near window side and keep extra blanket ready.",
    addOns: [
      { label: "Baby bed", delivered: false },
      { label: "Welcome fruit", delivered: true },
    ],
  },
  {
    reservationNo: "DEMO-RSV-010",
    guestFullName: "Sari Indah",
    roomTypeCode: "DLX",
    roomNumber: "201",
    arrivalOffset: 0,
    departureOffset: 6,
    adults: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RB,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
    notes: "ETA 16:00",
    housekeepingNote: "VIP amenity setup before arrival; check minibar seal.",
    addOns: [
      { label: "Flower setup", delivered: false },
      { label: "Welcome fruit", delivered: false },
    ],
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

function minutesAgo(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);

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

async function findFoodBeverageUser() {
  const fbUser = await prisma.user.findUnique({ where: { username: "fb1" } });

  if (!fbUser) {
    throw new Error(
      "Run the main Prisma seed first so F&B orders can be attributed to fb1.",
    );
  }

  return fbUser;
}

async function findAccountingUser() {
  const accUser = await prisma.user.findUnique({ where: { username: "acc1" } });

  if (!accUser) {
    throw new Error(
      "Run the main Prisma seed first so night audits can be attributed to acc1.",
    );
  }

  return accUser;
}

function computeFbAmounts(
  itemSeeds: Array<{ quantity: number; unitPrice: number }>,
  hotelSettings: { serviceChargePercent: unknown; taxPercent: unknown },
) {
  const subtotal = itemSeeds.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const serviceCharge =
    subtotal * (Number(hotelSettings.serviceChargePercent) / 100);
  const tax = (subtotal + serviceCharge) * (Number(hotelSettings.taxPercent) / 100);

  return {
    subtotal: Math.round(subtotal),
    serviceCharge: Math.round(serviceCharge),
    tax: Math.round(tax),
    total: Math.round(subtotal + serviceCharge + tax),
  };
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

  function cleaningCapture(seed: number) {
    return {
      linenChanged: seed % 5 !== 0,
      towelChanged: seed % 4 !== 1,
    };
  }

  type HousekeepingLogSeed = {
    roomNumber: string;
    oldStatus: RoomStatus;
    newStatus: RoomStatus;
    note?: string | null;
    updatedAt: Date;
    cleaningStartedAt?: Date;
    cleaningCompletedAt?: Date;
    linenChanged?: boolean;
    towelChanged?: boolean;
  };

  const logSeeds: HousekeepingLogSeed[] = [
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
      newStatus: RoomStatus.VCU,
      note: "Tidak ada masalah",
      updatedAt: hoursAgo(27),
      cleaningStartedAt: hoursAgo(28),
      cleaningCompletedAt: hoursAgo(27),
      ...cleaningCapture(2),
    },
    {
      roomNumber: "102",
      oldStatus: RoomStatus.VCU,
      newStatus: RoomStatus.VD,
      note: "Lantai masih basah",
      updatedAt: minutesAgo(26 * 60 + 45),
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
      newStatus: RoomStatus.VCU,
      note: "Sudah saya bersihkan",
      updatedAt: hoursAgo(35),
      cleaningStartedAt: hoursAgo(35),
      cleaningCompletedAt: hoursAgo(34),
      ...cleaningCapture(6),
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
      note: "Minibar perlu di-restock",
      updatedAt: hoursAgo(1),
      cleaningStartedAt: hoursAgo(1),
    },
    {
      roomNumber: "205",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VCU,
      note: null,
      updatedAt: hoursAgo(48),
      cleaningStartedAt: hoursAgo(48),
      cleaningCompletedAt: hoursAgo(47),
      ...cleaningCapture(5),
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
    {
      roomNumber: "307",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VCU,
      note: "AC sedikit berisik, sudah saya laporkan",
      updatedAt: minutesAgo(30 * 60 + 30),
      cleaningStartedAt: hoursAgo(31),
      cleaningCompletedAt: minutesAgo(30 * 60 + 30),
      ...cleaningCapture(7),
    },
    {
      roomNumber: "307",
      oldStatus: RoomStatus.VCU,
      newStatus: RoomStatus.VD,
      note: "Linen belum diganti",
      updatedAt: hoursAgo(30),
    },
  ];

  const logData = logSeeds.map((log) => {
    const room = roomsByNumber.get(log.roomNumber);

    if (!room) {
      throw new Error(`Missing room ${log.roomNumber} for HK log.`);
    }

    return {
      roomId: room.id,
      oldStatus: log.oldStatus,
      newStatus: log.newStatus,
      note: log.note ?? null,
      updatedById,
      updatedAt: log.updatedAt,
      cleaningStartedAt: log.cleaningStartedAt ?? null,
      cleaningCompletedAt: log.cleaningCompletedAt ?? null,
      linenChanged: log.linenChanged ?? false,
      towelChanged: log.towelChanged ?? false,
    };
  });

  await prisma.housekeepingLog.createMany({ data: logData });

  console.log(
    `✓ seeded ${logData.length} housekeeping log entries across ${Object.keys(hkRoomStatuses).length} rooms`,
  );
}

async function seedHousekeepingListDemo({
  roomsByNumber,
  housekeeperId,
  date,
}: {
  roomsByNumber: Map<string, { id: number }>;
  housekeeperId: number;
  date: Date;
}) {
  const seededRoomIds = [...roomsByNumber.values()].map((room) => room.id);
  const assignedRoomNumbers = [
    "101",
    "103",
    "105",
    "201",
    "202",
    "204",
    "301",
    "307",
  ];

  await prisma.housekeepingAssignment.deleteMany({
    where: { date, roomId: { in: seededRoomIds } },
  });
  await prisma.cleaningSession.deleteMany({
    where: { date, roomId: { in: seededRoomIds } },
  });

  await prisma.housekeepingAssignment.createMany({
    data: assignedRoomNumbers.map((roomNumber) => {
      const room = roomsByNumber.get(roomNumber);

      if (!room) {
        throw new Error(`Missing room ${roomNumber} for HK assignment seed.`);
      }

      return {
        roomId: room.id,
        housekeeperId,
        date,
      };
    }),
  });

  const inProgressRoom = roomsByNumber.get("204");

  if (!inProgressRoom) {
    throw new Error("Missing room 204 for HK cleaning session seed.");
  }

  await prisma.cleaningSession.create({
    data: {
      roomId: inProgressRoom.id,
      housekeeperId,
      date,
      startedAt: minutesAgo(55),
      finishedAt: null,
      inspectedAt: null,
      inspectedById: null,
    },
  });

  console.log(
    `✓ seeded ${assignedRoomNumbers.length} HK list assignments and 1 open cleaning session`,
  );
}

async function main() {
  try {
    const today = hotelTodayDateOnly();
    const createdBy = await findSeedUser();
    const housekeepingUser = await findHousekeepingUser();
    const fbUser = await findFoodBeverageUser();
    const accountingUser = await findAccountingUser();
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

    for (const [index, table] of restaurantTables.entries()) {
      const layoutPosition = getRestaurantTableGridPosition(index);

      await prisma.restaurantTable.upsert({
        where: { number: table.number },
        create: { ...table, ...layoutPosition },
        update: { ...table, ...layoutPosition },
      });
    }

    console.log(`✓ seeded ${restaurantTables.length} restaurant tables`);

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
          notes: reservation.notes ?? null,
          housekeepingNote: reservation.housekeepingNote ?? null,
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
          notes: reservation.notes ?? null,
          housekeepingNote: reservation.housekeepingNote ?? null,
          grcFilledAt,
          purposeOfVisit,
          createdById: createdBy.id,
        },
      });

      await prisma.reservationAddOn.deleteMany({
        where: { reservationId: seededReservation.id },
      });

      if (reservation.addOns && reservation.addOns.length > 0) {
        await prisma.reservationAddOn.createMany({
          data: reservation.addOns.map((addOn) => ({
            reservationId: seededReservation.id,
            label: addOn.label,
            delivered: addOn.delivered,
          })),
        });
      }

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

    await seedHousekeepingListDemo({
      roomsByNumber,
      housekeeperId: housekeepingUser.id,
      date: dateOnlyBoundary(today),
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

    const seededHotelSettings = hotelSettings;
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

    const orderPrefix = `FB-${format(today, "ddMM")}-`;
    const existingDemoFbOrders = await prisma.fBOrder.findMany({
      where: { orderNo: { startsWith: orderPrefix } },
      select: { id: true },
    });
    const existingDemoFbOrderIds = existingDemoFbOrders.map((order) => order.id);

    if (existingDemoFbOrderIds.length > 0) {
      await prisma.folioLineItem.deleteMany({
        where: { fbOrderId: { in: existingDemoFbOrderIds } },
      });
      await prisma.payment.deleteMany({
        where: { fbOrderId: { in: existingDemoFbOrderIds } },
      });
      await prisma.fBOrder.deleteMany({
        where: { id: { in: existingDemoFbOrderIds } },
      });
    }

    const [seededMenuItems, seededTables, dinnerArticle, chargeToRoomFolio] =
      await Promise.all([
        prisma.menuItem.findMany(),
        prisma.restaurantTable.findMany(),
        prisma.article.findUnique({ where: { code: "DINNER" } }),
        prisma.folio.findFirst({
          where: {
            status: FolioStatus.OPEN,
            reservation: { status: ReservationStatus.CHECKED_IN },
          },
          orderBy: { id: "asc" },
        }),
      ]);

    if (!dinnerArticle) {
      throw new Error("Missing DINNER article for F&B charge-to-room seed.");
    }

    if (!chargeToRoomFolio) {
      throw new Error("Missing checked-in open folio for charge-to-room seed.");
    }

    const menuByCode = new Map(
      seededMenuItems.map((menuItem) => [menuItem.code, menuItem]),
    );
    const tableByNumber = new Map(
      seededTables.map((table) => [table.number, table]),
    );

    async function createFbOrder({
      sequence,
      status,
      tableNumber,
      guestCount,
      openedAt,
      closedAt,
      paymentMethod,
      chargedFolioId,
      items,
    }: {
      sequence: number;
      status: FBOrderStatus;
      tableNumber: string;
      guestCount: number;
      openedAt: Date;
      closedAt?: Date;
      paymentMethod?: PaymentMethod;
      chargedFolioId?: number;
      items: Array<{ code: string; quantity: number; notes?: string }>;
    }) {
      const table = tableByNumber.get(tableNumber);

      if (!table) {
        throw new Error(`Missing restaurant table ${tableNumber}.`);
      }

      const itemSeeds = items.map((item) => {
        const menuItem = menuByCode.get(item.code);

        if (!menuItem) {
          throw new Error(`Missing menu item ${item.code}.`);
        }

        const unitPrice = Number(menuItem.price);

        return {
          ...item,
          menuItemId: menuItem.id,
          unitPrice,
          amount: item.quantity * unitPrice,
        };
      });
      const amounts = computeFbAmounts(itemSeeds, seededHotelSettings);

      return prisma.fBOrder.create({
        data: {
          orderNo: `${orderPrefix}${String(sequence).padStart(4, "0")}`,
          tableNo: table.number,
          tableId: table.id,
          guestCount,
          status,
          paymentMethod,
          chargedFolioId,
          subtotal: amounts.subtotal,
          serviceCharge: amounts.serviceCharge,
          tax: amounts.tax,
          total: amounts.total,
          waitedById: fbUser.id,
          openedAt,
          closedAt: closedAt ?? null,
          items: {
            create: itemSeeds.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
              notes: item.notes ?? null,
            })),
          },
        },
      });
    }

    const openOrder = await createFbOrder({
      sequence: 1,
      status: FBOrderStatus.OPEN,
      tableNumber: "T3",
      guestCount: 4,
      openedAt: subMinutes(new Date(), 42),
      items: [
        { code: "NASI-GORENG", quantity: 2, notes: "Pedas sedang" },
        { code: "SATE-AYAM", quantity: 1 },
        { code: "TEA", quantity: 4, notes: "Less sugar" },
      ],
    });

    const cashOrder = await createFbOrder({
      sequence: 2,
      status: FBOrderStatus.CLOSED,
      tableNumber: "T2",
      guestCount: 2,
      openedAt: subHours(new Date(), 4),
      closedAt: subHours(new Date(), 3),
      paymentMethod: PaymentMethod.CASH,
      items: [
        { code: "OMELETTE", quantity: 2 },
        { code: "COFFEE", quantity: 2 },
        { code: "PISANG-GORENG", quantity: 1 },
      ],
    });

    await prisma.payment.create({
      data: {
        folioId: null,
        fbOrderId: cashOrder.id,
        amount: cashOrder.total,
        method: PaymentMethod.CASH,
        reference: "DEMO-CASH",
        receivedById: fbUser.id,
        receivedAt: cashOrder.closedAt ?? new Date(),
      },
    });

    const roomChargeOrder = await createFbOrder({
      sequence: 3,
      status: FBOrderStatus.CLOSED,
      tableNumber: "T7",
      guestCount: 3,
      openedAt: subHours(new Date(), 2),
      closedAt: subMinutes(new Date(), 75),
      paymentMethod: PaymentMethod.CHARGE_TO_ROOM,
      chargedFolioId: chargeToRoomFolio.id,
      items: [
        { code: "MIE-GORENG", quantity: 2, notes: "Tanpa seafood pedas" },
        { code: "ORANGE-JUICE", quantity: 3 },
        { code: "ES-CAMPUR", quantity: 1 },
      ],
    });

    await prisma.folioLineItem.create({
      data: {
        folioId: chargeToRoomFolio.id,
        articleId: dinnerArticle.id,
        fbOrderId: roomChargeOrder.id,
        description: `F&B charge ${roomChargeOrder.orderNo}`,
        quantity: 1,
        unitPrice: roomChargeOrder.total,
        amount: roomChargeOrder.total,
        postedById: fbUser.id,
        postedAt: roomChargeOrder.closedAt ?? new Date(),
      },
    });

    console.log(
      `✓ seeded 3 F&B orders (${openOrder.orderNo}, ${cashOrder.orderNo}, ${roomChargeOrder.orderNo})`,
    );
    console.log(
      `✓ charge-to-room linked ${roomChargeOrder.orderNo} to folio ${chargeToRoomFolio.folioNo}`,
    );

    await prisma.nightAudit.deleteMany({});

    const auditSeeds = [
      {
        offset: -1,
        roomsOccupied: 16,
        occupancyRate: 66.67,
        roomRevenue: 13600000,
        fbRevenue: 2750000,
        otherRevenue: 450000,
        checkInCount: 7,
        checkOutCount: 5,
        inHouseCount: 16,
      },
      {
        offset: -2,
        roomsOccupied: 15,
        occupancyRate: 62.5,
        roomRevenue: 11700000,
        fbRevenue: 2100000,
        otherRevenue: 325000,
        checkInCount: 6,
        checkOutCount: 6,
        inHouseCount: 15,
      },
      {
        offset: -3,
        roomsOccupied: 14,
        occupancyRate: 58.33,
        roomRevenue: 11480000,
        fbRevenue: 1850000,
        otherRevenue: 290000,
        checkInCount: 5,
        checkOutCount: 4,
        inHouseCount: 14,
      },
      {
        offset: -4,
        roomsOccupied: 13,
        occupancyRate: 54.17,
        roomRevenue: 9880000,
        fbRevenue: 1650000,
        otherRevenue: 210000,
        checkInCount: 4,
        checkOutCount: 5,
        inHouseCount: 13,
      },
    ];

    await prisma.nightAudit.createMany({
      data: auditSeeds.map((audit, index) => {
        const businessDate = dateOnlyBoundary(addDays(today, audit.offset));
        const runAt = addDays(businessDate, 1);
        runAt.setHours(1, 45 + index * 7, 0, 0);

        return {
          businessDate,
          status: NightAuditStatus.COMPLETED,
          runAt,
          runById: accountingUser.id,
          totalRooms: rooms.length,
          roomsOccupied: audit.roomsOccupied,
          occupancyRate: audit.occupancyRate,
          roomRevenue: audit.roomRevenue,
          fbRevenue: audit.fbRevenue,
          otherRevenue: audit.otherRevenue,
          totalRevenue:
            audit.roomRevenue + audit.fbRevenue + audit.otherRevenue,
          checkInCount: audit.checkInCount,
          checkOutCount: audit.checkOutCount,
          inHouseCount: audit.inHouseCount,
          createdAt: runAt,
        };
      }),
    });

    console.log(
      `✓ seeded ${auditSeeds.length} historical night audits (today left unaudited)`,
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
