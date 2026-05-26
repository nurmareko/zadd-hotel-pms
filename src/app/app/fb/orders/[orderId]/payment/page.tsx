import { FBOrderStatus, PaymentMethod } from "@prisma/client";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  fbOrderGuestLabel,
  parseFBOrderItemNotes,
} from "@/lib/fb-order-guest";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { OrderStatusBadge } from "../../../status-badge";
import { PaymentForm } from "./payment-form";

type PaymentPageProps = {
  params: Promise<{ orderId: string }>;
};

function percentLabel(percent: string) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(percent));
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
      className={`flex items-center justify-between gap-3 border-b border-console-border-soft py-1.5 ${
        strong ? "text-[15px] font-bold uppercase tracking-[0.04em]" : ""
      }`}
    >
      <span className={strong ? "text-console-ink" : "text-slate-500"}>
        {label}
      </span>
      <span className={`num text-console-ink ${strong ? "text-[22px]" : ""}`}>
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
}: {
  orderId: number;
  paymentMethod: PaymentMethod | null;
  total: string;
  paymentReference: string | null;
  cashDetails: { amountTendered: string; change: string } | null;
  chargedFolio: { folioNo: string } | null;
}) {
  return (
    <section className="border border-status-vc-pip bg-status-vc-bg">
      <div className="bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// SUDAH DIBAYAR"}
      </div>
      <div className="grid gap-3 p-3.5 text-[12px] text-status-vc-fg">
        <div>
          <div className="text-[15px] font-bold uppercase tracking-[0.04em]">
            Order sudah ditutup
          </div>
          <div className="mt-1 leading-5">
            {methodLabel(paymentMethod)} · Total{" "}
            <span className="num font-semibold">{formatIDR(total)}</span>
            {chargedFolio ? (
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
          <div className="grid gap-1 border border-status-vc-pip bg-white px-3 py-2 text-console-ink sm:grid-cols-2">
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
            className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
            href={`/api/fb-orders/${orderId}/receipt`}
          >
            Cetak Struk
          </a>
          <Link
            className="inline-flex h-8 items-center justify-center border border-console-border bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
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
        chargedFolio: { select: { folioNo: true } },
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
  const tableNo = order.table?.number ?? order.tableNo ?? "-";
  const openedAtLabel = format(order.openedAt, "dd MMM yyyy HH:mm", {
    locale: indonesianLocale,
  });
  const serviceChargePercent = settings.serviceChargePercent.toString();
  const taxPercent = settings.taxPercent.toString();
  const latestPayment = order.payments[0] ?? null;
  const latestCashDetails = cashDetailsFromReference(latestPayment?.reference);

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Pembayaran — {order.orderNo}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Meja {tableNo} · <span className="num">{order.guestCount}</span>{" "}
            pax · Dibuka {openedAtLabel}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === FBOrderStatus.VOIDED ? (
        <div className="mb-4 border border-status-od-pip bg-status-od-bg px-3.5 py-3 text-[12px] font-semibold text-status-od-fg">
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
            />
          ) : null}

          {order.status === FBOrderStatus.VOIDED ? (
            <section className="border border-console-border bg-console-surface p-3.5 text-[12px] text-slate-600">
              Tidak ada aksi pembayaran. Gunakan daftar order untuk kembali ke
              area F&amp;B.
            </section>
          ) : null}
        </div>

        <aside className="border border-console-border bg-console-surface xl:sticky xl:top-4 xl:self-start">
          <div className="bg-console-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
            {"// RINGKASAN BILL"}
          </div>
          <div className="p-3.5 text-[12px]">
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
            <div className="mt-3 border border-console-border bg-console-bg px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Amount due</span>
                <span className="num font-bold text-console-ink">
                  {formatIDR(totals.total.toString())}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {order.items.length} item · Kasir {order.waitedBy.fullName}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
