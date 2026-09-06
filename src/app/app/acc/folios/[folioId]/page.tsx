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

import { auth } from "@/auth";
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
  CONFIRMED: "Terkonfirmasi",
  CHECKED_IN: "Sudah check-in",
  CHECKED_OUT: "Sudah check-out",
  CANCELLED: "Dibatalkan",
  NO_SHOW: "No-show",
};

const folioStatusClassNames: Record<FolioStatus, string> = {
  OPEN: "bg-status-oc-bg text-status-oc-fg border-status-oc-pip",
  CLOSED: "bg-status-vc-bg text-status-vc-fg border-status-vc-pip",
  VOIDED: "bg-status-ooo-bg text-status-ooo-fg border-status-ooo-pip",
};

const folioStatusLabels: Record<FolioStatus, string> = {
  OPEN: "Terbuka",
  CLOSED: "Ditutup",
  VOIDED: "Dibatalkan",
};

const depositStatusLabels: Record<DepositStatus, string> = {
  PENDING: "Menunggu",
  COLLECTED: "Terkumpul",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer",
  CARD: "Kartu",
  CHARGE_TO_ROOM: "Dibebankan ke kamar",
};

const paymentPurposeLabels: Record<PaymentPurpose, string> = {
  DEPOSIT: "Deposit",
  PAYMENT: "Pembayaran",
  SETTLEMENT: "Pelunasan",
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
    ["Biaya layanan", totals.serviceCharge],
    ["Pajak", totals.tax],
    ["Total tagihan", totals.totalCharges],
    ["Total pembayaran", totals.totalPaid],
  ] as const;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
        Ringkasan
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
          <dt>Sisa Tagihan</dt>
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
        <h2 className="text-sm font-semibold text-slate-700">Riwayat pembayaran</h2>
        <span className="text-xs font-medium text-slate-500">{payments.length} pembayaran</span>
      </div>
      {payments.length === 0 ? (
        <EmptyState icon={WalletCards} title="Belum ada pembayaran" description="Belum ada pembayaran yang diterima untuk folio ini." className="m-5" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Tanggal</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Tujuan</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Metode</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Referensi</th>
                <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Penerima</th>
                <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Jumlah</th>
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

  if (!session?.user || !["ACC", "ADMIN"].includes(session.user.role)) {
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
                <BreadcrumbLink href="/app/acc">Akuntansi</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Folio {folio.folioNo}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Detail folio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tampilan hanya baca untuk pemeriksaan penghambat dan rekonsiliasi.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            className={buttonVariants({ variant: "outline" })}
            href={`/api/folios/${folioId}/bill`}
          >
            <Download aria-hidden="true" />
            Unduh Tagihan
          </a>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={session.user.role === "ADMIN" ? "/app" : "/app/acc/night-audit"}
          >
            {session.user.role === "ADMIN" ? "Kembali" : "Kembali ke Night Audit"}
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
                Reservasi {folio.reservation.reservationNo}
              </p>
            </div>
            <StatusBadge
              label={folioStatusLabels[folio.status]}
              className={folioStatusClassNames[folio.status]}
            />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetadataItem
              label="Kamar"
              value={`${folio.reservation.room?.number ?? "Belum ditentukan"} · ${folio.reservation.roomType.name}`}
            />
            <MetadataItem
              label="Masa inap"
              value={`${formatCompactDateID(folio.reservation.arrivalDate)}–${formatCompactDateID(folio.reservation.departureDate)}`}
            />
            <MetadataItem label="Malam" value={nights} />
            <MetadataItem
              label="Status reservasi"
              value={reservationStatusLabels[folio.reservation.status]}
            />
            <MetadataItem label="Status folio" value={folioStatusLabels[folio.status]} />
            <MetadataItem label="Status deposit" value={depositStatusLabels[folio.reservation.depositStatus]} />
          </dl>
        </section>

        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Rincian tarif per malam</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-190 border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Tanggal</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Tarif kamar</th>
                  <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Paket makan</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Jumlah tamu</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Harga satuan makanan</th>
                  <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Jumlah makanan</th>
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
                <h2 className="text-sm font-semibold text-slate-700">Baris tagihan</h2>
                <span className="text-xs font-medium text-slate-500">{folio.lineItems.length} baris</span>
              </div>
              {folio.lineItems.length === 0 ? (
                <EmptyState icon={ReceiptText} title="Belum ada tagihan" description="Belum ada baris tagihan pada folio ini." className="m-5" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-205 border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Tanggal pencatatan</th>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Kode artikel</th>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Deskripsi</th>
                        <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">Referensi pesanan F&amp;B</th>
                        <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Jumlah</th>
                        <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Harga satuan</th>
                        <th className="bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-600">Nilai</th>
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
