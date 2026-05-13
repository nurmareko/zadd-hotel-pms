import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { Grc } from "@/lib/pdf/grc";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (session.user.role !== "FO") {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const folioId = Number(id);

  if (!Number.isInteger(folioId) || folioId <= 0) {
    return new Response("Invalid folio id", { status: 400 });
  }

  const [folio, hotelSettings] = await Promise.all([
    prisma.folio.findUnique({
      where: { id: folioId },
      include: {
        reservation: {
          include: {
            createdBy: { select: { fullName: true } },
            guest: {
              select: {
                fullName: true,
                idNumber: true,
                phone: true,
                email: true,
                nationality: true,
              },
            },
            room: { select: { number: true } },
            roomType: { select: { name: true } },
          },
        },
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!folio) {
    return new Response("Folio not found", { status: 404 });
  }

  if (!hotelSettings) {
    return new Response("Hotel settings not found", { status: 500 });
  }

  if (!folio.reservation.grcFilledAt) {
    return new Response("GRC has not been filled", { status: 409 });
  }

  const grcDocument = Grc({
    folio,
    reservation: folio.reservation,
    guest: folio.reservation.guest,
    room: folio.reservation.room,
    roomType: folio.reservation.roomType,
    hotelSettings,
  });
  const buffer = await renderToBuffer(grcDocument);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="grc-${folio.reservation.reservationNo}.pdf"`,
    },
  });
}
