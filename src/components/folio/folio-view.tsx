import { ArticleType, FolioStatus, ReservationStatus } from "@prisma/client";
import { ChevronDown, Download } from "lucide-react";
import Link from "next/link";

import { DepositStatusBadge } from "@/components/deposit-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { folioBalanceState } from "@/lib/folio-balance-display";
import { computeFolioTotals } from "@/lib/folio-totals";

import { prisma } from "@/lib/prisma";
import { STAY_FEE_ARTICLE_CODES } from "@/lib/reservation-stay-fee-definitions";
import { STAY_CHARGE_ARTICLE_CODES } from "@/lib/stay-charges";
import { AddChargeDialog } from "./add-charge-dialog";
import { FolioCharges } from "./folio-charges";
import { FolioHeader } from "./folio-header";
import { FolioPayments } from "./folio-payments";
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
          Folio tidak tersedia
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
        defaultPrice: true,
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!folio) {
    return (
      <ErrorState message="Folio tidak ditemukan. Periksa data reservasi sebelum melanjutkan." />
    );
  }

  if (!settings) {
    return (
      <ErrorState message="Pengaturan hotel belum tersedia, sehingga total folio belum bisa dihitung." />
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

  if (mode === "payments") {
    return (
      <>
        {hasBalanceDue && folio.status === FolioStatus.OPEN ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 sm:justify-end">
            <RecordPaymentDialog
              folioId={folio.id}
              balance={totals.balance}
              disabled={false}
            />
          </div>
        ) : null}
        <div className="grid max-w-6xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <FolioPayments payments={folio.payments} />
          <aside className="flex min-w-0 flex-col gap-3">
            <FolioSummary totals={totals} variant="payment" />
            <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
                Deposit
              </div>
              <div className="flex items-center justify-between gap-3 p-5 text-sm">
                <span className="text-slate-500">Status deposit</span>
                <DepositStatusBadge status={folio.reservation.depositStatus} />
              </div>
            </section>
          </aside>
        </div>
      </>
    );
  }

  if (mode === "charges") {
    return (
      <>
        <div className="mb-6 flex flex-wrap items-center gap-2 sm:justify-end">
          <AddChargeDialog
            folioId={folio.id}
            articles={chargeArticles}
            disabled={folio.status !== FolioStatus.OPEN}
            variant="outline"
          />
          <a
            href={`/api/folios/${folio.id}/bill`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download aria-hidden="true" />
            PDF Bill
          </a>
          {canContinueToCheckout ? (
            <Link
              href={`/app/fo/check-out/${folio.id}`}
              className={`${buttonVariants({ variant: "default" })} order-first sm:order-none`}
            >
              Lanjut ke Check-Out
            </Link>
          ) : null}
        </div>
        <div className="grid max-w-6xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <FolioCharges status={folio.status} lineItems={folio.lineItems} />
          <aside className="flex min-w-0 flex-col gap-3">
            <FolioHeader folio={folio} variant="metadata" />
            <FolioSummary totals={totals} variant="detailed" />
          </aside>
        </div>
      </>
    );
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
        <details className="group relative">
          <summary
            className={`${buttonVariants({ variant: "outline" })} cursor-pointer list-none group-open:bg-slate-50 [&::-webkit-details-marker]:hidden`}
          >
            Ekspor
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className="absolute right-0 z-10 mt-2 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-md">
            <a
              href={`/api/folios/${folio.id}/bill`}
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-slate-900 hover:bg-slate-50 desktop:min-h-10"
            >
              <Download aria-hidden="true" />
              PDF Bill
            </a>
            <a
              href={`/api/reservations/${folio.reservationId}/grc`}
              download
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-slate-900 hover:bg-slate-50 desktop:min-h-10"
            >
              <Download aria-hidden="true" />
              Cetak GRC
            </a>
          </div>
        </details>
        {hasBalanceDue && folio.status === FolioStatus.OPEN ? (
          <div className="order-first sm:order-none">
            <RecordPaymentDialog
              folioId={folio.id}
              balance={totals.balance}
              disabled={false}
            />
          </div>
        ) : null}
        {canContinueToCheckout ? (
          <Link
            href={`/app/fo/check-out/${folio.id}`}
            className={`${buttonVariants({ variant: "default" })} order-first sm:order-none`}
          >
            Lanjut ke Check-Out
          </Link>
        ) : null}
      </div>

      <div className="grid max-w-6xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <FolioCharges status={folio.status} lineItems={folio.lineItems} />
          <FolioPayments payments={folio.payments} />
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <FolioHeader folio={folio} />
          <FolioSummary totals={totals} />
        </aside>
      </div>
    </>
  );
}
