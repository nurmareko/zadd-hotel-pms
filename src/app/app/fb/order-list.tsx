import { FBOrderServiceType, FBOrderStatus } from "@prisma/client";
import { ClipboardList, SearchX } from "lucide-react";
import Link from "next/link";

import { formatIDR, formatTimeID } from "@/lib/format";

import { OrderStatusBadge } from "./status-badge";

export type FBOrderListRow = {
  id: number;
  orderNo: string;
  status: FBOrderStatus;
  serviceType: FBOrderServiceType;
  guestCount: number;
  openedAt: Date;
  total: string;
  table: { id: number; number: string } | null;
  roomService: { roomNumber: string; guestName: string } | null;
  items: Array<{ amount: string }>;
};

type OrderListProps = {
  orders: FBOrderListRow[];
  tableOptions: Array<{ id: number; number: string }>;
  selectedStatus: string;
  selectedTableId: string;
};

const orderStatusOptions: Array<{ value: FBOrderStatus; label: string }> = [
  { value: FBOrderStatus.OPEN, label: "Open" },
  { value: FBOrderStatus.BILLED, label: "Billed" },
  { value: FBOrderStatus.CLOSED, label: "Closed" },
  { value: FBOrderStatus.VOIDED, label: "Voided" },
];

function actionLabel(status: FBOrderStatus) {
  if (status === FBOrderStatus.CLOSED) {
    return "Lihat Receipt";
  }

  if (status === FBOrderStatus.OPEN || status === FBOrderStatus.BILLED) {
    return "Lanjutkan";
  }

  return "Lihat";
}

function itemTotal(order: FBOrderListRow) {
  return order.items.reduce((sum, item) => sum + Number(item.amount), 0);
}

function serviceLocation(order: FBOrderListRow) {
  if (order.serviceType === FBOrderServiceType.ROOM_SERVICE) {
    return {
      primary: `Room Service · Kamar ${order.roomService?.roomNumber ?? "-"}`,
      secondary: order.roomService?.guestName ?? "-",
    };
  }

  return {
    primary: order.table?.number ?? "-",
    secondary: "Dine in",
  };
}

export function OrderList({
  orders,
  tableOptions,
  selectedStatus,
  selectedTableId,
}: OrderListProps) {
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = selectedStatus ? order.status === selectedStatus : true;
    const matchesTable = selectedTableId
      ? order.table?.id === Number(selectedTableId)
      : true;

    return matchesStatus && matchesTable;
  });

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4 text-base font-semibold text-slate-900">
        Daftar Order
      </div>
      <form className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white p-4 md:p-5" action="/app/fb">
        <input type="hidden" name="tab" value="orders" />
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          name="status"
          defaultValue={selectedStatus}
        >
          <option value="">Semua Status</option>
          {orderStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          name="tableId"
          defaultValue={selectedTableId}
        >
          <option value="">Semua Meja</option>
          {tableOptions.map((table) => (
            <option key={table.id} value={table.id}>
              {table.number}
            </option>
          ))}
        </select>
        <button
          className="h-10 rounded-md border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          type="submit"
        >
          Terapkan
        </button>
        <Link
          className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
          href="/app/fb?tab=orders"
        >
          Reset
        </Link>
        <span className="ml-auto text-sm font-semibold text-slate-500">
          <span className="num">{filteredOrders.length}</span> order
        </span>
      </form>

      {orders.length === 0 ? (
        <div className="m-4 flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-slate-50 px-4 py-8 text-center md:m-5">
          <ClipboardList className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            Belum ada order hari ini
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Mulai order dari meja available di tab Floor Plan.
          </p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="m-4 flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-slate-50 px-4 py-8 text-center md:m-5">
          <SearchX className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            Tidak ada order
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tidak ada order yang cocok dengan filter.
          </p>
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[920px] w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-semibold text-slate-500">
                  Order #
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-semibold text-slate-500">
                  Lokasi
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-right text-xs font-semibold text-slate-500">
                  Tamu
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-semibold text-slate-500">
                  Status
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-semibold text-slate-500">
                  Dibuka
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-right text-xs font-semibold text-slate-500">
                  Total
                </th>
                <th className="border-b border-gray-200 bg-slate-50 px-3.5 py-3 text-right text-xs font-semibold text-slate-500">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const location = serviceLocation(order);

                return (
                  <tr
                    className="border-b border-gray-100 odd:bg-white even:bg-slate-50/70 hover:bg-status-vc-bg"
                    key={order.id}
                  >
                    <td className="px-3.5 py-3 font-semibold text-slate-900">
                      {order.orderNo}
                    </td>
                    <td className="px-3.5 py-3 text-slate-700">
                      <div className="font-semibold text-slate-900">
                        {location.primary}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {location.secondary}
                      </div>
                    </td>
                    <td className="num px-3.5 py-3 text-right text-slate-700">
                      {order.guestCount}
                    </td>
                    <td className="px-3.5 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="num px-3.5 py-3 text-slate-700">
                      {formatTimeID(order.openedAt)}
                    </td>
                    <td className="num px-3.5 py-3 text-right font-semibold text-slate-900">
                      {formatIDR(itemTotal(order))}
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <Link
                        className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                        href={`/app/fb/orders/${order.id}`}
                      >
                        {actionLabel(order.status)}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
