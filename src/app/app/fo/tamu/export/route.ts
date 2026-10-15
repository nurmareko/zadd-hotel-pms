import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { hotelTodayISO } from "@/lib/date-only";
import { guestIdTypeLabel } from "@/lib/guest-id-type";
import { normalizeGuestQuery } from "@/lib/guests/filters";
import { findGuests } from "@/lib/guests/queries";
import type { GuestDirectoryRow } from "@/lib/guests/types";

export const dynamic = "force-dynamic";

const CSV_COLUMNS: CsvColumn<GuestDirectoryRow>[] = [
  { header: "Guest Name", accessor: (row) => row.fullName },
  { header: "ID Type", accessor: (row) => guestIdTypeLabel(row.idType) },
  { header: "ID Number", accessor: (row) => row.idNumber },
  { header: "Phone Number", accessor: (row) => row.phone },
  { header: "Email", accessor: (row) => row.email },
  { header: "Address", accessor: (row) => row.address },
  { header: "Nationality", accessor: (row) => row.nationality },
  { header: "Total Visits", accessor: (row) => row.totalStays },
  { header: "Last Visit", accessor: (row) => row.lastStayDate },
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Please sign in first.", { status: 401 });
  }
  if (!can(session.user.role as AppRole, "reservations:read")) {
    return new Response("You do not have permission to export guest data.", { status: 403 });
  }

  const q = normalizeGuestQuery(new URL(request.url).searchParams.get("q"));
  const guests = await findGuests(q);
  return createCsvResponse(
    generateCsv(CSV_COLUMNS, guests),
    `daftar-tamu-${hotelTodayISO()}.csv`,
  );
}
