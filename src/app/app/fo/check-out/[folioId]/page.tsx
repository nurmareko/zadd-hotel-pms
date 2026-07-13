import {
  FolioStatus,
  ReservationStatus,
  type ArticleType,
} from "@prisma/client";
import { AlertTriangle, CheckCircle2, Download, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  absoluteBalanceLabel,
  billBalanceAmountLabel,
  billBalanceLabel,
  checkoutBalanceHeading,
  folioBalanceState,
  refundDueNote,
} from "@/lib/folio-balance-display";
import { formatDateID, formatDateTimeID, formatIDR } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import {
  buildPendingStayChargeLines,
  type PendingStayChargeLine,
  STAY_CHARGE_ARTICLE_CODES,
} from "@/lib/stay-charges";
import { CompleteCheckoutForm, FinalPaymentForm } from "./checkout-forms";

export const dynamic = "force-dynamic";

type CheckOutPageProps = {
  params: Promise<{ folioId: string }>;
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

type PreviewFolio = {
  folioNo: string;
  reservation: {
    guest: { fullName: string };
    room: { number: string } | null;
    roomType: { name: string };
    arrivalDate: Date;
    departureDate: Date;
  };
  lineItems: ChargeLineItem[];
};

type PreviewSettings = {
  hotelName: string;
  address: string | null;
  serviceChargePercent: { toString(): string } | number;
  taxPercent: { toString(): string } | number;
};

function dateLabel(date: Date) {
  return formatDateID(date);
}

function dateTimeLabel(date: Date) {
  return formatDateTimeID(date);
}

function descriptionLabel(lineItem: ChargeLineItem) {
  const base = lineItem.description || lineItem.article.name;

  return lineItem.fbOrder ? `${base} - Order ${lineItem.fbOrder.orderNo}` : base;
}

function StepCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 rounded-t-lg border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-700">
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta ? <span className="text-xs font-medium text-slate-500">{meta}</span> : null}
      </div>
      {children}
    </section>
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
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={strong ? "text-slate-900 font-semibold" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`text-right ${strong ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-slate-200 p-5 first:border-r">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function ZeroBalanceNotice({ balance }: { balance: number }) {
  const balanceState = folioBalanceState(balance);

  if (balanceState === "due") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-semibold text-sm">{checkoutBalanceHeading(balance)}</div>
          <div className="mt-1 text-xs text-red-600">
            Lakukan pembayaran akhir di langkah 2 sebelum check-out dapat
            diselesaikan.
          </div>
        </div>
      </div>
    );
  }

  if (balanceState === "credit") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-semibold text-sm">{checkoutBalanceHeading(balance)}</div>
          <div className="mt-1 text-xs text-amber-700">{refundDueNote(balance)}</div>
          <div className="mt-1 text-xs text-amber-700">
            Check-out dapat dikonfirmasi di langkah 3.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <div className="font-semibold text-sm">{checkoutBalanceHeading(balance)}</div>
        <div className="mt-1 text-xs text-emerald-700">
          Check-out dapat dikonfirmasi di langkah 3.
        </div>
      </div>
    </div>
  );
}

function PreviewBill({
  folio,
  settings,
  totals,
  pendingLines,
}: {
  folio: PreviewFolio;
  settings: PreviewSettings;
  totals: ReturnType<typeof computeFolioTotals>;
  pendingLines: PendingStayChargeLine[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700">
        {"Preview Bill"}
      </div>
      <div className="p-5 text-sm">
        <div className="border-b border-slate-100 pb-3 text-center">
          <div className="text-sm font-bold uppercase text-slate-800">
            {settings.hotelName}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {settings.address}
          </div>
        </div>

        <div className="space-y-1 py-3">
          <SummaryRow label="Folio" value={folio.folioNo} />
          <SummaryRow label="Tamu" value={folio.reservation.guest.fullName} />
          <SummaryRow
            label="Kamar"
            value={`${folio.reservation.room?.number ?? "-"} / ${folio.reservation.roomType.name}`}
          />
          <SummaryRow
            label="Periode"
            value={`${dateLabel(folio.reservation.arrivalDate)} - ${dateLabel(
              folio.reservation.departureDate,
            )}`}
          />
        </div>

        <div className="border-t border-slate-100 pt-3">
          {folio.lineItems.map((lineItem) => (
            <SummaryRow
              key={lineItem.id}
              label={descriptionLabel(lineItem)}
              value={formatIDR(lineItem.amount.toString())}
            />
          ))}
          {pendingLines.map((line, index) => (
            <SummaryRow
              key={`pending-${index}`}
              label={`${line.description} (belum diposting)`}
              value={formatIDR(line.amount.toString())}
            />
          ))}
          <SummaryRow
            label={`Service charge ${Number(settings.serviceChargePercent)}%`}
            value={formatIDR(totals.serviceCharge)}
          />
          <SummaryRow
            label={`VAT ${Number(settings.taxPercent)}%`}
            value={formatIDR(totals.tax)}
          />
        </div>

        <div className="mt-2 border-t border-slate-200 pt-3">
          <SummaryRow label="TOTAL" value={formatIDR(totals.totalCharges)} strong />
          <SummaryRow label="Dibayar" value={`-${formatIDR(totals.totalPaid)}`} />
          <div className="flex items-center justify-between gap-3 py-1.5 font-semibold text-slate-900">
            <span>{billBalanceLabel(totals.balance)}</span>
            <span className="text-right">{billBalanceAmountLabel(totals.balance)}</span>
          </div>
          {folioBalanceState(totals.balance) === "credit" ? (
            <div className="pt-1 text-xs text-amber-600">
              {refundDueNote(totals.balance)}
            </div>
          ) : null}
        </div>
      </div>
    </section>
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
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Check-Out
        </h1>
        <p className="mt-1 text-sm text-slate-500">{title}</p>
      </div>

      <StepCard title="Check-Out Blocked">
        <div className="p-5 text-sm text-red-600">{message}</div>
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

  const [folio, settings, stayChargeArticles] = await Promise.all([
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
    prisma.article.findMany({
      where: { code: { in: [...STAY_CHARGE_ARTICLE_CODES] } },
      select: { id: true, code: true, name: true, type: true, defaultPrice: true },
    }),
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

  const isClosed = folio.status === FolioStatus.CLOSED;
  const isCheckoutAllowed =
    folio.status === FolioStatus.OPEN &&
    folio.reservation.status === ReservationStatus.CHECKED_IN;

  // Project the stay charges the night audit has not yet posted for the nights
  // already stayed, so the screen shows the true amount owed (and disables
  // check-out) even before the night audit runs. The check-out actions post
  // these for real before judging the balance server-side.
  const pendingStayCharges = isCheckoutAllowed
    ? buildPendingStayChargeLines({
        arrangementType: folio.reservation.arrangementType,
        rateAmount: folio.reservation.rateAmount,
        arrivalDate: folio.reservation.arrivalDate,
        lineItems: folio.lineItems,
        articles: stayChargeArticles,
      })
    : [];

  const totals = computeFolioTotals(
    [...folio.lineItems, ...pendingStayCharges] as Parameters<
      typeof computeFolioTotals
    >[0],
    folio.payments,
    settings,
  );
  const balanceState = folioBalanceState(totals.balance);
  const hasBalanceDue = balanceState === "due";

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-4 text-slate-900 md:px-6 md:py-5">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Check-out · {folio.reservation.guest.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {folio.folioNo} · Kamar {folio.reservation.room?.number ?? "-"} (
            {folio.reservation.roomType.name}) · Departure{" "}
            {dateLabel(folio.reservation.departureDate)}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
                      href={`/app/fo/folios/${folio.id}`}
                      className={buttonVariants({ variant: "outline" })}
                    >
            Batal
          </Link>
        </div>
      </div>

      <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          <StepCard title="1. Verifikasi Zero-Balance">
            <div className="p-5 text-sm">
              <div className="grid overflow-hidden border border-slate-200 rounded-lg sm:grid-cols-2">
                <MetricBox
                  label="Total Charges"
                  value={formatIDR(totals.totalCharges)}
                />
                <MetricBox
                  label="Total Payments"
                  value={formatIDR(totals.totalPaid)}
                />
              </div>
              <ZeroBalanceNotice balance={totals.balance} />
            </div>
          </StepCard>

          {!isClosed && isCheckoutAllowed && hasBalanceDue ? (
            <StepCard
              title="2. Pembayaran Akhir"
              meta={checkoutBalanceHeading(totals.balance)}
            >
              <FinalPaymentForm folioId={folio.id} balance={totals.balance} />
            </StepCard>
          ) : (
            <StepCard title="2. Pembayaran Akhir">
              <div className="p-5 text-sm text-slate-500">
                {balanceState === "credit"
                  ? `Tidak ada pembayaran akhir yang perlu dicatat. Kembalikan kelebihan ${absoluteBalanceLabel(
                      totals.balance,
                    )} kepada tamu.`
                  : "Tidak ada pembayaran akhir yang perlu dicatat."}
              </div>
            </StepCard>
          )}

          <StepCard title="3. Aksi Setelah Check-out">
            {isClosed ? (
              <div className="space-y-4 p-5">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold">Check-out selesai</p>
                    <p className="mt-1 text-xs text-emerald-600">
                      Status: Checked out at{" "}
                      {folio.closedAt ? dateTimeLabel(folio.closedAt) : "-"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                                      href={`/api/folios/${folio.id}/bill`}
                                      download
                                      className={buttonVariants({ variant: "default" })}
                                    >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Unduh Tagihan
                  </a>
                  <Link
                                      href="/app/fo/reservasi/kalender"
                                      className={buttonVariants({ variant: "outline" })}
                                    >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    Back to Tape Chart
                  </Link>
                </div>
              </div>
            ) : isCheckoutAllowed && !hasBalanceDue ? (
              <CompleteCheckoutForm folioId={folio.id} balance={totals.balance} />
            ) : (
              <div className="p-5 text-sm text-red-600">
                Folio ini belum siap untuk check-out.
              </div>
            )}
          </StepCard>
        </div>

        <aside className="min-w-0">
          <PreviewBill
            folio={folio}
            settings={settings}
            totals={totals}
            pendingLines={pendingStayCharges}
          />
        </aside>
      </div>
    </main>
  );
}
