import { TableLocation, TableStatus } from "@prisma/client";
import { differenceInMinutes } from "date-fns";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";

import { tableStatusLabels } from "./status-badge";
import { TableStatusPopover } from "./table-status-popover";

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
    "border-status-vc-pip bg-white hover:border-status-vc-pip hover:bg-status-vc-bg",
  OCCUPIED:
    "border-status-oc-pip bg-white hover:border-status-oc-pip hover:bg-status-oc-bg",
  RESERVED:
    "border-status-vd-pip bg-white hover:border-status-vd-pip hover:bg-status-vd-bg",
  OUT_OF_SERVICE:
    "border-status-oos-pip bg-white opacity-75 hover:border-status-oos-pip hover:bg-status-oos-bg",
};

export const floorTableStatusStyles: Record<TableStatus, string> = {
  AVAILABLE:
    "border-status-vc-pip bg-status-vc-bg text-status-vc-fg hover:bg-status-vc-bg/80",
  OCCUPIED:
    "border-status-oc-pip bg-status-oc-bg text-status-oc-fg hover:bg-status-oc-bg/80",
  RESERVED: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  OUT_OF_SERVICE:
    "border-status-oos-pip bg-status-oos-bg text-status-oos-fg opacity-80",
};

function elapsedLabel(openedAt: Date) {
  const minutes = Math.max(0, differenceInMinutes(new Date(), openedAt));

  if (minutes < 60) {
    return `${minutes} menit`;
  }

  return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
}

function isManualFloorStatus(
  status: TableStatus,
): status is Extract<TableStatus, "RESERVED" | "OUT_OF_SERVICE"> {
  return (
    status === TableStatus.RESERVED ||
    status === TableStatus.OUT_OF_SERVICE
  );
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
        <div className="text-2xl font-bold leading-none text-slate-900">
          {table.number}
        </div>
        <StatusBadge
          className={floorTableStatusStyles[table.status]}
          label={tableStatusLabels[table.status]}
        />
      </div>
      <div className="mt-2 text-sm font-medium text-slate-600">
        Kapasitas {table.capacity}
      </div>
      {activeOrder ? (
        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-900">{activeOrder.orderNo}</div>
          <div className="mt-1 text-slate-500">
            <span className="num">{activeOrder.items.length}</span> item ·{" "}
            <span className="num">{activeOrder.guestCount}</span> tamu ·{" "}
            {elapsedLabel(activeOrder.openedAt)}
          </div>
        </div>
      ) : table.status === TableStatus.RESERVED ? (
        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-slate-600">
          {table.notes ?? "Reservasi meja dicatat manual untuk MVP."}
        </div>
      ) : table.status === TableStatus.OUT_OF_SERVICE ? (
        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-slate-600">
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
      <span className="mt-1 text-[10px] font-semibold">
        {table.capacity} pax
      </span>
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      <span className="sr-only">{tableStatusLabels[table.status]}</span>
    </div>
  );
  const className =
    variant === "floor"
      ? `block h-full w-full rounded-2xl border text-left shadow-sm transition ${floorTableStatusStyles[table.status]}`
      : `block min-h-[126px] rounded-2xl border p-4 text-left shadow-sm transition ${statusCardStyles[table.status]}`;
  const content = variant === "floor" ? floorContent : cardContent;

  if (!href) {
    if (variant === "floor" && isManualFloorStatus(table.status)) {
      return (
        <TableStatusPopover
          className={className}
          notes={table.notes}
          status={table.status}
          tableId={table.id}
          tableNumber={table.number}
        >
          {content}
        </TableStatusPopover>
      );
    }

    return <div className={className}>{content}</div>;
  }

  return (
    <Link className={className} href={href}>
      {content}
    </Link>
  );
}
