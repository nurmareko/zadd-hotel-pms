import {
  FolioStatus,
  ReservationStatus,
  type ArticleType,
} from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { CheckCircle2, Download, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatIDR } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import { CompleteCheckoutForm, FinalPaymentForm } from "./checkout-forms";

export const dynamic = "force-dynamic";

type CheckOutPageProps = {
  params: Promise<{ folioId: string }>;
};

type DetailItemProps = {
  label: string;
  value: React.ReactNode;
};

type ChargeLineItem = {
  id: number;
  description: string;
  quantity: { toString(): string };
  unitPrice: { toString(): string };
  amount: { toString(): string };
  postedAt: Date;
  article: {
    name: string;
    type: ArticleType;
  };
  postedBy: {
    fullName: string;
  };
  fbOrder: {
    orderNo: string;
  } | null;
};

const qtyFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const folioStatusClassNames = {
  [FolioStatus.OPEN]: "bg-status-oc-bg text-status-oc-fg border-status-oc-pip",
  [FolioStatus.CLOSED]:
    "bg-status-ooo-bg text-status-ooo-fg border-status-ooo-pip",
  [FolioStatus.VOIDED]: "bg-status-od-bg text-status-od-fg border-status-od-pip",
};

function dateLabel(date: Date) {
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
}

function dateTimeLabel(date: Date) {
  return format(date, "dd MMM yyyy HH:mm", { locale: indonesianLocale });
}

function postedAtLabel(date: Date) {
  return format(date, "dd MMM HH:mm", { locale: indonesianLocale });
}

function descriptionLabel(lineItem: ChargeLineItem) {
  const base = lineItem.description || lineItem.article.name;

  return lineItem.fbOrder ? `${base} - Order ${lineItem.fbOrder.orderNo}` : base;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-[12px] font-medium text-console-ink">{value}</dd>
    </div>
  );
}

function StepCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// "}
        {title}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: FolioStatus }) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${folioStatusClassNames[status]}`}
    >
      <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />
      {status}
    </span>
  );
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
    <div className="flex items-center justify-between gap-3 border-b border-console-border-soft py-2 last:border-b-0">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span
        className={`num text-right text-[12px] ${strong ? "font-bold text-console-ink" : "font-medium text-console-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

function BalanceDisplay({ balance }: { balance: number }) {
  const roundedBalance = Math.round(balance);

  if (roundedBalance > 0) {
    return (
      <p className="num text-[32px] font-bold leading-none text-status-od-fg">
        Belum Lunas - {formatIDR(balance)}
      </p>
    );
  }

  if (roundedBalance < 0) {
    return (
      <p className="num text-[32px] font-bold leading-none text-status-vd-fg">
        Lebih Bayar - {formatIDR(Math.abs(balance))}
      </p>
    );
  }

  return (
    <p className="num text-[32px] font-bold leading-none text-status-vc-fg">
      Lunas
    </p>
  );
}

function ChargesTable({ lineItems }: { lineItems: ChargeLineItem[] }) {
  if (lineItems.length === 0) {
    return (
      <div className="border border-dashed border-console-border bg-console-bg px-3 py-8 text-center text-[12px] text-slate-500">
        Belum ada tagihan.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-console-border">
      <table className="min-w-[720px] w-full border-collapse text-[12px]">
        <thead className="bg-console-ink text-console-accent">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
              Date
            </th>
            <th className="min-w-64 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
              Description
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">
              Posted by
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
              Qty
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
              Unit Price
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((lineItem) => (
            <tr
              key={lineItem.id}
              className="border-b border-console-border-soft odd:bg-console-surface even:bg-console-bg"
            >
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                {postedAtLabel(lineItem.postedAt)}
              </td>
              <td className="px-3 py-2.5 font-medium text-console-ink">
                {descriptionLabel(lineItem)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                {lineItem.postedBy.fullName}
              </td>
              <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                {qtyFormatter.format(Number(lineItem.quantity))}
              </td>
              <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                {formatIDR(lineItem.unitPrice.toString())}
              </td>
              <td className="num whitespace-nowrap px-3 py-2.5 text-right font-bold">
                {formatIDR(lineItem.amount.toString())}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Check-Out
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">{title}</p>
      </div>

      <StepCard title="Check-Out Blocked">
        <div className="p-3.5 text-[12px] text-status-od-fg">{message}</div>
      </StepCard>
    </main>
  );
}

export default async function CheckOutPage({ params }: CheckOutPageProps) {
  const { folioId } = await params;
  const parsedFolioId = Number(folioId);

  if (!Number.isInteger(parsedFolioId) || parsedFolioId <= 0) {
    notFound();
  }

  const [folio, settings] = await Promise.all([
    prisma.folio.findUnique({
      where: { id: parsedFolioId },
      include: {
        reservation: {
          include: {
            guest: { select: { fullName: true } },
            room: { select: { number: true } },
            roomType: { select: { code: true, name: true } },
          },
        },
        lineItems: {
          include: {
            article: true,
            postedBy: { select: { fullName: true } },
            fbOrder: { select: { orderNo: true } },
          },
          orderBy: { postedAt: "desc" },
        },
        payments: true,
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!folio) {
    return (
      <ErrorState
        title={`folioId=${parsedFolioId}`}
        message="Folio tidak ditemukan. Periksa data reservasi sebelum melanjutkan."
      />
    );
  }

  if (!settings) {
    return (
      <ErrorState
        title={folio.folioNo}
        message="Hotel settings belum tersedia, sehingga check-out belum bisa dihitung."
      />
    );
  }

  const totals = computeFolioTotals(folio.lineItems, folio.payments, settings);
  const nights = differenceInCalendarDays(
    folio.reservation.departureDate,
    folio.reservation.arrivalDate,
  );
  const isClosed = folio.status === FolioStatus.CLOSED;
  const isCheckoutAllowed =
    folio.status === FolioStatus.OPEN &&
    folio.reservation.status === ReservationStatus.CHECKED_IN;
  const hasBalanceDue = Math.round(totals.balance) > 0;

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Selesaikan Check-Out
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Review tagihan akhir, selesaikan pembayaran, lalu tutup folio.
          </p>
        </div>
        <p className="num text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          {folio.folioNo}
        </p>
      </div>

      <div className="max-w-4xl space-y-3">
        <StepCard title="GUEST">
          <div className="space-y-3.5 p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[22px] font-bold leading-tight text-console-ink">
                  {folio.reservation.guest.fullName}
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  {folio.reservation.reservationNo}
                </p>
              </div>
              <StatusBadge status={folio.status} />
            </div>

            <dl className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Folio No" value={folio.folioNo} />
              <DetailItem
                label="Room"
                value={`${folio.reservation.room?.number ?? "-"} / ${folio.reservation.roomType.code} - ${folio.reservation.roomType.name}`}
              />
              <DetailItem label="Nights" value={`${nights} night(s)`} />
              <DetailItem
                label="Arrival"
                value={dateLabel(folio.reservation.arrivalDate)}
              />
              <DetailItem
                label="Departure"
                value={dateLabel(folio.reservation.departureDate)}
              />
            </dl>
          </div>
        </StepCard>

        <StepCard title="FINAL BILL">
          <div className="space-y-3.5 p-3.5">
            <ChargesTable lineItems={folio.lineItems} />

            <div className="grid gap-4 border-t border-console-border pt-3.5 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
              <div className="flex min-h-24 items-center border border-console-border bg-console-bg p-3">
                <BalanceDisplay balance={totals.balance} />
              </div>

              <div>
                <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  [ Tagihan Akhir ]
                </div>
                <SummaryRow label="Subtotal" value={formatIDR(totals.subtotal)} />
                <SummaryRow
                  label={`SC (${Number(settings.serviceChargePercent)}%)`}
                  value={formatIDR(totals.serviceCharge)}
                />
                <SummaryRow
                  label={`Pajak (${Number(settings.taxPercent)}%)`}
                  value={formatIDR(totals.tax)}
                />
                {Math.round(totals.taxableExtras) !== 0 ? (
                  <SummaryRow
                    label="Manual Tax/Service"
                    value={formatIDR(totals.taxableExtras)}
                  />
                ) : null}
                <SummaryRow
                  label="Total Tagihan"
                  value={formatIDR(totals.totalCharges)}
                  strong
                />
                <SummaryRow
                  label="Total Dibayar"
                  value={formatIDR(totals.totalPaid)}
                />
                <SummaryRow
                  label="Balance Due"
                  value={formatIDR(totals.balance)}
                  strong
                />
              </div>
            </div>
          </div>
        </StepCard>

        {!isClosed && isCheckoutAllowed && hasBalanceDue ? (
          <StepCard title="FINAL PAYMENT">
            <FinalPaymentForm folioId={folio.id} balance={totals.balance} />
          </StepCard>
        ) : null}

        {!isClosed && isCheckoutAllowed && !hasBalanceDue ? (
          <StepCard title="COMPLETE">
            <CompleteCheckoutForm folioId={folio.id} />
          </StepCard>
        ) : null}

        {!isClosed && !isCheckoutAllowed ? (
          <StepCard title="COMPLETE">
            <div className="p-3.5 text-[12px] text-status-od-fg">
              Folio ini tidak berada pada status check-out aktif.
            </div>
          </StepCard>
        ) : null}

        {isClosed ? (
          <StepCard title="COMPLETE">
            <div className="space-y-3.5 p-3.5">
              <div className="flex items-start gap-3 border border-status-vc-pip bg-status-vc-bg p-3 text-status-vc-fg">
                <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-bold">Check-out selesai</p>
                  <p className="mt-1 text-[12px]">
                    Status: Checked out at{" "}
                    {folio.closedAt ? dateTimeLabel(folio.closedAt) : "-"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href={`/api/folios/${folio.id}/bill`}
                  download
                  className="inline-flex h-8 items-center justify-center gap-2 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Unduh Tagihan
                </a>
                <Link
                  href="/app/fo/tape-chart"
                  className="inline-flex h-8 items-center justify-center gap-2 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to Tape Chart
                </Link>
              </div>
            </div>
          </StepCard>
        ) : null}
      </div>
    </main>
  );
}
