import { TableLocation, TableStatus } from "@prisma/client";
import { differenceInMinutes } from "date-fns";
import Link from "next/link";

import { TableStatusBadge } from "./status-badge";

export type TableCardOrder = {
  id: number;
  orderNo: string;
  openedAt: Date;
  guestCount: number;
  items: Array<{ id: number }>;
};

export type RestaurantTableCard = {
  id: number;
  number: string;
  capacity: number;
  location: TableLocation;
  status: TableStatus;
  notes: string | null;
  orders: TableCardOrder[];
};

type TableCardProps = {
  table: RestaurantTableCard;
};

const statusCardStyles: Record<TableStatus, string> = {
  AVAILABLE:
    "border-status-vc-pip bg-status-vc-bg text-status-vc-fg hover:bg-emerald-50",
  OCCUPIED:
    "border-status-oc-pip bg-status-oc-bg text-status-oc-fg hover:bg-blue-50",
  RESERVED:
    "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
  OUT_OF_SERVICE:
    "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg opacity-75",
};

function elapsedLabel(openedAt: Date) {
  const minutes = Math.max(0, differenceInMinutes(new Date(), openedAt));

  if (minutes < 60) {
    return `${minutes} menit`;
  }

  return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
}

export function TableCard({ table }: TableCardProps) {
  const activeOrder = table.orders[0] ?? null;
  const href =
    table.status === TableStatus.AVAILABLE
      ? `/app/fb/orders/new?tableId=${table.id}`
      : table.status === TableStatus.OCCUPIED && activeOrder
        ? `/app/fb/orders/${activeOrder.id}`
        : null;
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[24px] font-bold leading-none tracking-normal">
          {table.number}
        </div>
        <TableStatusBadge status={table.status} />
      </div>
      <div className="mt-2 text-[11px] font-medium text-slate-600">
        Kapasitas {table.capacity}
      </div>
      {activeOrder ? (
        <div className="mt-3 border-t border-current/20 pt-2 text-[11px] text-slate-700">
          <div className="font-semibold text-console-ink">{activeOrder.orderNo}</div>
          <div className="mt-1 text-slate-500">
            <span className="num">{activeOrder.items.length}</span> item ·{" "}
            <span className="num">{activeOrder.guestCount}</span> tamu ·{" "}
            {elapsedLabel(activeOrder.openedAt)}
          </div>
        </div>
      ) : table.status === TableStatus.RESERVED ? (
        <div className="mt-3 border-t border-current/20 pt-2 text-[11px] text-slate-600">
          {table.notes ?? "Reservasi meja dicatat manual untuk MVP."}
        </div>
      ) : table.status === TableStatus.OUT_OF_SERVICE ? (
        <div className="mt-3 border-t border-current/20 pt-2 text-[11px] text-slate-600">
          {table.notes ?? "Meja tidak tersedia."}
        </div>
      ) : null}
    </>
  );
  const className = `block min-h-[126px] border border-l-4 p-3 text-left transition ${statusCardStyles[table.status]}`;

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link className={className} href={href}>
      {content}
    </Link>
  );
}
