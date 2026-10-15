import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Wrench } from "lucide-react";
import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
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
  if (!can(session.user.role, "room_blocks:manage")) redirect("/app/forbidden");
  const params = await searchParams;
  const parsed = parseBlockFilters(params);
  const [rows, rooms] = await Promise.all([
    parsed.ok ? findRoomBlocks(parsed.filters) : Promise.resolve([]),
    prisma.room.findMany({
      select: {
        id: true,
        number: true,
        status: true,
        roomType: { select: { name: true } },
      },
      orderBy: { number: "asc" },
    }),
  ]);
  const today = hotelTodayISO();
  const tomorrow = addDateOnlyDays(parseISODateOnly(today), 1).toISOString().slice(0, 10);
  const rawValue = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const filters = parsed.ok ? parsed.filters : { q: rawValue("q"), startDate: rawValue("startDate"), endDate: rawValue("endDate"), reason: "ALL", status: "ALL" };

  return (
    <main className="min-w-0 space-y-4 p-4 sm:p-5 desktop:p-6 animate-in fade-in duration-300">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-slate-900">Room Blocks</h1>
          <p className="mt-1 text-sm text-slate-500">Manage maintenance and room availability restrictions by date.</p>
        </div>
        <CreateBlockDialog rooms={rooms} today={today} tomorrow={tomorrow} />
      </header>
      <section aria-label="Room block list" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <form key={JSON.stringify(params)} action="/app/fo/room-blocks" className="space-y-3 border-b border-slate-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5"><label htmlFor="filter-room" className="text-sm font-medium">Search Rooms</label><input id="filter-room" name="q" type="search" maxLength={100} defaultValue={filters.q} placeholder="Room number (e.g. 101, 204)" className={controlClass} /></div>
            <div className="space-y-1.5"><label htmlFor="filter-start" className="text-sm font-medium">From Date</label><input id="filter-start" name="startDate" type="date" defaultValue={filters.startDate} className={controlClass} /></div>
            <div className="space-y-1.5"><label htmlFor="filter-end" className="text-sm font-medium">Before Date</label><input id="filter-end" name="endDate" type="date" defaultValue={filters.endDate} className={controlClass} /></div>
            <div className="space-y-1.5"><label htmlFor="filter-reason" className="text-sm font-medium">Reason</label><select id="filter-reason" name="reason" defaultValue={filters.reason} className={controlClass}><option value="ALL">All reasons</option>{Object.entries(ROOM_BLOCK_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="space-y-1.5"><label htmlFor="filter-status" className="text-sm font-medium">Status</label><select id="filter-status" name="status" defaultValue={filters.status} className={controlClass}>{Object.entries(BLOCK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          </div>
          <p className="text-xs text-slate-500">Shows blocks overlapping the date range. The end date is excluded; leave dates blank to show all periods.</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2"><Button type="submit" variant="outline">Apply Filters</Button><Link href="/app/fo/room-blocks" className={buttonVariants({ variant: "ghost" })}>Reset</Link></div>
            {parsed.ok && <a href={`/app/fo/room-blocks/export?${blockFilterQuery(parsed.filters)}`} className={buttonVariants({ variant: "outline" })}><Download aria-hidden="true" />Export CSV</a>}
          </div>
        </form>
        {!parsed.ok ? <div role="alert" className="p-4 text-sm text-red-700">{parsed.error} Correct the filters or select Reset.</div> : (
          <>
            <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600" role="status">{rows.length} blocks found</div>
            {rows.length === 0 ? <div className="space-y-2 px-4 py-12 text-center"><Wrench className="mx-auto size-8 text-slate-400" aria-hidden="true" /><h2 className="font-semibold text-slate-900">No room blocks</h2><p className="text-sm text-slate-500">Change the filters or select Create Block to schedule a room restriction.</p></div> : (
              <div className="max-w-full overflow-auto" role="region" aria-label="Room blocks table; scroll to view all columns" tabIndex={0}>
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <caption className="sr-only">Room blocks, latest start date first. The end date is not included in the blocked nights.</caption>
                  <thead><tr>{["Room", "Reason", "Date Range", "Nights", "Status", "Notes", "Created By", "Actions"].map((label) => <th key={label} scope="col" className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
                      <th scope="row" className={`${cellClass} text-left font-semibold text-slate-900`}>{row.room.number}<div className="mt-1 text-xs font-normal text-slate-500">{row.room.roomType.name}</div></th>
                      <td className={cellClass}>{ROOM_BLOCK_REASON_LABELS[row.reason]}</td>
                      <td className={`${cellClass} whitespace-nowrap tabular-nums`}><time dateTime={row.startDate}>{row.startDate}</time><div className="mt-1 text-xs text-slate-500">up to but not including <time dateTime={row.endDate}>{row.endDate}</time></div></td>
                      <td className={`${cellClass} tabular-nums`}>{row.nights}</td>
                      <td className={cellClass}><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.status === "ACTIVE" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{BLOCK_STATUS_LABELS[row.status]}</span></td>
                      <td className={`${cellClass} max-w-xs whitespace-pre-wrap break-words text-slate-600`}>{row.note || "—"}</td>
                      <td className={`${cellClass} text-slate-600`}>{row.createdBy.fullName}</td>
                      <td className={cellClass}>{row.status === "ACTIVE" ? <ReleaseBlockDialog blockId={row.id} roomNumber={row.room.number} startDate={row.startDate} endDate={row.endDate} /> : <span className="text-xs text-slate-500">Already released</span>}</td>
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
