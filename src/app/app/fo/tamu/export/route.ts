import { auth } from "@/auth";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { hotelTodayISO } from "@/lib/date-only";
import { guestIdTypeLabel } from "@/lib/guest-id-type";
import { normalizeGuestQuery } from "@/lib/guests/filters";
import { findGuests } from "@/lib/guests/queries";
import type { GuestDirectoryRow } from "@/lib/guests/types";

export const dynamic = "force-dynamic";

const CSV_COLUMNS: CsvColumn<GuestDirectoryRow>[] = [
  { header: "Nama Tamu", accessor: (row) => row.fullName },
  { header: "Jenis Identitas", accessor: (row) => guestIdTypeLabel(row.idType) },
  { header: "Nomor Identitas", accessor: (row) => row.idNumber },
  { header: "Nomor Telepon", accessor: (row) => row.phone },
  { header: "Email", accessor: (row) => row.email },
  { header: "Alamat", accessor: (row) => row.address },
  { header: "Kewarganegaraan", accessor: (row) => row.nationality },
  { header: "Total Kunjungan", accessor: (row) => row.totalStays },
  { header: "Kunjungan Terakhir", accessor: (row) => row.lastStayDate },
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Silakan masuk terlebih dahulu.", { status: 401 });
  }
  if (!["FO", "ADMIN"].includes(session.user.role)) {
    return new Response("Anda tidak memiliki akses untuk mengekspor data tamu.", { status: 403 });
  }

  const q = normalizeGuestQuery(new URL(request.url).searchParams.get("q"));
  const guests = await findGuests(q);
  return createCsvResponse(
    generateCsv(CSV_COLUMNS, guests),
    `daftar-tamu-${hotelTodayISO()}.csv`,
  );
}
