import { createHash, timingSafeEqual } from "node:crypto";

import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { flatReservationNightStayTotal } from "@/lib/flat-reservation-night-total";
import {
  GRC_TEMPLATE_VERSION,
  GrcSnapshotSchema,
} from "@/lib/grc-snapshot";
import { Grc } from "@/lib/pdf/grc";
import { prisma } from "@/lib/prisma";

const LEGACY_SIGNED_MESSAGE =
  "GRC bertanda tangan tidak dapat dibuat karena snapshot bertanda tangan tidak tersedia untuk reservasi ini.";
const INVALID_SNAPSHOT_MESSAGE =
  "GRC bertanda tangan tidak dapat dibuat karena snapshot tersimpan tidak valid.";
const UNSUPPORTED_TEMPLATE_MESSAGE =
  "GRC bertanda tangan tidak dapat dibuat karena versi template snapshot tidak didukung.";
const SIGNATURE_INTEGRITY_MESSAGE =
  "GRC bertanda tangan tidak dapat dibuat karena verifikasi integritas tanda tangan gagal.";

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function snapshotTemplateVersion(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return Reflect.get(value, "templateVersion");
}

function signatureMatches(signatureDataUrl: string, expectedSha256: string) {
  const actual = Buffer.from(
    createHash("sha256").update(signatureDataUrl, "utf8").digest("hex"),
    "hex",
  );
  const expected = Buffer.from(expectedSha256, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

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
    return textResponse("ID reservasi tidak valid.", 400);
  }

  const storedGrc = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      signedAt: true,
      grcSnapshot: true,
      signatureDataUrl: true,
    },
  });

  if (!storedGrc) {
    return textResponse("Reservasi tidak ditemukan.", 404);
  }

  if (storedGrc.signedAt !== null) {
    if (storedGrc.grcSnapshot === null) {
      return textResponse(LEGACY_SIGNED_MESSAGE, 409);
    }

    const templateVersion = snapshotTemplateVersion(storedGrc.grcSnapshot);
    if (
      typeof templateVersion === "number" &&
      templateVersion !== GRC_TEMPLATE_VERSION
    ) {
      return textResponse(UNSUPPORTED_TEMPLATE_MESSAGE, 422);
    }

    const snapshotResult = GrcSnapshotSchema.safeParse(storedGrc.grcSnapshot);
    if (!snapshotResult.success) {
      return textResponse(INVALID_SNAPSHOT_MESSAGE, 422);
    }

    if (
      storedGrc.signatureDataUrl === null ||
      !signatureMatches(
        storedGrc.signatureDataUrl,
        snapshotResult.data.signatureSha256,
      )
    ) {
      return textResponse(SIGNATURE_INTEGRITY_MESSAGE, 422);
    }

    const buffer = await renderToBuffer(
      Grc({
        source: {
          kind: "snapshot",
          snapshot: snapshotResult.data,
          signatureDataUrl: storedGrc.signatureDataUrl,
        },
      }),
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="grc-${snapshotResult.data.reservation.reservationNo}.pdf"`,
      },
    });
  }

  const [reservation, hotelSettings] = await Promise.all([
    prisma.reservation.findFirst({
      where: { id: reservationId, signedAt: null },
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
    prisma.hotelSettings.findUnique({
      where: { id: 1 },
      select: { address: true },
    }),
  ]);

  if (!reservation) {
    return textResponse(
      "Status tanda tangan GRC berubah. Silakan unduh GRC kembali.",
      409,
    );
  }

  if (!hotelSettings) {
    return textResponse("Pengaturan hotel tidak ditemukan.", 500);
  }

  const stayTotal = flatReservationNightStayTotal({
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    rateAmount: reservation.rateAmount,
    reservationNights: reservation.reservationNights,
  });
  const buffer = await renderToBuffer(
    Grc({
      source: {
        kind: "live",
        folio: reservation.folio,
        reservation,
        stayTotal,
        guest: reservation.guest,
        room: reservation.room,
        roomType: reservation.roomType,
        hotelAddress: hotelSettings.address,
      },
    }),
  );
  const remainsUnsigned = await prisma.reservation.findFirst({
    where: { id: reservationId, signedAt: null },
    select: { id: true },
  });

  if (!remainsUnsigned) {
    return textResponse(
      "Status tanda tangan GRC berubah. Silakan unduh GRC kembali.",
      409,
    );
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="grc-${reservation.reservationNo}.pdf"`,
    },
  });
}
