import { TableLocation, TableStatus } from "@prisma/client";
import { differenceInMinutes } from "date-fns";
import Link from "next/link";

import { TableStatusBadge, tableStatusLabels } from "./status-badge";

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
  posX: number;
  posY: number;
  notes: string | null;
  orders: TableCardOrder[];
};

type TableCardProps = {
  table: RestaurantTableCard;
  variant?: "card" | "floor";
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

export const floorTableStatusStyles: Record<TableStatus, string> = {
  AVAILABLE:
    "border-emerald-700 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  OCCUPIED: "border-blue-700 bg-blue-50 text-blue-950 hover:bg-blue-100",
  RESERVED: "border-amber-700 bg-amber-50 text-amber-950",
  OUT_OF_SERVICE: "border-slate-700 bg-slate-100 text-slate-950 opacity-80",
};

function elapsedLabel(openedAt: Date) {
  const minutes = Math.max(0, differenceInMinutes(new Date(), openedAt));

  if (minutes < 60) {
    return `${minutes} menit`;
  }

  return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
}

export function TableCard({ table, variant = "card" }: TableCardProps) {
  const activeOrder = table.orders[0] ?? null;
  const href =
    table.status === TableStatus.AVAILABLE
      ? `/app/fb/orders/new?tableId=${table.id}`
      : table.status === TableStatus.OCCUPIED && activeOrder
        ? `/app/fb/orders/${activeOrder.id}`
        : null;
  const cardContent = (
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
  const floorContent = (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <span className="num text-[17px] font-bold leading-none">
        {table.number}
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.06em]">
        {table.capacity} pax
      </span>
      <span className="mt-1 h-1.5 w-1.5 bg-current" aria-hidden="true" />
      <span className="sr-only">{tableStatusLabels[table.status]}</span>
    </div>
  );
  const className =
    variant === "floor"
      ? `block h-full w-full border-2 text-left shadow-[2px_2px_0_#111827] transition ${floorTableStatusStyles[table.status]}`
      : `block min-h-[126px] border border-l-4 p-3 text-left transition ${statusCardStyles[table.status]}`;
  const content = variant === "floor" ? floorContent : cardContent;

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link className={className} href={href}>
      {content}
    </Link>
  );
}
