import {
  FolioStatus,
  ReservationStatus,
  type ArticleType,
} from "@prisma/client";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { AlertTriangle, Check, CheckCircle2, Download, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  absoluteBalanceLabel,
  billBalanceAmountLabel,
  billBalanceLabel,
  checkoutBalanceHeading,
  folioBalanceState,
  refundDueNote,
} from "@/lib/folio-balance-display";
import { formatIDR } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
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
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
}

function dateTimeLabel(date: Date) {
  return format(date, "dd MMM yyyy HH:mm", { locale: indonesianLocale });
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
    <section className="border border-console-border bg-console-surface">
      <div className="flex items-center justify-between gap-3 bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        <h2>{title}</h2>
        {meta ? <span className="num text-[10px] text-slate-400">{meta}</span> : null}
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
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={strong ? "text-console-ink" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`num text-right ${strong ? "font-semibold text-console-ink" : "font-medium text-console-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-console-border p-3.5 first:border-r">
      <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
        {label}
      </div>
      <div className="num mt-1 text-[20px] font-semibold text-console-ink">
        {value}
      </div>
    </div>
  );
}

function ZeroBalanceNotice({ balance }: { balance: number }) {
  const balanceState = folioBalanceState(balance);

  if (balanceState === "due") {
    return (
      <div className="mt-3 flex items-start gap-2 border border-red-300 bg-status-od-bg p-3.5 text-status-od-fg">
        <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <div>
          <div className="font-semibold">{checkoutBalanceHeading(balance)}</div>
          <div className="mt-1 text-[12px]">
            Lakukan pembayaran akhir di langkah 2 sebelum check-out dapat
            diselesaikan.
          </div>
        </div>
      </div>
    );
  }

  if (balanceState === "credit") {
    return (
      <div className="mt-3 flex items-start gap-2 border border-status-vd-pip bg-status-vd-bg p-3.5 text-status-vd-fg">
        <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <div>
          <div className="font-semibold">{checkoutBalanceHeading(balance)}</div>
          <div className="mt-1 text-[12px]">{refundDueNote(balance)}</div>
          <div className="mt-1 text-[12px]">
            Check-out dapat dikonfirmasi di langkah 3.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-2 border border-status-vc-pip bg-status-vc-bg p-3.5 text-status-vc-fg">
      <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
      <div>
        <div className="font-semibold">{checkoutBalanceHeading(balance)}</div>
        <div className="mt-1 text-[12px]">
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
}: {
  folio: PreviewFolio;
  settings: PreviewSettings;
  totals: ReturnType<typeof computeFolioTotals>;
}) {
  return (
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {"// Preview Bill"}
      </div>
      <div className="p-3.5 text-[12px]">
        <div className="border-b border-dashed border-slate-300 pb-2 text-center">
          <div className="text-[13px] font-bold uppercase">
            {settings.hotelName}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {settings.address}
          </div>
        </div>

        <div className="space-y-1 py-2">
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

        <div className="border-t border-dashed border-slate-300 pt-2">
          {folio.lineItems.map((lineItem) => (
            <SummaryRow
              key={lineItem.id}
              label={descriptionLabel(lineItem)}
              value={formatIDR(lineItem.amount.toString())}
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

        <div className="mt-2 border-t border-slate-300 pt-2">
          <SummaryRow label="TOTAL" value={formatIDR(totals.totalCharges)} strong />
          <SummaryRow label="Dibayar" value={`-${formatIDR(totals.totalPaid)}`} />
          <div className="flex items-center justify-between gap-3 py-1 font-semibold text-console-ink">
            <span>{billBalanceLabel(totals.balance)}</span>
            <span className="num">{billBalanceAmountLabel(totals.balance)}</span>
          </div>
          {folioBalanceState(totals.balance) === "credit" ? (
            <div className="pt-1 text-[11px] text-status-vd-fg">
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
  const isClosed = folio.status === FolioStatus.CLOSED;
  const isCheckoutAllowed =
    folio.status === FolioStatus.OPEN &&
    folio.reservation.status === ReservationStatus.CHECKED_IN;
  const balanceState = folioBalanceState(totals.balance);
  const hasBalanceDue = balanceState === "due";

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Check-out · {folio.reservation.guest.fullName}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {folio.folioNo} · Kamar {folio.reservation.room?.number ?? "-"} (
            {folio.reservation.roomType.name}) · Departure{" "}
            {dateLabel(folio.reservation.departureDate)}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
            href={`/app/fo/folios/${folio.id}`}
            className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Batal
          </Link>
          <button
            type="submit"
            form="complete-checkout-form"
            disabled={isClosed || !isCheckoutAllowed || hasBalanceDue}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-none border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800 disabled:border-console-border disabled:bg-console-bg disabled:text-slate-400"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Konfirmasi Check-out
          </button>
        </div>
      </div>

      <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          <StepCard title="1. Verifikasi Zero-Balance">
            <div className="p-3.5 text-[13px]">
              <div className="grid overflow-hidden border border-console-border sm:grid-cols-2">
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
              <div className="p-3.5 text-[12px] text-slate-500">
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
            ) : isCheckoutAllowed && !hasBalanceDue ? (
              <CompleteCheckoutForm folioId={folio.id} balance={totals.balance} />
            ) : (
              <div className="p-3.5 text-[12px] text-status-od-fg">
                Folio ini belum siap untuk check-out.
              </div>
            )}
          </StepCard>
        </div>

        <aside className="min-w-0">
          <PreviewBill folio={folio} settings={settings} totals={totals} />
        </aside>
      </div>
    </main>
  );
}
