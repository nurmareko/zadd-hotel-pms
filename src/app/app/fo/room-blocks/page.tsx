import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Wrench } from "lucide-react";
import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { addDateOnlyDays, hotelTodayISO, parseISODateOnly } from "@/lib/date-only";
import { ROOM_BLOCK_REASON_LABELS } from "@/lib/room-blocks/overlap";
import { CreateBlockDialog, ReleaseBlockDialog } from "./block-dialogs";
import { BLOCK_STATUS_LABELS, blockFilterQuery, parseBlockFilters, type FilterParams } from "./filters";
import { findRoomBlocks } from "./queries";

export const dynamic = "force-dynamic";

const controlClass = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-300 desktop:h-10";
const cellClass = "px-4 py-3 align-top";

export default async function RoomBlocksPage({ searchParams }: { searchParams: Promise<FilterParams> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["FO", "ADMIN"].includes(session.user.role)) redirect("/app/forbidden");
  const params = await searchParams;
  const parsed = parseBlockFilters(params);
  const [rows, rooms] = await Promise.all([
    parsed.ok ? findRoomBlocks(parsed.filters) : Promise.resolve([]),
    prisma.room.findMany({ select: { id: true, number: true, roomType: { select: { name: true } } }, orderBy: { number: "asc" } }),
  ]);
  const today = hotelTodayISO();
  const tomorrow = addDateOnlyDays(parseISODateOnly(today), 1).toISOString().slice(0, 10);
  const rawValue = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const filters = parsed.ok ? parsed.filters : { q: rawValue("q"), startDate: rawValue("startDate"), endDate: rawValue("endDate"), reason: "ALL", status: "ALL" };

  return (
    <main className="min-w-0 space-y-4 p-4 sm:p-5 desktop:p-6 animate-in fade-in duration-300">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-slate-900">Blokir Kamar</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola pemeliharaan dan pembatasan ketersediaan kamar berdasarkan tanggal.</p>
        </div>
        <CreateBlockDialog rooms={rooms} today={today} tomorrow={tomorrow} />
      </header>
      <section aria-label="Daftar blokir kamar" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <form key={JSON.stringify(params)} action="/app/fo/room-blocks" className="space-y-3 border-b border-slate-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5"><label htmlFor="filter-room" className="text-sm font-medium">Cari Kamar</label><input id="filter-room" name="q" type="search" maxLength={100} defaultValue={filters.q} placeholder="Nomor kamar" className={controlClass} /></div>
            <div className="space-y-1.5"><label htmlFor="filter-start" className="text-sm font-medium">Dari Tanggal</label><input id="filter-start" name="startDate" type="date" defaultValue={filters.startDate} className={controlClass} /></div>
            <div className="space-y-1.5"><label htmlFor="filter-end" className="text-sm font-medium">Sebelum Tanggal</label><input id="filter-end" name="endDate" type="date" defaultValue={filters.endDate} className={controlClass} /></div>
            <div className="space-y-1.5"><label htmlFor="filter-reason" className="text-sm font-medium">Alasan</label><select id="filter-reason" name="reason" defaultValue={filters.reason} className={controlClass}><option value="ALL">Semua alasan</option>{Object.entries(ROOM_BLOCK_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="space-y-1.5"><label htmlFor="filter-status" className="text-sm font-medium">Status</label><select id="filter-status" name="status" defaultValue={filters.status} className={controlClass}>{Object.entries(BLOCK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          </div>
          <p className="text-xs text-slate-500">Menampilkan blokir yang beririsan dengan rentang tanggal. Tanggal selesai tidak termasuk; kosongkan tanggal untuk semua periode.</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2"><Button type="submit" variant="outline">Terapkan Filter</Button><Link href="/app/fo/room-blocks" className={buttonVariants({ variant: "ghost" })}>Atur Ulang</Link></div>
            {parsed.ok && <a href={`/app/fo/room-blocks/export?${blockFilterQuery(parsed.filters)}`} className={buttonVariants({ variant: "outline" })}><Download aria-hidden="true" />Ekspor CSV</a>}
          </div>
        </form>
        {!parsed.ok ? <div role="alert" className="p-4 text-sm text-red-700">{parsed.error} Perbaiki filter atau pilih Atur Ulang.</div> : (
          <>
            <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600" role="status">{rows.length} blokir ditemukan</div>
            {rows.length === 0 ? <div className="space-y-2 px-4 py-12 text-center"><Wrench className="mx-auto size-8 text-slate-400" aria-hidden="true" /><h2 className="font-semibold text-slate-900">Tidak ada blokir kamar</h2><p className="text-sm text-slate-500">Ubah filter atau pilih Buat Blokir untuk menambahkan jadwal pembatasan kamar.</p></div> : (
              <div className="max-w-full overflow-auto" role="region" aria-label="Tabel blokir kamar, geser untuk melihat semua kolom" tabIndex={0}>
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <caption className="sr-only">Daftar blokir kamar, tanggal mulai terbaru terlebih dahulu. Tanggal selesai tidak termasuk malam yang diblokir.</caption>
                  <thead><tr>{["Kamar", "Alasan", "Rentang Tanggal", "Malam", "Status", "Catatan", "Dibuat Oleh", "Aksi"].map((label) => <th key={label} scope="col" className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
                      <th scope="row" className={`${cellClass} text-left font-semibold text-slate-900`}>{row.room.number}<div className="mt-1 text-xs font-normal text-slate-500">{row.room.roomType.name}</div></th>
                      <td className={cellClass}>{ROOM_BLOCK_REASON_LABELS[row.reason]}</td>
                      <td className={`${cellClass} whitespace-nowrap tabular-nums`}><time dateTime={row.startDate}>{row.startDate}</time><div className="mt-1 text-xs text-slate-500">hingga sebelum <time dateTime={row.endDate}>{row.endDate}</time></div></td>
                      <td className={`${cellClass} tabular-nums`}>{row.nights}</td>
                      <td className={cellClass}><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.status === "ACTIVE" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{BLOCK_STATUS_LABELS[row.status]}</span></td>
                      <td className={`${cellClass} max-w-xs whitespace-pre-wrap break-words text-slate-600`}>{row.note || "—"}</td>
                      <td className={`${cellClass} text-slate-600`}>{row.createdBy.fullName}</td>
                      <td className={cellClass}>{row.status === "ACTIVE" ? <ReleaseBlockDialog blockId={row.id} roomNumber={row.room.number} startDate={row.startDate} endDate={row.endDate} /> : <span className="text-xs text-slate-500">Sudah dilepas</span>}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
