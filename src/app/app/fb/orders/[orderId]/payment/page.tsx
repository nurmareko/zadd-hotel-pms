import { FBOrderServiceType, FBOrderStatus, PaymentMethod } from "@prisma/client";
import { CircleSlash } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fbOrderGuestLabel,
  parseFBOrderItemNotes,
} from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { formatDateTimeID, formatDecimalID, formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { OrderStatusBadge } from "../../../status-badge";
import { PaymentForm } from "./payment-form";

type PaymentPageProps = {
  params: Promise<{ orderId: string }>;
};

function percentLabel(percent: string) {
  return formatDecimalID(percent);
}

function shouldShowPercentRow(percent: string) {
  return Number(percent) > 0;
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-gray-100 py-2 ${
        strong ? "pt-3 text-base font-bold" : "text-sm"
      }`}
    >
      <span className={strong ? "text-slate-900" : "text-slate-500"}>
        {label}
      </span>
      <span className={`num text-slate-900 ${strong ? "text-2xl" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function methodLabel(method: PaymentMethod | null) {
  if (method === PaymentMethod.CASH) {
    return "Tunai";
  }

  if (method === PaymentMethod.CARD) {
    return "Kartu";
  }

  if (method === PaymentMethod.TRANSFER) {
    return "Transfer";
  }

  if (method === PaymentMethod.CHARGE_TO_ROOM) {
    return "Charge to Room";
  }

  return "-";
}

function cashDetailsFromReference(reference: string | null | undefined) {
  if (!reference?.startsWith("CASH_TENDERED=")) {
    return null;
  }

  const parts = Object.fromEntries(
    reference.split(";").map((part) => {
      const [key, value] = part.split("=");

      return [key, value];
    }),
  );

  if (!parts.CASH_TENDERED || !parts.CHANGE) {
    return null;
  }

  return {
    amountTendered: parts.CASH_TENDERED,
    change: parts.CHANGE,
  };
}

function ClosedState({
  orderId,
  paymentMethod,
  total,
  paymentReference,
  cashDetails,
  chargedFolio,
  locationLabel,
}: {
  orderId: number;
  paymentMethod: PaymentMethod | null;
  total: string;
  paymentReference: string | null;
  cashDetails: { amountTendered: string; change: string } | null;
  chargedFolio: { folioNo: string } | null;
  locationLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-status-vc-pip bg-status-vc-bg shadow-sm">
      <div className="border-b border-status-vc-pip/60 bg-white/70 px-5 py-4">
        <div className="text-base font-semibold text-status-vc-fg">
          Sudah Dibayar
        </div>
      </div>
      <div className="grid gap-3 p-5 text-sm text-status-vc-fg">
        <div>
          <div className="text-base font-bold">
            Order sudah ditutup
          </div>
          <div className="mt-1 leading-5">
            {methodLabel(paymentMethod)} · Total{" "}
            <span className="num font-semibold">{formatIDR(total)}</span>
            · {locationLabel}
            {paymentMethod === PaymentMethod.CHARGE_TO_ROOM && chargedFolio ? (
              <>
                {" "}
                · Folio <span className="num font-semibold">{chargedFolio.folioNo}</span>
              </>
            ) : null}
            {paymentReference &&
            !paymentReference.startsWith("CASH_TENDERED=") ? (
              <> · Ref {paymentReference}</>
            ) : null}
          </div>
        </div>
        {paymentMethod === PaymentMethod.CASH && cashDetails ? (
          <div className="grid gap-2 rounded-lg border border-status-vc-pip bg-white px-4 py-3 text-slate-900 shadow-sm sm:grid-cols-2">
            <div>
              <span className="text-slate-500">Uang diterima</span>{" "}
              <span className="num font-semibold">
                {formatIDR(cashDetails.amountTendered)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Kembalian</span>{" "}
              <span className="num font-semibold">
                {formatIDR(cashDetails.change)}
              </span>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 border-t border-status-vc-pip pt-3 sm:flex-row">
          <a
            className={buttonVariants()}
            href={`/api/fb-orders/${orderId}/receipt`}
          >
            Cetak Struk
          </a>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/app/fb"
          >
            Kembali ke Daftar Meja
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function FbPaymentPage({ params }: PaymentPageProps) {
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
        chargedFolio: {
          select: {
            folioNo: true,
            reservation: {
              select: {
                guest: { select: { fullName: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
        payments: {
          orderBy: { receivedAt: "desc" },
          take: 1,
          select: { method: true, reference: true },
        },
        items: {
          include: {
            menuItem: { select: { name: true } },
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

  if (order.status === FBOrderStatus.OPEN) {
    redirect(`/app/fb/orders/${order.id}/bill`);
  }

  const totals = computeFBOrderTotals(order.items, settings);
  const isRoomService = order.serviceType === FBOrderServiceType.ROOM_SERVICE;
  const attachedRoomFolio =
    isRoomService && order.chargedFolio
      ? {
          folioNo: order.chargedFolio.folioNo,
          roomNumber: order.chargedFolio.reservation.room?.number ?? "-",
          guestName: order.chargedFolio.reservation.guest.fullName,
        }
      : null;
  const locationLabel = attachedRoomFolio
    ? `Room Service · Kamar ${attachedRoomFolio.roomNumber} · ${attachedRoomFolio.guestName}`
    : `Meja ${order.table?.number ?? order.tableNo ?? "-"}`;
  const openedAtLabel = formatDateTimeID(order.openedAt);
  const serviceChargePercent = settings.serviceChargePercent.toString();
  const taxPercent = settings.taxPercent.toString();
  const latestPayment = order.payments[0] ?? null;
  const latestCashDetails = cashDetailsFromReference(latestPayment?.reference);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-900 md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-slate-900">
            Pembayaran · {order.orderNo}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {locationLabel} · <span className="num">{order.guestCount}</span>{" "}
            pax · Dibuka {openedAtLabel}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === FBOrderStatus.VOIDED ? (
        <div className="mb-4 rounded-lg border border-status-od-pip bg-status-od-bg px-4 py-3 text-sm font-medium text-status-od-fg shadow-sm">
          Order ini sudah dibatalkan. Pembayaran tidak tersedia untuk order
          voided.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3">
          {order.status === FBOrderStatus.BILLED ? (
            <PaymentForm
              orderId={order.id}
              orderNo={order.orderNo}
              total={totals.total.toString()}
              items={order.items.map((item) => {
                const parsedNotes = parseFBOrderItemNotes(item.notes);
                const guestNumber = parsedNotes.guestNumber ?? 1;

                return {
                  id: item.id,
                  name: item.menuItem.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice.toString(),
                  notes: parsedNotes.notes || null,
                  guestLabel: fbOrderGuestLabel(guestNumber),
                };
              })}
              settings={{
                serviceChargePercent: serviceChargePercent,
                taxPercent: taxPercent,
              }}
              attachedRoomFolio={attachedRoomFolio}
            />
          ) : null}

          {order.status === FBOrderStatus.CLOSED ? (
            <ClosedState
              orderId={order.id}
              paymentMethod={order.paymentMethod ?? latestPayment?.method ?? null}
              total={totals.total.toString()}
              paymentReference={latestPayment?.reference ?? null}
              cashDetails={latestCashDetails}
              chargedFolio={order.chargedFolio}
              locationLabel={locationLabel}
            />
          ) : null}

          {order.status === FBOrderStatus.VOIDED ? (
            <EmptyState
              icon={CircleSlash}
              title="Tidak ada aksi pembayaran"
              description="Order voided tidak memiliki aksi pembayaran. Gunakan daftar order untuk kembali ke area F&B."
              className="rounded-lg border border-gray-200 bg-white shadow-sm"
            />
          ) : null}
        </div>

        <aside className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="text-base font-semibold text-slate-900">
              Ringkasan Bill
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Total tagihan untuk penyelesaian pembayaran.
            </div>
          </div>
          <div className="p-5">
            <SummaryRow
              label="Subtotal"
              value={formatIDR(totals.subtotal.toString())}
            />
            {shouldShowPercentRow(serviceChargePercent) ? (
              <SummaryRow
                label={`SC (${percentLabel(serviceChargePercent)}%)`}
                value={formatIDR(totals.serviceCharge.toString())}
              />
            ) : null}
            {shouldShowPercentRow(taxPercent) ? (
              <SummaryRow
                label={`Pajak (${percentLabel(taxPercent)}%)`}
                value={formatIDR(totals.tax.toString())}
              />
            ) : null}
            <SummaryRow
              label="Total"
              value={formatIDR(totals.total.toString())}
              strong
            />
            <div className="mt-4 rounded-lg border border-gray-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Jumlah tagihan</span>
                <span className="num font-bold text-slate-900">
                  {formatIDR(totals.total.toString())}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {order.items.length} item · Kasir {order.waitedBy.fullName}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
