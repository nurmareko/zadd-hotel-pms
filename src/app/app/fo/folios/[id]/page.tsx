import { ArticleType, FolioStatus } from "@prisma/client";
import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { computeFolioTotals } from "@/lib/folio-totals";
import { formatCompactDateID, formatDayOfMonthID } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AddChargeDialog } from "./add-charge-dialog";
import { FolioCharges } from "./folio-charges";
import { FolioHeader } from "./folio-header";
import { FolioPayments } from "./folio-payments";
import { FolioSummary } from "./folio-summary";
import { RecordPaymentDialog } from "./record-payment-dialog";

export const dynamic = "force-dynamic";

type GuestFolioPageProps = {
  params: Promise<{ id: string }>;
};

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
          Guest Folio
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">{title}</p>
      </div>

      <section className="border border-console-border bg-console-surface">
        <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// Folio Blocked"}
        </div>
        <div className="p-3.5 text-[12px] text-status-od-fg">{message}</div>
      </section>
    </main>
  );
}

function stayRangeLabel(arrivalDate: Date, departureDate: Date) {
  return `${formatDayOfMonthID(arrivalDate)} → ${formatCompactDateID(
    departureDate,
  )}`;
}

export default async function GuestFolioPage({
  params,
}: GuestFolioPageProps) {
  const { id } = await params;
  const folioId = Number(id);

  if (!Number.isInteger(folioId) || folioId <= 0) {
    notFound();
  }

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
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Guest Folio · {folio.reservation.guest.fullName}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
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
            className="inline-flex h-8 items-center justify-center gap-2 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            PDF Bill
          </Link>
          <a
            href={`/api/reservations/${folio.reservationId}/grc`}
            download
            className="inline-flex h-8 items-center justify-center gap-2 border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
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
    </main>
  );
}
