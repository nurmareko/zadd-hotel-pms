import { ArticleType, FolioStatus, ReservationStatus } from "@prisma/client";
import { ChevronDown, Download } from "lucide-react";
import Link from "next/link";

import { DepositStatusBadge } from "@/components/deposit-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { folioBalanceState } from "@/lib/folio-balance-display";
import { getArticleDepartmentLabel } from "@/lib/article-departments";
import { formatDecimalID, formatIDR, formatMonthDayTimeID } from "@/lib/format";
import { computeFolioTotals } from "@/lib/folio-totals";

import { prisma } from "@/lib/prisma";
import { STAY_FEE_ARTICLE_CODES } from "@/lib/reservation-stay-fee-definitions";
import { STAY_CHARGE_ARTICLE_CODES } from "@/lib/stay-charges";
import { AddChargeDialog } from "./add-charge-dialog";
import { UnifiedFolioLedger, type FolioLedgerRow } from "./unified-folio-ledger";
import { FolioHeader } from "./folio-header";

import { FolioSummary } from "./folio-summary";
import { RecordPaymentDialog } from "./record-payment-dialog";

type GuestFolioViewProps = {
  folioId: number;
  mode?: "full" | "payments" | "charges";
};

function ErrorState({ message }: { message: string }) {
  return (
    <>
      <section className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-red-800">
          Folio unavailable
        </h2>
        <div className="mt-2 text-sm text-red-600">{message}</div>
      </section>
    </>
  );
}



export async function GuestFolioView({
  folioId,
  mode = "full",
}: GuestFolioViewProps) {
  const [folio, articles, settings] = await Promise.all([
    prisma.folio.findUnique({
      where: { id: folioId },
      include: {
        reservation: {
          include: {
            guest: {
              select: {
                fullName: true,
                phone: true,
              },
            },
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
        payments: {
          include: {
            receivedBy: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.article.findMany({
      where: {
        type: { not: ArticleType.TAX },
        code: {
          notIn: [
            ...STAY_CHARGE_ARTICLE_CODES,
            ...STAY_FEE_ARTICLE_CODES,
          ],
        },
      },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        defaultPrice: true,
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!folio) {
    return (
      <ErrorState message="Folio not found. Check the reservation details before continuing." />
    );
  }

  if (!settings) {
    return (
      <ErrorState message="Hotel settings are unavailable, so folio totals cannot be calculated yet." />
    );
  }

  const totals = computeFolioTotals(folio.lineItems, folio.payments, settings);
  const hasBalanceDue = folioBalanceState(totals.balance) === "due";
  const canContinueToCheckout =
    folio.status === FolioStatus.OPEN &&
    folio.reservation.status === ReservationStatus.CHECKED_IN &&
    !hasBalanceDue;
  const chargeArticles = articles.map((article) => ({
    ...article,
    defaultPrice:
      article.defaultPrice === null ? null : Number(article.defaultPrice),
  }));

  const destinations = folio.status === FolioStatus.OPEN
    ? await prisma.folio.findMany({
        where: { status: FolioStatus.OPEN, id: { not: folio.id } },
        select: {
          id: true,
          folioNo: true,
          reservation: { select: { reservationNo: true, room: { select: { number: true } } } },
        },
        orderBy: { folioNo: "asc" },
      })
    : [];
  const transferFolios = destinations.map((destination) => ({
    id: destination.id,
    label: `${destination.folioNo} · ${destination.reservation.reservationNo} · ${destination.reservation.room ? `Room ${destination.reservation.room.number}` : "Room not assigned"}`,
  }));
  const events = [
    ...folio.lineItems.map((line) => ({ kind: "charges" as const, id: line.id, date: line.postedAt, line })),
    ...folio.payments.map((payment) => ({ kind: "payments" as const, id: payment.id, date: payment.receivedAt, payment })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || a.kind.localeCompare(b.kind) || a.id - b.id);
  const postedLines: typeof folio.lineItems = [];
  const receivedPayments: typeof folio.payments = [];
  let previousTotals = computeFolioTotals([], [], settings);
  const rows: FolioLedgerRow[] = [];
  for (const event of events) {
    if (event.kind === "charges") postedLines.push(event.line);
    else receivedPayments.push(event.payment);
    // Prefix totals preserve implicit tax/service and aggregate rounding. Never sum raw amounts for balances.
    const currentTotals = computeFolioTotals(postedLines, receivedPayments, settings);
    const change = currentTotals.balance - previousTotals.balance;
    const common = {
      key: `${event.kind}-${event.id}`,
      kind: event.kind,
      date: formatMonthDayTimeID(event.date),
      debit: Math.max(0, change),
      credit: Math.max(0, -change),
      balance: currentTotals.balance,
    };
    previousTotals = currentTotals;
    if (event.kind === "charges") {
      const line = event.line;
      rows.push({
        ...common,
        description: line.description || line.article.name,
        detail: `${formatDecimalID(line.quantity.toString())} × ${formatIDR(line.unitPrice.toString())} · Posted amount ${formatIDR(line.amount.toString())}`,
        article: `${line.article.code} · ${line.article.name}`,
        category: getArticleDepartmentLabel(line.article.type),
        tender: "—",
        reference: line.fbOrder ? `Order ${line.fbOrder.orderNo}` : "—",
        operator: line.postedBy.fullName,
        transferLineItemId: folio.status === FolioStatus.OPEN && !line.fbOrderId && line.amount.greaterThanOrEqualTo(0) ? line.id : null,
      });
      continue;
    }
    const payment = event.payment;
    const purpose = { DEPOSIT: "Deposit", PAYMENT: "Payment", SETTLEMENT: "Settlement" }[payment.purpose];
    rows.push({
      ...common,
      description: purpose,
      detail: `Received amount ${formatIDR(payment.amount.toString())}`,
      article: "—",
      category: purpose,
      tender: { CASH: "Cash", TRANSFER: "Bank transfer", CARD: "Card", CHARGE_TO_ROOM: "Charge to room" }[payment.method],
      reference: payment.reference || "—",
      operator: payment.receivedBy.fullName,
      transferLineItemId: null,
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2 sm:justify-end">
        <AddChargeDialog
          folioId={folio.id}
          articles={chargeArticles}
          disabled={folio.status !== FolioStatus.OPEN}
          variant="outline"
        />
        <RecordPaymentDialog
          folioId={folio.id}
          balance={totals.balance}
          disabled={folio.status !== FolioStatus.OPEN || !hasBalanceDue}
        />
        <details className="group relative">
          <summary
            className={`${buttonVariants({ variant: "outline" })} cursor-pointer list-none group-open:bg-slate-50 [&::-webkit-details-marker]:hidden`}
          >
            Export
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className="absolute right-0 z-10 mt-2 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-md">
            <a
              href={`/api/folios/${folio.id}/bill`}
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-slate-900 hover:bg-slate-50 desktop:min-h-10"
            >
              <Download aria-hidden="true" />
              Bill PDF
            </a>
            <a
              href={`/api/reservations/${folio.reservationId}/grc`}
              download
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-slate-900 hover:bg-slate-50 desktop:min-h-10"
            >
              <Download aria-hidden="true" />
              Print GRC
            </a>
          </div>
        </details>

        {canContinueToCheckout ? (
          <Link
            href={`/app/fo/check-out/${folio.id}`}
            className={`${buttonVariants({ variant: "default" })} order-first sm:order-none`}
          >
            Proceed to Check-out
          </Link>
        ) : null}
      </div>

      <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-3">
        <FolioSummary totals={totals} variant="detailed" />
        <FolioHeader folio={folio} variant="metadata" />
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">Deposit</h2>
          <div className="flex items-center justify-between gap-3 p-5 text-sm">
            <span className="text-slate-500">Deposit status</span>
            <DepositStatusBadge status={folio.reservation.depositStatus} />
          </div>
        </section>
      </div>
      <UnifiedFolioLedger
        key={`${folio.id}-${mode}`}
        rows={rows}
        initialFilter={mode === "full" ? "all" : mode}
        transferFolios={transferFolios}
        folioId={folio.id}
        balance={totals.balance}
      />
    </>
  );
}
