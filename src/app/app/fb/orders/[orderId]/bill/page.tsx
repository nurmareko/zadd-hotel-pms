import { FBOrderStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { parseFBOrderItemNotes } from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { formatDateTimeID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { OrderStatusBadge } from "../../../status-badge";
import { BillActions } from "./bill-actions";
import { BillView } from "./bill-view";

type BillPageProps = {
  params: Promise<{ orderId: string }>;
};

function statusBanner(status: FBOrderStatus) {
  if (status === FBOrderStatus.CLOSED) {
    return (
      <div className="mb-4 border border-status-vc-pip bg-status-vc-bg px-3.5 py-3 text-[12px] font-semibold text-status-vc-fg">
        Order ini sudah dibayar. Bill tersedia sebagai arsip dan dapat dicetak
        ulang.
      </div>
    );
  }

  if (status === FBOrderStatus.VOIDED) {
    return (
      <div className="mb-4 border border-status-od-pip bg-status-od-bg px-3.5 py-3 text-[12px] font-semibold text-status-od-fg">
        Order ini sudah dibatalkan. Alasan void belum tersimpan pada data order
        saat ini.
      </div>
    );
  }

  if (status === FBOrderStatus.BILLED) {
    return (
      <div className="mb-4 border border-status-oc-pip bg-status-oc-bg px-3.5 py-3 text-[12px] font-semibold text-status-oc-fg">
        Bill sudah dikonfirmasi. Lanjutkan ke pembayaran atau buka kembali jika
        tamu ingin menambah item.
      </div>
    );
  }

  return null;
}

export default async function BillPage({ params }: BillPageProps) {
  const { orderId } = await params;
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const [order, settings] = await Promise.all([
    prisma.fBOrder.findUnique({
      where: { id },
      include: {
        table: { select: { number: true } },
        waitedBy: { select: { fullName: true } },
        items: {
          include: {
            menuItem: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!order || !settings) {
    notFound();
  }

  const totals = computeFBOrderTotals(order.items, settings);
  const tableNo = order.table?.number ?? order.tableNo ?? "-";
  const openedAtLabel = formatDateTimeID(order.openedAt);

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Bill — {order.orderNo}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Meja {tableNo} · <span className="num">{order.guestCount}</span>{" "}
            pax · Dibuka {openedAtLabel}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {statusBanner(order.status)}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <BillView
          order={{
            orderNo: order.orderNo,
            tableNo,
            guestCount: order.guestCount,
            openedAtLabel,
            cashierName: order.waitedBy.fullName,
            items: order.items.map((item) => {
              const parsedNotes = parseFBOrderItemNotes(item.notes);

              return {
                id: item.id,
                name: item.menuItem.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice.toString(),
                amount: item.amount.toString(),
                notes: parsedNotes.notes,
                guestNumber: parsedNotes.guestNumber ?? 1,
              };
            }),
          }}
          settings={{
            hotelName: settings.hotelName,
            address: settings.address,
            serviceChargePercent: settings.serviceChargePercent.toString(),
            taxPercent: settings.taxPercent.toString(),
          }}
          totals={{
            subtotal: totals.subtotal.toString(),
            serviceCharge: totals.serviceCharge.toString(),
            tax: totals.tax.toString(),
            total: totals.total.toString(),
          }}
        />
        <BillActions
          hasItems={order.items.length > 0}
          orderId={order.id}
          orderNo={order.orderNo}
          status={order.status}
        />
      </div>
    </main>
  );
}
