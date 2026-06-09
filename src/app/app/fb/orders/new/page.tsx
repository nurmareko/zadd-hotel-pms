import { FBOrderStatus, TableStatus } from "@prisma/client";
import { Table2 } from "lucide-react";
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
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            {isRoomService ? "Room Service Order" : "Captain Order"}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {isRoomService
              ? "Validasi kamar in-house sebelum membuat order tanpa meja."
              : "Konfirmasi meja dan jumlah tamu sebelum membuat order."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isRoomService ? (
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              href="/app/fb/orders/new"
            >
              Dine In
            </Link>
          ) : (
            <Link
              className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
              href="/app/fb/orders/new?service=room-service"
            >
              Room Service
            </Link>
          )}
          <Link
            className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
            href="/app/fb"
          >
            Kembali
          </Link>
        </div>
      </div>

      {isRoomService ? (
        <section className="max-w-xl border border-console-border bg-console-surface">
          <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"ROOM SERVICE"}
          </div>
          <RoomServiceForm />
        </section>
      ) : table ? (
        <section className="max-w-xl border border-console-border bg-console-surface">
          <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"KONFIRMASI ORDER"}
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
            <div className="p-4 text-[13px] text-slate-600">
              <div className="font-semibold text-console-ink">
                Meja {table.number} tidak tersedia untuk order baru.
              </div>
              {table.orders[0] ? (
                <Link
                  className="mt-3 inline-flex h-8 items-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
                  href={`/app/fb/orders/${table.orders[0].id}`}
                >
                  Buka {table.orders[0].orderNo}
                </Link>
              ) : (
                <p className="mt-2 text-[12px] text-slate-500">
                  Pilih meja available dari Floor Plan untuk memulai order.
                </p>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="border border-console-border bg-console-surface">
          <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"PILIH MEJA AVAILABLE"}
          </div>
          {availableTables.length === 0 ? (
            <EmptyState
              icon={Table2}
              title="Tidak ada meja available"
              description="Semua meja sedang terpakai, reserved, atau tidak tersedia untuk order baru."
              className="m-3.5"
            />
          ) : (
            <div className="grid gap-2.5 p-3.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {availableTables.map((availableTable) => (
                <Link
                  className="border border-l-4 border-status-vc-pip bg-status-vc-bg p-3 text-status-vc-fg hover:bg-emerald-50"
                  href={`/app/fb/orders/new?tableId=${availableTable.id}`}
                  key={availableTable.id}
                >
                  <div className="text-[22px] font-bold text-console-ink">
                    {availableTable.number}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600">
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
