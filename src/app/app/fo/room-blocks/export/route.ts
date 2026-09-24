import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { hotelTodayISO } from "@/lib/date-only";
import { ROOM_BLOCK_REASON_LABELS } from "@/lib/room-blocks/overlap";
import { BLOCK_STATUS_LABELS, parseBlockFilters, type FilterParams } from "../filters";
import { findRoomBlocks, type RoomBlockRow } from "../queries";

export const dynamic = "force-dynamic";

const columns: CsvColumn<RoomBlockRow>[] = [
  { header: "Kamar", accessor: (row) => row.room.number },
  { header: "Tipe Kamar", accessor: (row) => row.room.roomType.name },
  { header: "Alasan", accessor: (row) => ROOM_BLOCK_REASON_LABELS[row.reason] },
  { header: "Tanggal Mulai", accessor: (row) => row.startDate },
  { header: "Tanggal Selesai (Eksklusif)", accessor: (row) => row.endDate },
  { header: "Jumlah Malam", accessor: (row) => row.nights },
  { header: "Status", accessor: (row) => BLOCK_STATUS_LABELS[row.status] },
  { header: "Catatan", accessor: (row) => row.note },
  { header: "Dibuat Oleh", accessor: (row) => row.createdBy.fullName },
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Silakan masuk terlebih dahulu.", { status: 401 });
  if (!can(session.user.role as AppRole, "room_blocks:manage")) {
    return new Response("Anda tidak memiliki akses untuk mengekspor blokir kamar.", { status: 403 });
  }
  const search = new URL(request.url).searchParams;
  const params: FilterParams = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    params[key] = values.length === 1 ? values[0] : values;
  }
  const parsed = parseBlockFilters(params);
  if (!parsed.ok) return new Response(parsed.error, { status: 400 });
  const rows = await findRoomBlocks(parsed.filters);
  return createCsvResponse(generateCsv(columns, rows), `daftar-blokir-kamar-${hotelTodayISO()}.csv`);
}
