import { FBOrderStatus, TableStatus } from "@prisma/client";
import { ArrowLeft, BedDouble, Table2, Utensils } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";

import { ConfirmForm } from "./confirm-form";
import { RoomServiceForm } from "./room-service-form";

type NewOrderPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const params = (await searchParams) ?? {};
  const isRoomService = firstParam(params.service) === "room-service";
  const tableId = Number(firstParam(params.tableId) ?? 0);
  const [table, availableTables] = await Promise.all([
    tableId > 0 && !isRoomService
      ? prisma.restaurantTable.findUnique({
          where: { id: tableId },
          include: {
            orders: {
              where: { status: FBOrderStatus.OPEN },
              select: { id: true, orderNo: true },
              orderBy: { openedAt: "desc" },
              take: 1,
            },
          },
        })
      : null,
    tableId > 0 || isRoomService
      ? Promise.resolve([])
      : prisma.restaurantTable.findMany({
          where: { status: TableStatus.AVAILABLE },
          orderBy: [{ location: "asc" }, { number: "asc" }],
          select: { id: true, number: true, capacity: true },
      }),
  ]);
  const canCreateOrder =
    table?.status === TableStatus.AVAILABLE ||
    table?.status === TableStatus.RESERVED;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-slate-900">
            {isRoomService ? "Room Service Order" : "Captain Order"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isRoomService
              ? "Validasi kamar in-house sebelum membuat order tanpa meja."
              : "Konfirmasi meja dan jumlah tamu sebelum membuat order."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isRoomService ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              href="/app/fb/orders/new"
            >
              <Utensils aria-hidden="true" className="size-4" />
              Dine In
            </Link>
          ) : (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              href="/app/fb/orders/new?service=room-service"
            >
              <BedDouble aria-hidden="true" className="size-4" />
              Room Service
            </Link>
          )}
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
            href="/app/fb"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Kembali
          </Link>
        </div>
      </div>

      {isRoomService ? (
        <section className="max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4 text-base font-semibold text-slate-900">
            Room Service
          </div>
          <RoomServiceForm />
        </section>
      ) : table ? (
        <section className="max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4 text-base font-semibold text-slate-900">
            Konfirmasi Order
          </div>
          {canCreateOrder ? (
            <ConfirmForm
              table={{
                id: table.id,
                number: table.number,
                capacity: table.capacity,
              }}
            />
          ) : (
            <div className="p-5 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">
                Meja {table.number} tidak tersedia untuk order baru.
              </div>
              {table.orders[0] ? (
                <Link
                  className="mt-3 inline-flex h-10 items-center rounded-xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                  href={`/app/fb/orders/${table.orders[0].id}`}
                >
                  Buka {table.orders[0].orderNo}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Pilih meja available dari Floor Plan untuk memulai order.
                </p>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4 text-base font-semibold text-slate-900">
            Pilih Meja Available
          </div>
          {availableTables.length === 0 ? (
            <EmptyState
              icon={Table2}
              title="Tidak ada meja available"
              description="Semua meja sedang terpakai, reserved, atau tidak tersedia untuk order baru."
              className="m-3.5"
            />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {availableTables.map((availableTable) => (
                <Link
                  className="rounded-2xl border border-gray-200 bg-white p-4 text-slate-700 shadow-sm transition-colors hover:border-status-vc-pip hover:bg-status-vc-bg"
                  href={`/app/fb/orders/new?tableId=${availableTable.id}`}
                  key={availableTable.id}
                >
                  <div className="text-2xl font-bold text-slate-900">
                    {availableTable.number}
                  </div>
                  <div className="mt-2 inline-flex h-6 items-center rounded-full border border-status-vc-pip bg-status-vc-bg px-2.5 text-xs font-semibold text-status-vc-fg">
                    Available
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Kapasitas {availableTable.capacity}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
