import {
  FBOrderServiceType,
  FBOrderStatus,
  TableLocation,
  TableStatus,
} from "@prisma/client";
import Link from "next/link";

import { hotelTodayTimestampRange } from "@/lib/date-only";
import { formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { FloorPlan } from "./floor-plan";
import { buttonVariants } from "@/components/ui/button";

import { KpiCard } from "./kpi-card";
import { OrderList } from "./order-list";

export const revalidate = 60;

type FBLandingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function shiftLabel(date: Date) {
  const hour = date.getHours();

  if (hour < 14) {
    return "Shift Pagi";
  }

  if (hour < 22) {
    return "Shift Siang";
  }

  return "Shift Malam";
}

function isOrderStatus(value: string | undefined): value is FBOrderStatus {
  return Object.values(FBOrderStatus).includes(value as FBOrderStatus);
}

function isTableLocation(value: string | undefined): value is TableLocation {
  return Object.values(TableLocation).includes(value as TableLocation);
}

export default async function FBLandingPage({
  searchParams,
}: FBLandingPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = firstParam(params.tab) === "orders" ? "orders" : "floor";
  const selectedStatusParam = firstParam(params.status);
  const selectedStatus = isOrderStatus(selectedStatusParam)
    ? selectedStatusParam
    : "";
  const selectedLocationParam = firstParam(params.location);
  const selectedLocation = isTableLocation(selectedLocationParam)
    ? selectedLocationParam
    : Object.values(TableLocation)[0];
  const selectedTableId = firstParam(params.tableId) ?? "";
  const now = new Date();
  const { start: today, end: tomorrow } = hotelTodayTimestampRange(now);

  const [tables, todayOrders, activeOrders] = await Promise.all([
    prisma.restaurantTable.findMany({
      select: {
        id: true,
        number: true,
        capacity: true,
        location: true,
        status: true,
        posX: true,
        posY: true,
        notes: true,
        orders: {
          where: { status: FBOrderStatus.OPEN },
          include: { items: { select: { id: true } } },
          orderBy: { openedAt: "asc" },
        },
      },
      orderBy: [{ location: "asc" }, { number: "asc" }],
    }),
    prisma.fBOrder.findMany({
      where: {
        openedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        table: { select: { id: true, number: true } },
        chargedFolio: {
          select: {
            reservation: {
              select: {
                guest: { select: { fullName: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
        items: { select: { amount: true } },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.fBOrder.findMany({
      where: { status: FBOrderStatus.OPEN },
      select: { guestCount: true },
    }),
  ]);

  const activeTableCount = tables.filter(
    (table) => table.status === TableStatus.OCCUPIED,
  ).length;
  const availableTableCount = tables.filter(
    (table) => table.status === TableStatus.AVAILABLE,
  ).length;
  const openOrderCount = activeOrders.length;
  const activeGuestCount = activeOrders.reduce(
    (sum, order) => sum + order.guestCount,
    0,
  );
  const todayRevenue = todayOrders
    .filter((order) => order.status === FBOrderStatus.CLOSED)
    .reduce((sum, order) => sum + Number(order.total), 0);
  const tableOptions = tables
    .map((table) => ({ id: table.id, number: table.number }))
    .sort((first, second) =>
      first.number.localeCompare(second.number, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-slate-900">
            Daftar Meja
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {shiftLabel(now)} · <span className="num">{activeGuestCount}</span>{" "}
            tamu aktif
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/app/fb/orders/new?service=room-service"
          >
            New Room Service Order
          </Link>
          <Link
            className={buttonVariants()}
            href="/app/fb/orders/new"
          >
            Mulai Order Baru
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Aktif"
          value={activeTableCount}
          sub={`${activeTableCount} meja occupied`}
        />
        <KpiCard
          label="Tersedia"
          value={availableTableCount}
          sub={`${availableTableCount} meja siap pakai`}
        />
        <KpiCard
          label="Order Berjalan"
          value={openOrderCount}
          sub={`${activeGuestCount} tamu dalam order open`}
        />
        <KpiCard
          label="Pendapatan Hari Ini"
          value={formatIDR(todayRevenue)}
          sub="Order closed hari ini"
        />
      </div>

      <div className="mt-4 border-b border-gray-200">
        <nav className="flex gap-5" aria-label="F&B tabs">
          <Link
            className={`border-b-2 px-0 pb-2 text-sm font-semibold transition-colors ${
              activeTab === "floor"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
            href="/app/fb"
          >
            Floor Plan
          </Link>
          <Link
            className={`border-b-2 px-0 pb-2 text-sm font-semibold transition-colors ${
              activeTab === "orders"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
            href="/app/fb?tab=orders"
          >
            Daftar Order
          </Link>
        </nav>
      </div>

      <div className="mt-4">
        {activeTab === "orders" ? (
          <OrderList
            orders={todayOrders.map((order) => ({
              id: order.id,
              orderNo: order.orderNo,
              status: order.status,
              serviceType: order.serviceType,
              guestCount: order.guestCount,
              openedAt: order.openedAt,
              total: order.total.toString(),
              table: order.table,
              roomService:
                order.serviceType === FBOrderServiceType.ROOM_SERVICE
                  ? {
                      roomNumber:
                        order.chargedFolio?.reservation.room?.number ?? "-",
                      guestName:
                        order.chargedFolio?.reservation.guest.fullName ?? "-",
                    }
                  : null,
              items: order.items.map((item) => ({
                amount: item.amount.toString(),
              })),
            }))}
            selectedStatus={selectedStatus}
            selectedTableId={selectedTableId}
            tableOptions={tableOptions}
          />
        ) : (
          <FloorPlan selectedLocation={selectedLocation} tables={tables} />
        )}
      </div>
    </main>
  );
}
