import { Users } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { parseISODateOnly } from "@/lib/date-only";
import { formatDateID } from "@/lib/format";
import { formatGuestIdentity } from "@/lib/guest-id-type";
import type { GuestDirectoryRow } from "@/lib/guests/types";

const headerClass = "bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600";
const cellClass = "px-4 py-3 align-top";

export function GuestTable({ guests, q }: { guests: GuestDirectoryRow[]; q: string }) {
  if (guests.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={Users}
          title={q ? "Tamu tidak ditemukan" : "Belum ada tamu"}
          description={q ? "Tidak ada tamu yang cocok dengan pencarian Anda. Coba kata kunci lain atau atur ulang pencarian." : "Data tamu akan muncul setelah reservasi pertama dibuat."}
          action={
            <Link href={q ? "/app/fo/tamu" : "/app/fo/reservasi/new"} className={buttonVariants({ variant: "outline" })}>
              {q ? "Atur Ulang" : "Buat Reservasi"}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-auto">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <caption className="sr-only">Daftar tamu hotel menurut abjad nama, dengan total kunjungan dan kunjungan terakhir</caption>
        <thead>
          <tr>
            {["Nama Tamu", "Identitas", "Kontak", "Domisili / Kewarganegaraan", "Total Kunjungan", "Kunjungan Terakhir", "Aksi"].map((label) => (
              <th key={label} scope="col" className={headerClass}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {guests.map((guest) => (
            <tr key={guest.id} className="transition-colors hover:bg-slate-50">
              <th scope="row" className={`${cellClass} text-left font-semibold text-slate-900`}>
                {guest.fullName}
                {guest.email && <div className="mt-1 break-all text-xs font-normal text-slate-500">{guest.email}</div>}
              </th>
              <td className={`${cellClass} text-slate-600`}>{formatGuestIdentity(guest.idType, guest.idNumber)}</td>
              <td className={`${cellClass} whitespace-nowrap text-slate-600`}>{guest.phone || "—"}</td>
              <td className={`${cellClass} max-w-xs text-slate-600`}>
                <div className="break-words">{guest.address || guest.nationality || "-"}</div>
              </td>
              <td className={`${cellClass} tabular-nums text-slate-900`}>{guest.totalStays}</td>
              <td className={`${cellClass} whitespace-nowrap tabular-nums text-slate-600`}>
                {guest.lastStayDate ? formatDateID(parseISODateOnly(guest.lastStayDate)) : "-"}
                {guest.lastRoomNumber && (
                  <div className="mt-1">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{guest.lastRoomNumber}</span>
                  </div>
                )}
              </td>
              <td className={cellClass}>
                <Link
                  href={`/app/fo/reservasi/new?guestId=${guest.id}`}
                  aria-label={`Buat reservasi untuk ${guest.fullName}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Buat Reservasi
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
