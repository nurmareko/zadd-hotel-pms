import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
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
  const reservationId = Number(id);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return new Response("Invalid reservation id", { status: 400 });
  }

  const [reservation, hotelSettings] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        createdBy: { select: { fullName: true } },
        folio: { select: { folioNo: true } },
        guest: {
          select: {
            fullName: true,
            idType: true,
            idNumber: true,
            phone: true,
            email: true,
            nationality: true,
          },
        },
        room: { select: { number: true } },
        roomType: { select: { name: true } },
        reservationNights: {
          select: { date: true, rateAmount: true },
          orderBy: { date: "asc" },
        },
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!reservation) {
    return new Response("Reservation not found", { status: 404 });
  }

  if (!hotelSettings) {
    return new Response("Hotel settings not found", { status: 500 });
  }

  const stayTotal = flatReservationNightStayTotal({
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    rateAmount: reservation.rateAmount,
    reservationNights: reservation.reservationNights,
  });
  const grcDocument = Grc({
    folio: reservation.folio,
    reservation,
    stayTotal,
    guest: reservation.guest,
    room: reservation.room,
    roomType: reservation.roomType,
    hotelSettings,
  });
  const buffer = await renderToBuffer(grcDocument);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="grc-${reservation.reservationNo}.pdf"`,
    },
  });
}
