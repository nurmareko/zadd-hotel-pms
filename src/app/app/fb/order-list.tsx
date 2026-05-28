import { FBOrderStatus } from "@prisma/client";
import { ClipboardList, SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { formatIDR, formatTimeID } from "@/lib/format";

import { OrderStatusBadge } from "./status-badge";

export type FBOrderListRow = {
  id: number;
  orderNo: string;
  status: FBOrderStatus;
  guestCount: number;
  openedAt: Date;
  total: string;
  table: { id: number; number: string } | null;
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
    <section className="border border-console-border bg-console-surface">
      <div className="border-b border-console-border bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// DAFTAR ORDER"}
      </div>
      <form className="flex flex-wrap items-center gap-2 border-b border-console-border p-3.5" action="/app/fb">
        <input type="hidden" name="tab" value="orders" />
        <select
          className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
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
          className="h-8 border border-console-border bg-white px-2 text-[12px] text-console-ink outline-none focus:border-console-ink"
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
          className="h-8 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          type="submit"
        >
          Terapkan
        </button>
        <Link
          className="h-8 border border-console-border bg-white px-3 py-2 text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          href="/app/fb?tab=orders"
        >
          Reset
        </Link>
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          <span className="num">{filteredOrders.length}</span> order
        </span>
      </form>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada order hari ini"
          description="Mulai order dari meja available di tab Floor Plan."
          className="m-3.5"
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Tidak ada order"
          description="Tidak ada order yang cocok dengan filter."
          className="m-3.5"
        />
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[920px] w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Order #
                </th>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Meja
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Tamu
                </th>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Status
                </th>
                <th className="bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Dibuka
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Total
                </th>
                <th className="bg-console-ink px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  className="border-b border-console-border-soft odd:bg-white even:bg-console-bg hover:bg-status-vc-bg"
                  key={order.id}
                >
                  <td className="px-3 py-2 font-semibold text-console-ink">
                    {order.orderNo}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {order.table?.number ?? "-"}
                  </td>
                  <td className="num px-3 py-2 text-right text-slate-700">
                    {order.guestCount}
                  </td>
                  <td className="px-3 py-2">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="num px-3 py-2 text-slate-700">
                    {formatTimeID(order.openedAt)}
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-console-ink">
                    {formatIDR(itemTotal(order))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      className="inline-flex h-7 items-center border border-console-border bg-white px-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
                      href={`/app/fb/orders/${order.id}`}
                    >
                      {actionLabel(order.status)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
