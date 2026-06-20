import { ArticleType, FolioStatus } from "@prisma/client";
import { Download } from "lucide-react";
import Link from "next/link";

import { consoleButtonClassName } from "@/components/console-button";
import { computeFolioTotals } from "@/lib/folio-totals";
import { formatCompactDateID, formatDayOfMonthID } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AddChargeDialog } from "./add-charge-dialog";
import { FolioCharges } from "./folio-charges";
import { FolioHeader } from "./folio-header";
import { FolioPayments } from "./folio-payments";
import { FolioSummary } from "./folio-summary";
import { RecordPaymentDialog } from "./record-payment-dialog";

type GuestFolioViewProps = {
  folioId: number;
};

function ErrorState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Guest Folio
        </h1>
        <p className="mt-1 text-sm text-slate-500">{title}</p>
      </div>

      <section className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-red-800">
          Folio Blocked
        </h2>
        <div className="mt-2 text-sm text-red-600">{message}</div>
      </section>
    </>
  );
}

function stayRangeLabel(arrivalDate: Date, departureDate: Date) {
  return `${formatDayOfMonthID(arrivalDate)} → ${formatCompactDateID(
    departureDate,
  )}`;
}

export async function GuestFolioView({ folioId }: GuestFolioViewProps) {
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
      where: { type: { not: ArticleType.TAX } },
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
      <ErrorState
        title={`folioId=${folioId}`}
        message="Folio tidak ditemukan. Periksa data reservasi sebelum melanjutkan."
      />
    );
  }

  if (!settings) {
    return (
      <ErrorState
        title={folio.folioNo}
        message="Hotel settings belum tersedia, sehingga total folio belum bisa dihitung."
      />
    );
  }

  const totals = computeFolioTotals(folio.lineItems, folio.payments, settings);
  const chargeArticles = articles.map((article) => ({
    ...article,
    defaultPrice:
      article.defaultPrice === null ? null : Number(article.defaultPrice),
  }));

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Guest Folio · {folio.reservation.guest.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {folio.folioNo} · Kamar {folio.reservation.room?.number ?? "-"} (
            {folio.reservation.roomType.name}) ·{" "}
            {stayRangeLabel(
              folio.reservation.arrivalDate,
              folio.reservation.departureDate,
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={`/api/folios/${folio.id}/bill`}
            className={consoleButtonClassName("secondary")}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            PDF Bill
          </Link>
          <a
            href={`/api/reservations/${folio.reservationId}/grc`}
            download
            className={consoleButtonClassName("secondary")}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Cetak GRC
          </a>
          <AddChargeDialog
            folioId={folio.id}
            articles={chargeArticles}
            disabled={folio.status !== FolioStatus.OPEN}
          />
          <RecordPaymentDialog
            folioId={folio.id}
            balance={totals.balance}
            disabled={folio.status !== FolioStatus.OPEN}
          />
        </div>
      </div>

      <div className="grid max-w-6xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <FolioCharges status={folio.status} lineItems={folio.lineItems} />
          <FolioPayments payments={folio.payments} />
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <FolioHeader folio={folio} />
          <FolioSummary
            folioId={folio.id}
            status={folio.status}
            reservationStatus={folio.reservation.status}
            totals={totals}
          />
        </aside>
      </div>
    </>
  );
}
