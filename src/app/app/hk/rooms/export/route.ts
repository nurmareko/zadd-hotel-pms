import { RoomStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
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
  { header: "Task Code", accessor: (row) => row.taskCode },
  { header: "Room", accessor: (row) => row.room.number },
  { header: "Floor", accessor: (row) => row.room.floor },
  { header: "Room Type", accessor: (row) => row.room.typeName },
  { header: "Priority", accessor: (row) => `${row.priority} - ${PRIORITY_CONFIG[row.priority].label}` },
  { header: "Status", accessor: (row) => row.room.status },
  { header: "Staff", accessor: (row) => row.assignedHousekeeper?.name },
  {
    header: "Guest Details",
    accessor: (row) => row.reservationContexts.map((context) => [
      `${context.label}: ${context.guestName} (${context.reservationNo})`,
      context.nightsLabel,
      context.etaLabel ? `ETA ${context.etaLabel}` : null,
    ].filter(Boolean).join(" · ")).join(" | "),
  },
  { header: "Notes", accessor: (row) => [row.taskNote, row.note?.notes].filter(Boolean).join(" | ") },
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Please sign in first.", { status: 401 });
  }
  if (!can(session.user.role as AppRole, "rooms:clean")) {
    return new Response("You do not have permission to export the room board.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  for (const key of Object.keys(filterSchema.shape)) {
    if (params.getAll(key).length > 1) {
      return new Response("Filters must not be repeated.", { status: 400 });
    }
  }
  const parsed = filterSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    return new Response("Invalid room board export filters.", { status: 400 });
  }

  const { rows } = await getHousekeepingListData(parsed.data);
  return createCsvResponse(generateCsv(columns, rows), `papan-kamar-${hotelTodayISO()}.csv`);
}
