import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { Bill } from "@/lib/pdf/bill";
import { computeFolioTotals } from "@/lib/folio-totals";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!["FO", "ACC", "ADMIN"].includes(session.user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const folioId = Number(id);

  if (!Number.isInteger(folioId) || folioId <= 0) {
    return new Response("Invalid folio id", { status: 400 });
  }

  const [folio, settings] = await Promise.all([
    prisma.folio.findUnique({
      where: { id: folioId },
      include: {
        reservation: {
          include: {
            guest: { select: { fullName: true } },
            room: { select: { number: true } },
          },
        },
        lineItems: {
          include: {
            article: true,
          },
          orderBy: { postedAt: "asc" },
        },
        payments: {
          orderBy: { receivedAt: "asc" },
        },
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!folio) {
    return new Response("Folio not found", { status: 404 });
  }

  if (!settings) {
    return new Response("Hotel settings not found", { status: 500 });
  }

  const totals = computeFolioTotals(folio.lineItems, folio.payments, settings);
  const billDocument = Bill({
    folio,
    settings,
    totals,
    businessDate: new Date(),
  });
  const buffer = await renderToBuffer(billDocument);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bill-${folio.folioNo}.pdf"`,
    },
  });
}
