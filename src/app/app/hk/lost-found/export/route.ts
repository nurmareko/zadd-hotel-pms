import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { auth } from "@/auth";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { hotelTodayISO } from "@/lib/date-only";
import { canAccessLostFound } from "@/lib/lost-found/access";
import { buildLostFoundWhere, parseLostFoundFilters } from "@/lib/lost-found/filters";
import { LOST_FOUND_CATEGORY_LABELS, LOST_FOUND_STATUS_LABELS } from "@/lib/lost-found/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Claimant data belongs to this restricted custody export; do not load user profiles.
const select = {
  referenceCode: true,
  category: true,
  description: true,
  room: { select: { number: true } },
  locationDetails: true,
  foundBy: { select: { fullName: true } },
  createdAt: true,
  status: true,
  claimantName: true,
  claimantPhone: true,
  claimantIdNumber: true,
  returnedBy: { select: { fullName: true } },
  returnedAt: true,
  resolution: true,
  disposedBy: { select: { fullName: true } },
  disposedAt: true,
  disposalReason: true,
} satisfies Prisma.LostFoundItemSelect;

type RegistryRow = Prisma.LostFoundItemGetPayload<{ select: typeof select }>;

const columns: CsvColumn<RegistryRow>[] = [
  { header: "Kode Referensi", accessor: (row) => row.referenceCode },
  { header: "Kategori", accessor: (row) => LOST_FOUND_CATEGORY_LABELS[row.category] },
  { header: "Deskripsi", accessor: (row) => row.description },
  { header: "Kamar", accessor: (row) => row.room?.number },
  { header: "Detail Lokasi", accessor: (row) => row.locationDetails },
  { header: "Ditemukan Oleh", accessor: (row) => row.foundBy.fullName },
  { header: "Waktu Dicatat (UTC)", accessor: (row) => row.createdAt },
  { header: "Status", accessor: (row) => LOST_FOUND_STATUS_LABELS[row.status] },
  { header: "Nama Pengambil", accessor: (row) => row.claimantName },
  { header: "Nomor Telepon Pengambil", accessor: (row) => row.claimantPhone },
  { header: "Nomor Identitas Pengambil", accessor: (row) => row.claimantIdNumber },
  { header: "Dikembalikan Oleh", accessor: (row) => row.returnedBy?.fullName },
  { header: "Waktu Pengembalian (UTC)", accessor: (row) => row.returnedAt },
  { header: "Catatan Penyelesaian", accessor: (row) => row.resolution },
  { header: "Dimusnahkan / Dihibahkan Oleh", accessor: (row) => row.disposedBy?.fullName },
  { header: "Waktu Pemusnahan / Hibah (UTC)", accessor: (row) => row.disposedAt },
  { header: "Alasan Pemusnahan / Hibah", accessor: (row) => row.disposalReason },
];

function errorResponse(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return errorResponse("Silakan masuk terlebih dahulu.", 401);
  if (!(await canAccessLostFound(session.user))) {
    return errorResponse("Anda tidak memiliki akses untuk mengekspor daftar barang temuan.", 403);
  }

  const searchParams = new URL(request.url).searchParams;
  const params = Object.fromEntries(
    [...new Set(searchParams.keys())].map((key) => [key, searchParams.getAll(key)]),
  );
  let where: Prisma.LostFoundItemWhereInput;
  try {
    where = buildLostFoundWhere(parseLostFoundFilters(params));
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      // Zod unions wrap the domain's Indonesian message in a generic English issue.
      const message = issue?.code === "invalid_union" ? issue.errors[0]?.[0]?.message : issue?.message;
      return errorResponse(message ?? "Filter tidak valid.", 400);
    }
    throw error;
  }

  const rows = await prisma.lostFoundItem.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select,
  });
  return createCsvResponse(generateCsv(columns, rows), `lost-found-${hotelTodayISO()}.csv`);
}
