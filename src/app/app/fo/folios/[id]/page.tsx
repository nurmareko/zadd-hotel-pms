import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type GuestFolioRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function GuestFolioRedirectPage({
  params,
}: GuestFolioRedirectPageProps) {
  const { id } = await params;
  const folioId = Number(id);

  if (!Number.isInteger(folioId) || folioId <= 0) {
    notFound();
  }

  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    select: { reservationId: true },
  });

  if (!folio) {
    notFound();
  }

  redirect(`/app/fo/reservasi/${folio.reservationId}?tab=tagihan`);
}
