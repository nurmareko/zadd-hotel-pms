import { ArticleType } from "@prisma/client";
import { notFound } from "next/navigation";

import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";
import { FolioCharges } from "./folio-charges";
import { FolioHeader } from "./folio-header";
import { FolioSummary } from "./folio-summary";

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
          // Folio Blocked
        </div>
        <div className="p-3.5 text-[12px] text-status-od-fg">{message}</div>
      </section>
    </main>
  );
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
            Guest Folio
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Central billing view for in-house guest charges and payments.
          </p>
        </div>
        <p className="num text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          {folio.folioNo}
        </p>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 lg:col-span-2">
          <FolioHeader folio={folio} />
        </div>
        <FolioCharges
          folioId={folio.id}
          status={folio.status}
          lineItems={folio.lineItems}
          articles={chargeArticles}
        />
        <FolioSummary
          folioId={folio.id}
          status={folio.status}
          totals={totals}
          serviceChargePercent={Number(settings.serviceChargePercent)}
          taxPercent={Number(settings.taxPercent)}
        />
      </div>
    </main>
  );
}
