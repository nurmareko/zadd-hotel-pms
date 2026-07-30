import {
  ArrangementType,
  ActivityAction,
  ArticleType,
  FBOrderStatus,
  FolioStatus,
  GuestIdType,
  LostFoundStatus,
  NightAuditStatus,
  PaymentMethod,
  PaymentPurpose,
  DepositStatus,
  ReservationStatus,
  ReservationType,
  ReservationUsageType,
  RoomStatus,
  TableLocation,
  TableStatus,
  type Prisma,
} from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { addDays, format, subHours, subMinutes } from "date-fns";

import { MEAL_PLAN_DEFINITIONS } from "@/lib/arrangement-inclusions";
import { computeFolioTotals } from "@/lib/folio-totals";
import { createReservationNightSchedule } from "@/lib/reservation-night-schedule";
import {
  dateOnlyBoundary,
  hotelTodayDateOnly,
  hotelTodayTimestampRange,
} from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import { getRestaurantTableGridPosition } from "@/lib/restaurant-table-layout";

const PASSWORD_COST = 10;
const FO_ACTIVITY_SEED_TAG = "fo-staff-performance-demo";

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
  { number: "103", floor: 1, roomTypeCode: "DLX", status: RoomStatus.OD },
  { number: "104", floor: 1, roomTypeCode: "STD", status: RoomStatus.VC },
  { number: "105", floor: 1, roomTypeCode: "DLX", status: RoomStatus.VD },
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
  "103": RoomStatus.OD,
  "104": RoomStatus.VC,
  "105": RoomStatus.VD,
  "106": RoomStatus.VCU,
  "107": RoomStatus.VC,
  "108": RoomStatus.OOO,
  "201": RoomStatus.VC,
  "202": RoomStatus.OC,
  "203": RoomStatus.OC,
  "204": RoomStatus.VD,
  "205": RoomStatus.VCU,
  "206": RoomStatus.VC,
  "207": RoomStatus.OC,
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
  { fullName: "Andi Pratama", idType: GuestIdType.KTP, idNumber: "3273010101900001" },
  { fullName: "Siti Nuraini", idType: GuestIdType.KTP, idNumber: "3273010202910002" },
  { fullName: "Budi Santoso", idType: GuestIdType.KTP, idNumber: "3273010303920003" },
  { fullName: "Hendra Kusuma", idType: GuestIdType.KTP, idNumber: "3273010404930004" },
  { fullName: "Lina Marlina", idType: GuestIdType.KTP, idNumber: "3273010505940005" },
  { fullName: "Tomi Wijaya", idType: GuestIdType.KTP, idNumber: "3273010606950006" },
  { fullName: "Sari Indah", idType: GuestIdType.KTP, idNumber: "3273010707960007" },
  { fullName: "Rina Anggraini", idType: GuestIdType.KTP, idNumber: "3273010808970008" },
] as const;

const purposeOfVisitPool = ["Bisnis", "Liburan", "Keluarga", "Acara"] as const;

const additionalFrontOfficeUsers = [
  {
    username: "fo2",
    fullName: "Nadia Safitri",
    password: "fo123",
  },
  {
    username: "fo3",
    fullName: "Raka Mahendra",
    password: "fo123",
  },
  {
    username: "fo4",
    fullName: "Maya Lestari",
    password: "fo123",
  },
] as const;

const articles = [
  {
    code: "ROOM-CHARGE",
    name: "Room Charge",
    type: ArticleType.ROOM,
    defaultPrice: null,
  },
  {
    code: "MEAL-BB",
    name: "Paket Makan BB",
    type: ArticleType.FB,
    defaultPrice: 50000,
  },
  {
    code: "MEAL-HB",
    name: "Paket Makan HB",
    type: ArticleType.FB,
    defaultPrice: 150000,
  },
  {
    code: "MEAL-FB",
    name: "Paket Makan FB",
    type: ArticleType.FB,
    defaultPrice: 250000,
  },
  {
    code: "FEE-EARLY-CI",
    name: "Biaya Early Check-in",
    type: ArticleType.MISC,
    defaultPrice: 100000,
  },
  {
    code: "FEE-LATE-CO",
    name: "Biaya Late Check-out",
    type: ArticleType.MISC,
    defaultPrice: 100000,
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
  guestFullName: (typeof guests)[number]["fullName"];
  roomTypeCode: RoomTypeCode;
  roomNumber: string | null;
  arrivalOffset: number;
  departureOffset: number;
  adults: number;
  children?: number;
  status: ReservationStatus;
  arrangementType: ArrangementType;
  reservationType: ReservationType;
  groupBookingId?: string;
  deposit?: number;
  notes?: string;
  seedPostedMeal?: boolean;
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
        arrangementType: ArrangementType.BB,
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
        arrangementType: ArrangementType.BB,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
    notes:
      "Late arrival, siapkan quiet room. Fresh towels saja; tamu tidak suka aroma yang kuat.",
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
    notes:
      "Company booking, kontak billing menyusul. Prioritas turnover; laptop stand di meja milik tamu.",
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
        arrangementType: ArrangementType.FB,
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
    notes:
      "ETA 14:30. Siapkan baby bed dekat jendela dan selimut tambahan.",
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
        arrangementType: ArrangementType.BB,
    reservationType: ReservationType.INDIVIDUAL,
    deposit: 850000,
    notes: "ETA 16:00. Siapkan VIP amenity sebelum arrival; cek minibar seal.",
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
        arrangementType: ArrangementType.BB,
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
    notes: "Dibatalkan oleh tamu sebelum arrival.",
  },
  {
    reservationNo: "DEMO-GRP-A-001",
    guestFullName: "Andi Pratama",
    roomTypeCode: "STD",
    roomNumber: "303",
    arrivalOffset: 11,
    departureOffset: 14,
    adults: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.COMPANY,
    groupBookingId: "DEMO-GRP-INCLUSION-ALL",
    deposit: 550000,
  },
  {
    reservationNo: "DEMO-GRP-A-002",
    guestFullName: "Siti Nuraini",
    roomTypeCode: "SUP",
    roomNumber: "304",
    arrivalOffset: 11,
    departureOffset: 14,
    adults: 2,
    children: 1,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.COMPANY,
    groupBookingId: "DEMO-GRP-INCLUSION-ALL",
    deposit: 1250000,
  },
  {
    reservationNo: "DEMO-GRP-A-003",
    guestFullName: "Budi Santoso",
    roomTypeCode: "STD",
    roomNumber: "305",
    arrivalOffset: 11,
    departureOffset: 14,
    adults: 1,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.HB,
    reservationType: ReservationType.COMPANY,
    groupBookingId: "DEMO-GRP-INCLUSION-ALL",
    deposit: 550000,
  },
  {
    reservationNo: "DEMO-GRP-B-001",
    guestFullName: "Hendra Kusuma",
    roomTypeCode: "DLX",
    roomNumber: "206",
    arrivalOffset: 0,
    departureOffset: 3,
    adults: 2,
    status: ReservationStatus.CONFIRMED,
    arrangementType: ArrangementType.RO,
    reservationType: ReservationType.COMPANY,
    groupBookingId: "DEMO-GRP-INCLUSION-MIXED",
    deposit: 850000,
  },
  {
    reservationNo: "DEMO-GRP-B-002",
    guestFullName: "Lina Marlina",
    roomTypeCode: "SUP",
    roomNumber: "207",
    arrivalOffset: -1,
    departureOffset: 3,
    adults: 2,
    children: 1,
    status: ReservationStatus.CHECKED_IN,
    arrangementType: ArrangementType.HB,
    reservationType: ReservationType.COMPANY,
    groupBookingId: "DEMO-GRP-INCLUSION-MIXED",
    deposit: 1250000,
    seedPostedMeal: true,
  },
  {
    reservationNo: "DEMO-GRP-B-003",
    guestFullName: "Tomi Wijaya",
    roomTypeCode: "DLX",
    roomNumber: "208",
    arrivalOffset: 0,
    departureOffset: 3,
    adults: 2,
    status: ReservationStatus.CANCELLED,
    arrangementType: ArrangementType.FB,
    reservationType: ReservationType.COMPANY,
    groupBookingId: "DEMO-GRP-INCLUSION-MIXED",
    notes: "Dibatalkan untuk fixture status campuran booking grup.",
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

function activityTimestamp(todayStart: Date, dayOffset: number, hour: number, minute = 0) {
  const businessDayStart = addDays(todayStart, dayOffset);

  return new Date(
    businessDayStart.getTime() + (hour * 60 + minute) * 60 * 1000,
  );
}

async function getDemoPasswordHash(username: string, password: string) {
  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { passwordHash: true },
  });

  if (existingUser) {
    const passwordMatches = await compare(password, existingUser.passwordHash);

    if (passwordMatches) {
      return existingUser.passwordHash;
    }
  }

  return hash(password, PASSWORD_COST);
}

async function seedAdditionalFrontOfficeUsers() {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "FO" } });

  for (const userToSeed of additionalFrontOfficeUsers) {
    const passwordHash = await getDemoPasswordHash(
      userToSeed.username,
      userToSeed.password,
    );

    const user = await prisma.user.upsert({
      where: { username: userToSeed.username },
      create: {
        username: userToSeed.username,
        fullName: userToSeed.fullName,
        passwordHash,
        isActive: true,
        isSupervisor: false,
      },
      update: {
        fullName: userToSeed.fullName,
        passwordHash,
        isActive: true,
        isSupervisor: false,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      create: {
        userId: user.id,
        roleId: role.id,
      },
      update: {},
    });
  }

  const foUsers = await prisma.user.findMany({
    where: {
      username: {
        in: ["fo1", ...additionalFrontOfficeUsers.map((user) => user.username)],
      },
    },
    orderBy: { username: "asc" },
    select: { id: true, username: true, fullName: true },
  });

  console.log(
    `✓ seeded ${additionalFrontOfficeUsers.length} additional FO demo users (${foUsers
      .map((user) => user.username)
      .join(", ")})`,
  );

  return foUsers;
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

async function findSecondHousekeepingUser() {
  const hkUser = await prisma.user.findUnique({ where: { username: "hk2" } });

  if (!hkUser) {
    throw new Error(
      "Run the main Prisma seed first so floor-1 assignments can be attributed to hk2.",
    );
  }

  return hkUser;
}

async function findHousekeepingSupervisor() {
  const hkSupervisor = await prisma.user.findUnique({
    where: { username: "hksup" },
  });

  if (!hkSupervisor) {
    throw new Error(
      "Run the main Prisma seed first so inspection audits can be attributed to hksup.",
    );
  }

  return hkSupervisor;
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
  inspectedById,
}: {
  roomsByNumber: Map<string, { id: number }>;
  updatedById: number;
  inspectedById: number;
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

  type HousekeepingLogSeed = {
    roomNumber: string;
    oldStatus: RoomStatus;
    newStatus: RoomStatus;
    note?: string | null;
    updatedAt: Date;
    updatedById?: number;
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
    },
    {
      roomNumber: "102",
      oldStatus: RoomStatus.VCU,
      newStatus: RoomStatus.VD,
      note: "Lantai masih basah",
      updatedAt: minutesAgo(26 * 60 + 45),
      updatedById: inspectedById,
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
      roomNumber: "205",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VCU,
      note: null,
      updatedAt: hoursAgo(48),
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
    },
    {
      roomNumber: "307",
      oldStatus: RoomStatus.VCU,
      newStatus: RoomStatus.VD,
      note: "Linen belum diganti",
      updatedAt: hoursAgo(30),
      updatedById: inspectedById,
    },
    {
      roomNumber: "201",
      oldStatus: RoomStatus.VD,
      newStatus: RoomStatus.VCU,
      note: "Turnover selesai untuk arrival VIP.",
      updatedAt: minutesAgo(270),
    },
    {
      roomNumber: "201",
      oldStatus: RoomStatus.VCU,
      newStatus: RoomStatus.VC,
      note: "Lulus inspeksi.",
      updatedAt: hoursAgo(4),
      updatedById: inspectedById,
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
      updatedById: log.updatedById ?? updatedById,
      updatedAt: log.updatedAt,
    };
  });

  await prisma.housekeepingLog.createMany({ data: logData });

  console.log(
    `✓ seeded ${logData.length} housekeeping log entries across ${Object.keys(hkRoomStatuses).length} rooms`,
  );
}

async function seedHousekeepingListDemo({
  roomsByNumber,
  primaryHousekeeperId,
  secondaryHousekeeperId,
  inspectedById,
  date,
}: {
  roomsByNumber: Map<string, { id: number }>;
  primaryHousekeeperId: number;
  secondaryHousekeeperId: number;
  inspectedById: number;
  date: Date;
}) {
  const seededRoomIds = [...roomsByNumber.values()].map((room) => room.id);
  // hk2 owns the floor-1 worklist (a VD turnover, an OD stayover, plus already
  // clean / awaiting-inspection rooms) so the housekeeper "My Rooms" view has a
  // room in each priority group; hk1 keeps the upper floors.
  const assignmentsByHousekeeper: Array<{
    housekeeperId: number;
    roomNumbers: string[];
  }> = [
    {
      housekeeperId: secondaryHousekeeperId,
      roomNumbers: ["101", "102", "103", "105", "106"],
    },
    {
      housekeeperId: primaryHousekeeperId,
      roomNumbers: ["201", "202", "204", "205", "301", "307"],
    },
  ];

  await prisma.housekeepingAssignment.deleteMany({
    where: { date, roomId: { in: seededRoomIds } },
  });
  await prisma.cleaningSession.deleteMany({
    where: { date, roomId: { in: seededRoomIds } },
  });

  await prisma.housekeepingAssignment.createMany({
    data: assignmentsByHousekeeper.flatMap(({ housekeeperId, roomNumbers }) =>
      roomNumbers.map((roomNumber) => {
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
    ),
  });

  function roomIdForSession(roomNumber: string) {
    const room = roomsByNumber.get(roomNumber);

    if (!room) {
      throw new Error(`Missing room ${roomNumber} for HK cleaning session seed.`);
    }

    return room.id;
  }

  await prisma.cleaningSession.createMany({
    data: [
      {
        roomId: roomIdForSession("204"),
        housekeeperId: primaryHousekeeperId,
        date,
        startedAt: minutesAgo(55),
        finishedAt: null,
        inspectedAt: null,
        inspectedById: null,
      },
      {
        roomId: roomIdForSession("106"),
        housekeeperId: secondaryHousekeeperId,
        date,
        startedAt: hoursAgo(35),
        finishedAt: hoursAgo(34),
        inspectedAt: null,
        inspectedById: null,
      },
      {
        roomId: roomIdForSession("205"),
        housekeeperId: primaryHousekeeperId,
        date,
        startedAt: hoursAgo(48),
        finishedAt: hoursAgo(47),
        inspectedAt: null,
        inspectedById: null,
      },
      {
        roomId: roomIdForSession("201"),
        housekeeperId: primaryHousekeeperId,
        date,
        startedAt: hoursAgo(5),
        finishedAt: minutesAgo(270),
        inspectedAt: hoursAgo(4),
        inspectedById,
      },
      {
        roomId: roomIdForSession("102"),
        housekeeperId: secondaryHousekeeperId,
        date,
        startedAt: hoursAgo(28),
        finishedAt: hoursAgo(27),
        inspectedAt: minutesAgo(26 * 60 + 45),
        inspectedById,
      },
      {
        roomId: roomIdForSession("307"),
        housekeeperId: primaryHousekeeperId,
        date,
        startedAt: hoursAgo(31),
        finishedAt: minutesAgo(30 * 60 + 30),
        inspectedAt: hoursAgo(30),
        inspectedById,
      },
    ],
  });

  const assignmentCount = assignmentsByHousekeeper.reduce(
    (total, group) => total + group.roomNumbers.length,
    0,
  );

  console.log(
    `✓ seeded ${assignmentCount} HK list assignments and cleaning sessions`,
  );
}

async function seedLostFoundItems({
  roomsByNumber,
  housekeepingUserId,
  secondHousekeepingUserId,
  frontOfficeUserId,
}: {
  roomsByNumber: Map<string, { id: number }>;
  housekeepingUserId: number;
  secondHousekeepingUserId: number;
  frontOfficeUserId: number;
}) {
  await prisma.lostFoundItem.deleteMany({});

  function roomId(roomNumber: string) {
    const room = roomsByNumber.get(roomNumber);

    if (!room) {
      throw new Error(`Missing room ${roomNumber} for Lost & Found seed.`);
    }

    return room.id;
  }

  await prisma.lostFoundItem.createMany({
    data: [
      {
        roomId: roomId("102"),
        description: "Phone charger hitam tertinggal di samping tempat tidur",
        foundById: secondHousekeepingUserId,
        status: LostFoundStatus.UNCLAIMED,
        createdAt: minutesAgo(90),
      },
      {
        roomId: roomId("301"),
        description: "Jaket denim biru tertinggal di lemari pakaian",
        foundById: housekeepingUserId,
        status: LostFoundStatus.UNCLAIMED,
        createdAt: hoursAgo(5),
      },
      {
        roomId: null,
        description: "Botol minum silver ditemukan di area duduk lobby",
        foundById: frontOfficeUserId,
        status: LostFoundStatus.RETURNED,
        returnedAt: minutesAgo(25),
        resolution: "Dikembalikan ke tamu setelah konfirmasi ID di front desk",
        createdAt: hoursAgo(6),
      },
    ],
  });

  console.log("✓ seeded 3 lost & found items");
}

type FrontOfficeUserSeed = Awaited<
  ReturnType<typeof seedAdditionalFrontOfficeUsers>
>[number];

type DemoActivitySeed = {
  username: string;
  action: ActivityAction;
  dayOffset: number;
  hour: number;
  minute?: number;
  reservationNo: string;
  amount?: number;
  method?: PaymentMethod;
  article?: string;
  note?: string;
};

async function seedFrontOfficeActivityLogs({
  frontOfficeUsers,
  todayStart,
}: {
  frontOfficeUsers: FrontOfficeUserSeed[];
  todayStart: Date;
}) {
  const usersByUsername = new Map(
    frontOfficeUsers.map((user) => [user.username, user]),
  );
  const seededReservations = await prisma.reservation.findMany({
    where: {
      reservationNo: { in: reservations.map((reservation) => reservation.reservationNo) },
    },
    select: {
      id: true,
      reservationNo: true,
      roomId: true,
      folio: { select: { id: true, folioNo: true } },
    },
  });
  const reservationsByNo = new Map(
    seededReservations.map((reservation) => [reservation.reservationNo, reservation]),
  );

  const activitySeeds: DemoActivitySeed[] = [
    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: 0, hour: 8, minute: 20, reservationNo: "DEMO-RSV-007", note: "Early family arrival" },
    { username: "fo1", action: ActivityAction.PAYMENT_RECORDED, dayOffset: 0, hour: 9, minute: 5, reservationNo: "DEMO-RSV-004", amount: 550000, method: PaymentMethod.CARD },
    { username: "fo1", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: 0, hour: 10, minute: 40, reservationNo: "DEMO-RSV-008", amount: 45000, article: "MINIBAR" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: 0, hour: 11, minute: 15, reservationNo: "DEMO-RSV-010", note: "Phone booking, VIP amenity requested" },
    { username: "fo2", action: ActivityAction.PAYMENT_RECORDED, dayOffset: 0, hour: 12, minute: 35, reservationNo: "DEMO-RSV-010", amount: 425000, method: PaymentMethod.TRANSFER },
    { username: "fo3", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: 0, hour: 14, minute: 10, reservationNo: "DEMO-RSV-008", note: "Walk-in single guest" },
    { username: "fo4", action: ActivityAction.CHECK_OUT_COMPLETED, dayOffset: 0, hour: 16, minute: 45, reservationNo: "DEMO-RSV-006", note: "Corporate guest late checkout" },
    { username: "fo4", action: ActivityAction.PAYMENT_RECORDED, dayOffset: 0, hour: 17, minute: 5, reservationNo: "DEMO-RSV-006", amount: 935000, method: PaymentMethod.CASH },

    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -1, hour: 7, minute: 50, reservationNo: "DEMO-RSV-004" },
    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -1, hour: 10, minute: 25, reservationNo: "DEMO-RSV-005" },
    { username: "fo1", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -1, hour: 13, minute: 35, reservationNo: "DEMO-RSV-004", amount: 75000, article: "BREAKFAST" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -1, hour: 9, minute: 10, reservationNo: "DEMO-RSV-011" },
    { username: "fo2", action: ActivityAction.RESERVATION_UPDATED, dayOffset: -1, hour: 15, minute: 20, reservationNo: "DEMO-RSV-011", note: "Adjusted ETA and room preference" },
    { username: "fo3", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -1, hour: 18, minute: 30, reservationNo: "DEMO-RSV-003", amount: 850000, method: PaymentMethod.TRANSFER },
    { username: "fo4", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -1, hour: 19, minute: 5, reservationNo: "DEMO-RSV-005", amount: 50000, article: "LAUNDRY" },

    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -2, hour: 8, minute: 45, reservationNo: "DEMO-RSV-006" },
    { username: "fo1", action: ActivityAction.CHECK_OUT_COMPLETED, dayOffset: -2, hour: 11, minute: 25, reservationNo: "DEMO-RSV-002" },
    { username: "fo1", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -2, hour: 11, minute: 40, reservationNo: "DEMO-RSV-002", amount: 4312500, method: PaymentMethod.CARD },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -2, hour: 12, minute: 10, reservationNo: "DEMO-RSV-012" },
    { username: "fo2", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -2, hour: 20, minute: 15, reservationNo: "DEMO-RSV-006", amount: 175000, article: "DINNER" },
    { username: "fo4", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -2, hour: 15, minute: 30, reservationNo: "DEMO-RSV-006" },

    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -3, hour: 8, minute: 5, reservationNo: "DEMO-RSV-004" },
    { username: "fo1", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -3, hour: 16, minute: 10, reservationNo: "DEMO-RSV-004", amount: 45000, article: "MINIBAR" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -3, hour: 10, minute: 45, reservationNo: "DEMO-RSV-013" },
    { username: "fo2", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -3, hour: 13, minute: 15, reservationNo: "DEMO-RSV-013", amount: 625000, method: PaymentMethod.TRANSFER },
    { username: "fo3", action: ActivityAction.RESERVATION_CREATED, dayOffset: -3, hour: 14, minute: 35, reservationNo: "DEMO-RSV-009" },

    { username: "fo1", action: ActivityAction.CHECK_OUT_COMPLETED, dayOffset: -4, hour: 10, minute: 50, reservationNo: "DEMO-RSV-001" },
    { username: "fo1", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -4, hour: 11, minute: 5, reservationNo: "DEMO-RSV-001", amount: 1265000, method: PaymentMethod.CASH },
    { username: "fo2", action: ActivityAction.RESERVATION_CANCELLED, dayOffset: -4, hour: 16, minute: 20, reservationNo: "DEMO-RSV-014", note: "Guest cancelled before arrival" },
    { username: "fo4", action: ActivityAction.RESERVATION_CREATED, dayOffset: -4, hour: 17, minute: 10, reservationNo: "DEMO-RSV-010" },

    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -5, hour: 9, minute: 20, reservationNo: "DEMO-RSV-002" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -5, hour: 13, minute: 55, reservationNo: "DEMO-RSV-009" },
    { username: "fo3", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -5, hour: 18, minute: 45, reservationNo: "DEMO-RSV-002", amount: 150000, article: "LUNCH" },
    { username: "fo4", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -5, hour: 19, minute: 10, reservationNo: "DEMO-RSV-002", amount: 1250000, method: PaymentMethod.CARD },

    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -6, hour: 8, minute: 35, reservationNo: "DEMO-RSV-001" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -6, hour: 11, minute: 25, reservationNo: "DEMO-RSV-012" },
    { username: "fo3", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -6, hour: 15, minute: 40, reservationNo: "DEMO-RSV-001", amount: 550000, method: PaymentMethod.TRANSFER },

    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -9, hour: 8, minute: 15, reservationNo: "DEMO-RSV-004" },
    { username: "fo1", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -10, hour: 12, minute: 5, reservationNo: "DEMO-RSV-004", amount: 275000, method: PaymentMethod.CASH },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -11, hour: 10, minute: 30, reservationNo: "DEMO-RSV-011" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -13, hour: 14, minute: 45, reservationNo: "DEMO-RSV-012" },
    { username: "fo3", action: ActivityAction.CHECK_OUT_COMPLETED, dayOffset: -14, hour: 10, minute: 10, reservationNo: "DEMO-RSV-003" },
    { username: "fo4", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -15, hour: 18, minute: 25, reservationNo: "DEMO-RSV-005", amount: 75000, article: "BREAKFAST" },
    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -17, hour: 9, minute: 5, reservationNo: "DEMO-RSV-005" },
    { username: "fo2", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -18, hour: 15, minute: 55, reservationNo: "DEMO-RSV-011", amount: 850000, method: PaymentMethod.TRANSFER },
    { username: "fo3", action: ActivityAction.RESERVATION_CREATED, dayOffset: -21, hour: 11, minute: 40, reservationNo: "DEMO-RSV-013" },
    { username: "fo4", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -23, hour: 13, minute: 10, reservationNo: "DEMO-RSV-008" },
    { username: "fo1", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -25, hour: 20, minute: 5, reservationNo: "DEMO-RSV-004", amount: 50000, article: "LAUNDRY" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -28, hour: 9, minute: 50, reservationNo: "DEMO-RSV-010" },

    { username: "fo1", action: ActivityAction.CHECK_IN_COMPLETED, dayOffset: -36, hour: 8, minute: 55, reservationNo: "DEMO-RSV-001" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -39, hour: 10, minute: 20, reservationNo: "DEMO-RSV-009" },
    { username: "fo4", action: ActivityAction.PAYMENT_RECORDED, dayOffset: -42, hour: 16, minute: 35, reservationNo: "DEMO-RSV-003", amount: 1700000, method: PaymentMethod.CARD },
    { username: "fo1", action: ActivityAction.CHECK_OUT_COMPLETED, dayOffset: -48, hour: 11, minute: 15, reservationNo: "DEMO-RSV-002" },
    { username: "fo3", action: ActivityAction.FOLIO_CHARGE_POSTED, dayOffset: -52, hour: 19, minute: 45, reservationNo: "DEMO-RSV-002", amount: 175000, article: "DINNER" },
    { username: "fo2", action: ActivityAction.RESERVATION_CREATED, dayOffset: -58, hour: 12, minute: 25, reservationNo: "DEMO-RSV-012" },
  ];

  await prisma.activityLog.deleteMany({
    where: {
      metadata: {
        path: ["seed"],
        equals: FO_ACTIVITY_SEED_TAG,
      },
    },
  });

  const activityData = activitySeeds.map((seed) => {
    const user = usersByUsername.get(seed.username);
    const reservation = reservationsByNo.get(seed.reservationNo);

    if (!user) {
      throw new Error(`Missing FO user ${seed.username} for activity seed.`);
    }

    if (!reservation) {
      throw new Error(`Missing reservation ${seed.reservationNo} for activity seed.`);
    }

    const metadata = {
      seed: FO_ACTIVITY_SEED_TAG,
      reservationNo: seed.reservationNo,
      ...(seed.amount !== undefined ? { amount: seed.amount } : {}),
      ...(seed.method !== undefined ? { method: seed.method } : {}),
      ...(seed.article !== undefined ? { article: seed.article } : {}),
      ...(seed.note !== undefined ? { note: seed.note } : {}),
    } satisfies Prisma.InputJsonObject;

    return {
      userId: user.id,
      action: seed.action,
      createdAt: activityTimestamp(
        todayStart,
        seed.dayOffset,
        seed.hour,
        seed.minute,
      ),
      reservationId: reservation.id,
      folioId: reservation.folio?.id ?? null,
      roomId: reservation.roomId,
      metadata,
    };
  });

  await prisma.activityLog.createMany({ data: activityData });

  const perStaff = activitySeeds.reduce<Record<string, number>>((counts, seed) => {
    counts[seed.username] = (counts[seed.username] ?? 0) + 1;
    return counts;
  }, {});
  const oldest = activityData
    .map((activity) => activity.createdAt)
    .sort((first, second) => first.getTime() - second.getTime())[0];
  const newest = activityData
    .map((activity) => activity.createdAt)
    .sort((first, second) => second.getTime() - first.getTime())[0];

  console.log(
    `✓ seeded ${activityData.length} FO ActivityLog rows (${Object.entries(perStaff)
      .map(([username, count]) => `${username}: ${count}`)
      .join(", ")})`,
  );
  console.log(
    `✓ FO ActivityLog time spread ${oldest.toISOString()} -> ${newest.toISOString()}`,
  );
}

async function main() {
  try {
    const today = hotelTodayDateOnly();
    const { start: todayTimestampStart } = hotelTodayTimestampRange();
    const createdBy = await findSeedUser();
    const frontOfficeUsers = await seedAdditionalFrontOfficeUsers();
    const housekeepingUser = await findHousekeepingUser();
    const secondHousekeepingUser = await findSecondHousekeepingUser();
    const housekeepingSupervisor = await findHousekeepingSupervisor();
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

    for (const guest of guests) {
      const existingGuest = await prisma.guest.findFirst({
        where: { fullName: guest.fullName },
      });
      const seededGuest = await prisma.guest.upsert({
        where: { id: existingGuest?.id ?? -1 },
        create: {
          ...guest,
          nationality: "Indonesia",
        },
        update: {
          ...guest,
          nationality: "Indonesia",
        },
      });

      guestsByFullName.set(guest.fullName, { id: seededGuest.id });
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
      deposit: number;
      postedMealPlan: ArrangementType | null;
    }> = [];
    const checkedOutReservations: Array<{
      reservationNo: string;
      reservationId: number;
      arrivalDate: Date;
      departureDate: Date;
      rateAmount: number;
      deposit: number;
    }> = [];
    let mealSnapshotBackfilledNightCount = 0;
    let mealSnapshotBackfilledReservationCount = 0;

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
          guestId: guest.id,
          roomTypeId: roomType.id,
          roomId: room?.id,
          groupBookingId: reservation.groupBookingId ?? null,
          arrivalDate,
          departureDate,
          adults: reservation.adults,
          children: reservation.children ?? 0,
          status: reservation.status,
          rateAmount: Number(roomType.baseRate),
          deposit: reservation.deposit ?? 0,
          depositStatus: hasCompletedGrc
            ? DepositStatus.COLLECTED
            : DepositStatus.PENDING,
          notes: reservation.notes ?? null,
          grcFilledAt,
          purposeOfVisit,
          createdById: createdBy.id,
        },
        update: {
          type: ReservationUsageType.REGULAR,
          arrangementType: reservation.arrangementType,
          reservationType: reservation.reservationType,
          guestId: guest.id,
          roomTypeId: roomType.id,
          roomId: room?.id,
          groupBookingId: reservation.groupBookingId ?? null,
          arrivalDate,
          departureDate,
          adults: reservation.adults,
          children: reservation.children ?? 0,
          status: reservation.status,
          rateAmount: Number(roomType.baseRate),
          deposit: reservation.deposit ?? 0,
          depositStatus: hasCompletedGrc
            ? DepositStatus.COLLECTED
            : DepositStatus.PENDING,
          notes: reservation.notes ?? null,
          grcFilledAt,
          purposeOfVisit,
          createdById: createdBy.id,
        },
      });

      // Demo reservations are a deterministic fixture. Regenerate their local
      // schedule after the upsert so repeated db:demo runs cannot leave nights
      // at a prior fixture date or rate. Meal snapshots intentionally backfill
      // only the current/future unelapsed fixture nights.
      const reservationNightSchedule = createReservationNightSchedule({
        reservationId: seededReservation.id,
        arrivalDate,
        departureDate,
        rateAmount: seededReservation.rateAmount,
        mealSnapshot: {
          arrangementType: reservation.arrangementType,
          mealPax: reservation.adults + (reservation.children ?? 0),
          fromDate: dateOnlyBoundary(today),
        },
      });
      const snapshottedMealNights = reservationNightSchedule.filter(
        (night) => night.mealPlan !== null && night.mealPlan !== undefined,
      ).length;

      mealSnapshotBackfilledNightCount += snapshottedMealNights;
      if (snapshottedMealNights > 0) {
        mealSnapshotBackfilledReservationCount += 1;
      }

      await prisma.$transaction(async (tx) => {
        await tx.reservationStayFee.deleteMany({
          where: { reservationId: seededReservation.id },
        });
        await tx.folioLineItem.deleteMany({
          where: {
            folio: { reservationId: seededReservation.id },
            OR: [
              { reservationNight: { reservationId: seededReservation.id } },
              {
                article: {
                  code: { in: ["FEE-EARLY-CI", "FEE-LATE-CO"] },
                },
              },
            ],
          },
        });
        const scheduledDates = reservationNightSchedule.map(
          (night) => new Date(night.date),
        );
        await tx.reservationNight.deleteMany({
          where: {
            reservationId: seededReservation.id,
            date: { notIn: scheduledDates },
          },
        });

        for (const night of reservationNightSchedule) {
          await tx.reservationNight.upsert({
            where: {
              reservationId_date: {
                reservationId: seededReservation.id,
                date: night.date,
              },
            },
            create: night,
            update: {
              rateAmount: night.rateAmount,
              mealPlan: night.mealPlan ?? null,
              mealPax: night.mealPax ?? null,
              mealUnitPrice: night.mealUnitPrice ?? null,
              mealAmount: night.mealAmount ?? null,
              revenueClass: night.revenueClass,
              sourcePricingRuleId: night.sourcePricingRuleId ?? null,
            },
          });
        }
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
          deposit: reservation.deposit ?? 0,
          postedMealPlan: reservation.seedPostedMeal
            ? reservation.arrangementType
            : null,
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
          deposit: reservation.deposit ?? 0,
        });
        grcCheckedOutCount += 1;
      }

      if ((index + 1) % 5 === 0) {
        console.log(`✓ seeded ${index + 1} reservations...`);
      }
    }

    console.log(`✓ seeded ${reservations.length} reservations`);
    console.log(
      `✓ backfilled ${mealSnapshotBackfilledNightCount} future meal-night snapshots across ${mealSnapshotBackfilledReservationCount} demo reservations`,
    );
    console.log(
      `✓ populated GRC data for ${grcCheckedInCount} checked-in and ${grcCheckedOutCount} checked-out reservations`,
    );

    await seedHousekeepingLogs({
      roomsByNumber,
      updatedById: housekeepingUser.id,
      inspectedById: housekeepingSupervisor.id,
    });

    await seedHousekeepingListDemo({
      roomsByNumber,
      primaryHousekeeperId: housekeepingUser.id,
      secondaryHousekeeperId: secondHousekeepingUser.id,
      inspectedById: housekeepingSupervisor.id,
      date: dateOnlyBoundary(today),
    });

    await seedLostFoundItems({
      roomsByNumber,
      housekeepingUserId: housekeepingUser.id,
      secondHousekeepingUserId: secondHousekeepingUser.id,
      frontOfficeUserId: createdBy.id,
    });

    let postedGroupMealLineCount = 0;

    for (const [index, reservation] of checkedInReservations.entries()) {
      const folio = await prisma.folio.upsert({
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

      await prisma.payment.deleteMany({ where: { folioId: folio.id } });
      await prisma.payment.create({
        data: {
          folioId: folio.id,
          fbOrderId: null,
          amount: reservation.deposit,
          method: PaymentMethod.CASH,
          purpose: PaymentPurpose.DEPOSIT,
          reference: null,
          receivedById: createdBy.id,
          receivedAt: reservation.arrivalDate,
        },
      });

      if (reservation.postedMealPlan) {
        const mealDefinition = MEAL_PLAN_DEFINITIONS[reservation.postedMealPlan];
        const currentNight = await prisma.reservationNight.findFirst({
          where: {
            reservationId: reservation.reservationId,
            date: dateOnlyBoundary(today),
          },
          select: {
            id: true,
            mealPax: true,
            mealUnitPrice: true,
            mealAmount: true,
          },
        });

        if (!mealDefinition || !currentNight?.mealPax
          || !currentNight.mealUnitPrice || !currentNight.mealAmount) {
          throw new Error(
            `Missing current meal snapshot for ${reservation.reservationNo}.`,
          );
        }

        const mealArticle = await prisma.article.findUnique({
          where: { code: mealDefinition.articleCode },
        });

        if (!mealArticle) {
          throw new Error(`Missing ${mealDefinition.articleCode} article.`);
        }

        await prisma.folioLineItem.upsert({
          where: {
            reservationNightId_articleId: {
              reservationNightId: currentNight.id,
              articleId: mealArticle.id,
            },
          },
          create: {
            folioId: folio.id,
            articleId: mealArticle.id,
            fbOrderId: null,
            reservationNightId: currentNight.id,
            description: `Inklusi demo grup ${reservation.postedMealPlan}`,
            quantity: currentNight.mealPax,
            unitPrice: currentNight.mealUnitPrice,
            amount: currentNight.mealAmount,
            postedById: accountingUser.id,
            postedAt: todayTimestampStart,
          },
          update: {
            folioId: folio.id,
            fbOrderId: null,
            description: `Inklusi demo grup ${reservation.postedMealPlan}`,
            quantity: currentNight.mealPax,
            unitPrice: currentNight.mealUnitPrice,
            amount: currentNight.mealAmount,
            postedById: accountingUser.id,
            postedAt: todayTimestampStart,
          },
        });
        postedGroupMealLineCount += 1;
      }
    }

    console.log(
      `✓ seeded ${checkedInReservations.length} open folios with classified deposit payments`,
    );
    console.log(
      `✓ seeded ${postedGroupMealLineCount} current-night posted group meal line`,
    );

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

      await prisma.payment.createMany({
        data: [
          {
            folioId: folio.id,
            fbOrderId: null,
            amount: reservation.deposit,
            method: PaymentMethod.CASH,
            purpose: PaymentPurpose.DEPOSIT,
            reference: null,
            receivedById: createdBy.id,
            receivedAt: reservation.arrivalDate,
          },
          {
            folioId: folio.id,
            fbOrderId: null,
            amount: totalsBeforePayment.totalCharges - reservation.deposit,
            method: PaymentMethod.CASH,
            purpose: PaymentPurpose.SETTLEMENT,
            reference: null,
            receivedById: createdBy.id,
            receivedAt: reservation.departureDate,
          },
        ],
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
        { code: "TEA", quantity: 4, notes: "Gula sedikit" },
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
        { code: "MIE-GORENG", quantity: 2, notes: "Tanpa seafood, pedas" },
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

    await seedFrontOfficeActivityLogs({
      frontOfficeUsers,
      todayStart: todayTimestampStart,
    });

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
