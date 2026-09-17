import { RoomStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { hotelTodayISO, isValidISODateOnly, parseISODateOnly } from "@/lib/date-only";
import { getHousekeepingListData, type HousekeepingListRow } from "@/lib/housekeeping-list-data";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";

export const dynamic = "force-dynamic";

const filterSchema = z.object({
  date: z.string().refine(isValidISODateOnly).transform(parseISODateOnly).optional(),
  q: z.string().trim().default(""),
  status: z.nativeEnum(RoomStatus).optional(),
  priority: z.enum(["P1", "P2", "P3", "P4", "P5"]).optional(),
  sortBy: z.enum(["priority", "room", "floor", "status", "assignee"]).default("priority"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const columns: CsvColumn<HousekeepingListRow>[] = [
  { header: "Kode Tugas", accessor: (row) => row.taskCode },
  { header: "Kamar", accessor: (row) => row.room.number },
  { header: "Lantai", accessor: (row) => row.room.floor },
  { header: "Tipe Kamar", accessor: (row) => row.room.typeName },
  { header: "Prioritas", accessor: (row) => `${row.priority} - ${PRIORITY_CONFIG[row.priority].label}` },
  { header: "Status", accessor: (row) => row.room.status },
  { header: "Petugas", accessor: (row) => row.assignedHousekeeper?.name },
  {
    header: "Konteks Tamu",
    accessor: (row) => row.reservationContexts.map((context) => [
      `${context.label}: ${context.guestName} (${context.reservationNo})`,
      context.nightsLabel,
      context.etaLabel ? `ETA ${context.etaLabel}` : null,
    ].filter(Boolean).join(" · ")).join(" | "),
  },
  { header: "Catatan", accessor: (row) => [row.taskNote, row.note?.notes].filter(Boolean).join(" | ") },
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Silakan masuk terlebih dahulu.", { status: 401 });
  }
  if (!["HK", "ADMIN"].includes(session.user.role)) {
    return new Response("Anda tidak memiliki akses untuk mengekspor papan kamar.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  for (const key of Object.keys(filterSchema.shape)) {
    if (params.getAll(key).length > 1) {
      return new Response("Filter tidak boleh diulang.", { status: 400 });
    }
  }
  const parsed = filterSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    return new Response("Filter ekspor papan kamar tidak valid.", { status: 400 });
  }

  const { rows } = await getHousekeepingListData(parsed.data);
  return createCsvResponse(generateCsv(columns, rows), `papan-kamar-${hotelTodayISO()}.csv`);
}
