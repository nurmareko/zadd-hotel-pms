import {
  DepositStatus,
  FolioStatus,
  PaymentMethod,
  PaymentPurpose,
  ReservationStatus,
} from "@prisma/client";
import { Download, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth, type AppRole } from "@/auth";
import { can } from "@/lib/permissions";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { computeFolioTotals, type FolioTotals } from "@/lib/folio-totals";
import {
  formatCompactDateID,
  formatDecimalID,
  formatIDR,
  formatMonthDayTimeID,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AccFolioPageProps = {
  params: Promise<{ folioId: string }>;
};

const reservationStatusLabels: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const folioStatusClassNames: Record<FolioStatus, string> = {
  OPEN: "bg-status-oc-bg text-status-oc-fg border-status-oc-pip",
  CLOSED: "bg-status-vc-bg text-status-vc-fg border-status-vc-pip",
  VOIDED: "bg-status-ooo-bg text-status-ooo-fg border-status-ooo-pip",
};

const folioStatusLabels: Record<FolioStatus, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  VOIDED: "Cancelled",
};

const depositStatusLabels: Record<DepositStatus, string> = {
  PENDING: "Pending",
  COLLECTED: "Collected",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
  CARD: "Card",
  CHARGE_TO_ROOM: "Charge to Room",
};

const paymentPurposeLabels: Record<PaymentPurpose, string> = {
  DEPOSIT: "Deposit",
  PAYMENT: "Payment",
  SETTLEMENT: "Final Payment",
};

function MetadataItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function TotalsSummary({ totals }: { totals: FolioTotals }) {
  const rows = [
    ["Subtotal", totals.subtotal],
    ["Service charge", totals.serviceCharge],
    ["Tax", totals.tax],
    ["Total charges", totals.totalCharges],
    ["Total payments", totals.totalPaid],
  ] as const;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
        Summary
      </h2>
      <dl className="p-5 text-sm">
        {rows.map(([label, amount]) => (
          <div className="flex items-center justify-between gap-3 py-1.5" key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-700">{formatIDR(amount)}</dd>
          </div>
        ))}
        <div className="my-3 border-t border-slate-100" />
        <div className="flex items-center justify-between gap-3 py-1.5 text-base font-semibold">
          <dt>Outstanding Balance</dt>
          <dd className={totals.balance > 0 ? "text-red-600" : "text-emerald-600"}>
            {formatIDR(totals.balance)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

type ReadOnlyPayment = {
  amount: { toString(): string };
  method: PaymentMethod;
  purpose: PaymentPurpose;
  reference: string | null;
  receivedAt: Date;
  receivedBy: { fullName: string };
};

function PaymentsTable({ payments }: { payments: ReadOnlyPayment[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Payment history</h2>
        <span className="text-xs font-medium text-slate-500">{payments.length} payments</span>
      </div>
      {payments.length === 0 ? (
        <EmptyState icon={WalletCards} title="No payments yet" description="No payments have been received for this folio." className="m-5" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Purpose</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Method</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Reference</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Received By</th>
                <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr key={`${payment.receivedAt.toISOString()}-${index}`} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatMonthDayTimeID(payment.receivedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{paymentPurposeLabels[payment.purpose]}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{paymentMethodLabels[payment.method]}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{payment.reference ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{payment.receivedBy.fullName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">{formatIDR(payment.amount.toString())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AccFolioPage({ params }: AccFolioPageProps) {
  const session = await auth();

  if (!session?.user || !can(session.user.role as AppRole, "folios:audit")) {
    redirect("/app/forbidden");
  }

  const { folioId: folioIdParam } = await params;
  const folioId = Number(folioIdParam);

  if (!Number.isInteger(folioId) || folioId <= 0) {
    notFound();
  }

  const [folio, settings] = await Promise.all([
    prisma.folio.findUnique({
      where: { id: folioId },
      select: {
        folioNo: true,
        status: true,
        reservation: {
          select: {
            reservationNo: true,
            arrivalDate: true,
            departureDate: true,
            status: true,
            depositStatus: true,
            guest: { select: { fullName: true } },
            room: { select: { number: true } },
            roomType: { select: { name: true } },
            reservationNights: {
              select: {
                date: true,
                rateAmount: true,
                mealPlan: true,
                mealPax: true,
                mealUnitPrice: true,
                mealAmount: true,
              },
              orderBy: { date: "asc" },
            },
          },
        },
        lineItems: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
            fbOrderId: true,
            postedAt: true,
            article: { select: { code: true, type: true } },
            fbOrder: { select: { orderNo: true } },
          },
          orderBy: { postedAt: "asc" },
        },
        payments: {
          select: {
            amount: true,
            method: true,
            purpose: true,
            reference: true,
            receivedAt: true,
            receivedBy: { select: { fullName: true } },
          },
          orderBy: { receivedAt: "asc" },
        },
      },
    }),
    prisma.hotelSettings.findUnique({
      where: { id: 1 },
      select: { serviceChargePercent: true, taxPercent: true },
    }),
  ]);

  if (!folio) {
    notFound();
  }

  if (!settings) {
    throw new Error("Hotel settings not found");
  }

  // Keep the query allowlisted to the monetary fields and linkage used by the
  // canonical helper instead of loading complete Prisma records.
  const totals = computeFolioTotals(
    folio.lineItems as unknown as Parameters<typeof computeFolioTotals>[0],
    folio.payments as unknown as Parameters<typeof computeFolioTotals>[1],
    settings as unknown as Parameters<typeof computeFolioTotals>[2],
  );
  const nights = folio.reservation.reservationNights.length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-foreground md:px-6 md:py-5">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/app/acc">Accounting</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Folio {folio.folioNo}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Folio details
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only view for reviewing blockers and reconciliation.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            className={buttonVariants({ variant: "outline" })}
            href={`/api/folios/${folioId}/bill`}
          >
            <Download aria-hidden="true" />
            Download Bill
          </a>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={session.user.role === "ADMIN" ? "/app" : "/app/acc/night-audit"}
          >
            {session.user.role === "ADMIN" ? "Back" : "Back to Night Audit"}
          </Link>
        </div>
      </header>

      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                {folio.folioNo}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {folio.reservation.guest.fullName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Reservation {folio.reservation.reservationNo}
              </p>
            </div>
            <StatusBadge
              label={folioStatusLabels[folio.status]}
              className={folioStatusClassNames[folio.status]}
            />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetadataItem
              label="Room"
              value={`${folio.reservation.room?.number ?? "Not assigned"} · ${folio.reservation.roomType.name}`}
            />
            <MetadataItem
              label="Stay dates"
              value={`${formatCompactDateID(folio.reservation.arrivalDate)}–${formatCompactDateID(folio.reservation.departureDate)}`}
            />
            <MetadataItem label="Night" value={nights} />
            <MetadataItem
              label="Reservation status"
              value={reservationStatusLabels[folio.reservation.status]}
            />
            <MetadataItem label="Folio status" value={folioStatusLabels[folio.status]} />
            <MetadataItem label="Deposit status" value={depositStatusLabels[folio.reservation.depositStatus]} />
          </dl>
        </section>

        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Nightly rate breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-190 border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Room rate</th>
                  <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Meal plan</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Guest count</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Meal unit price</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Meal amount</th>
                </tr>
              </thead>
              <tbody>
                {folio.reservation.reservationNights.map((night) => (
                  <tr key={night.date.toISOString()} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatCompactDateID(night.date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">{formatIDR(night.rateAmount.toString())}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{night.mealPlan ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{night.mealPax ?? "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{night.mealUnitPrice === null ? "-" : formatIDR(night.mealUnitPrice.toString())}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">{night.mealAmount === null ? "-" : formatIDR(night.mealAmount.toString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-4">
            <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-700">Charge lines</h2>
                <span className="text-xs font-medium text-slate-500">{folio.lineItems.length} lines</span>
              </div>
              {folio.lineItems.length === 0 ? (
                <EmptyState icon={ReceiptText} title="No charges yet" description="No charge lines on this folio yet." className="m-5" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-205 border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Posting date</th>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Article code</th>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Description</th>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">F&amp;B order reference</th>
                        <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Quantity</th>
                        <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Unit price</th>
                        <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folio.lineItems.map((lineItem, index) => (
                        <tr key={`${lineItem.postedAt.toISOString()}-${lineItem.article.code}-${index}`} className="border-b border-slate-100 last:border-0">
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatMonthDayTimeID(lineItem.postedAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{lineItem.article.code}</td>
                          <td className="px-4 py-3 text-slate-900">{lineItem.description}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">{lineItem.fbOrder?.orderNo ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{formatDecimalID(lineItem.quantity.toString())}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{formatIDR(lineItem.unitPrice.toString())}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">{formatIDR(lineItem.amount.toString())}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <PaymentsTable payments={folio.payments} />
          </div>
          <aside>
            <TotalsSummary totals={totals} />
          </aside>
        </div>
      </div>
    </main>
  );
}
