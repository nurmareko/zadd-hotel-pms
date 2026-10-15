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
  { header: "Room", accessor: (row) => row.room.number },
  { header: "Room Type", accessor: (row) => row.room.roomType.name },
  { header: "Reason", accessor: (row) => ROOM_BLOCK_REASON_LABELS[row.reason] },
  { header: "Start Date", accessor: (row) => row.startDate },
  { header: "End Date (Exclusive)", accessor: (row) => row.endDate },
  { header: "Number of Nights", accessor: (row) => row.nights },
  { header: "Status", accessor: (row) => BLOCK_STATUS_LABELS[row.status] },
  { header: "Notes", accessor: (row) => row.note },
  { header: "Created By", accessor: (row) => row.createdBy.fullName },
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Please sign in first.", { status: 401 });
  if (!can(session.user.role as AppRole, "room_blocks:manage")) {
    return new Response("You do not have permission to export room blocks.", { status: 403 });
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
