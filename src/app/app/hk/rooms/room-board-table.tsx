import { Fragment } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { HousekeepingListRow } from "@/lib/housekeeping-list-data";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";
import { StatusPill } from "../status-pill";
import { SupervisorRoomStatusSelect } from "./supervisor-room-status-select";
import { InlineHousekeeperSelect, type HousekeeperOption } from "./inline-housekeeper-select";
import { RoomTaskNoteDialog, type TaskNoteRoomOption } from "./room-task-note-dialog";

export type BoardSortBy = "priority" | "room" | "floor" | "status" | "assignee";
export type RoomBoardTableProps = {
  rows: HousekeepingListRow[];
  dateIso: string;
  query: string;
  sortBy: BoardSortBy;
  sortOrder: "asc" | "desc";
  rooms: TaskNoteRoomOption[];
  housekeepers: HousekeeperOption[];
  todayIso: string;
};
const cell = "border-b border-border px-3 py-3 align-top desktop:px-4";
const header = "border-b border-border bg-muted/40 px-3 py-3 text-left text-xs font-medium text-muted-foreground desktop:px-4";
const contextLabels = { arrival: "Kedatangan", departure: "Keberangkatan", stayover: "Menginap" };

function Context({ row }: { row: HousekeepingListRow }) {
  return <div className="space-y-3">
    {row.reservationContexts.length === 0 && <p className="text-muted-foreground">Tidak ada aktivitas reservasi</p>}
    {row.reservationContexts.map((context) => <div key={`${context.kind}-${context.reservationNo}`} className="space-y-1">
      <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium">{contextLabels[context.kind]}</span>
      <p className="font-semibold">{context.guestName}</p>
      <p className="text-xs text-muted-foreground">{context.reservationNo} · {context.nightsLabel}{context.etaLabel ? ` · ETA ${context.etaLabel}` : ""}</p>
    </div>)}
  </div>;
}

function Notes({ row }: { row: HousekeepingListRow }) {
  return <div className="max-w-xs space-y-2 break-words whitespace-pre-wrap text-xs leading-5">
    <div><p className="font-medium">Catatan reservasi</p><p className="text-muted-foreground">{row.note?.notes || "Tidak ada catatan reservasi"}</p></div>
    <div><p className="font-medium">Catatan tugas</p><p className="text-muted-foreground">{row.taskNote || "Belum ada catatan tugas"}</p></div>
  </div>;
}

export function RoomBoardTable({ rows, dateIso, query, sortBy, sortOrder, rooms, housekeepers, todayIso }: RoomBoardTableProps) {
  function sortLink(key: BoardSortBy, label: string) {
    const params = new URLSearchParams(query);
    params.set("sortBy", key);
    params.set("sortOrder", sortBy === key && sortOrder === "asc" ? "desc" : "asc");
    const Icon = sortBy !== key ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
    return <Link href={`/app/hk/rooms?${params}`} scroll={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-ring" aria-label={`Urutkan ${label.toLowerCase()} ${sortBy === key && sortOrder === "asc" ? "menurun" : "menaik"}`}>{label}<Icon className="size-3.5" aria-hidden="true" /></Link>;
  }
  function ariaSort(key: BoardSortBy) { return sortBy === key ? sortOrder === "asc" ? "ascending" as const : "descending" as const : "none" as const; }
  return <div className="relative max-w-full overflow-x-auto focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" role="region" aria-label="Lembar kerja kamar, dapat digulir horizontal" tabIndex={0}>
    <table className="w-full min-w-[900px] border-collapse text-sm desktop:min-w-[1400px]">
      <caption className="sr-only">Tugas kamar dalam urutan yang dipilih, dengan prioritas, status, konteks reservasi, petugas, dan catatan.</caption>
      <thead><tr>
        <th scope="col" className={header}>{sortLink("room", "Kode Tugas")}</th>
        <th scope="col" className={header} aria-sort={sortBy === "floor" ? ariaSort("floor") : ariaSort("room")}>
          {sortLink("room", "Kamar & Tipe")}
          <div>{sortLink("floor", "Lantai")}</div>
        </th>
        <th scope="col" className={header} aria-sort={ariaSort("priority")}>{sortLink("priority", "Prioritas")}</th>
        <th scope="col" className={header} aria-sort={ariaSort("status")}>{sortLink("status", "Status Kamar")}</th>
        <th scope="col" className={header}>Ubah Status</th>
        <th scope="col" className={`${header} hidden desktop:table-cell`}>Konteks Reservasi / Tamu</th>
        <th scope="col" className={header} aria-sort={ariaSort("assignee")}>{sortLink("assignee", "Petugas")}</th>
        <th scope="col" className={`${header} hidden desktop:table-cell`}>Catatan & Aksi</th>
      </tr></thead>
      <tbody>
        {rows.map((row) => <Fragment key={row.room.id}>
          <tr className="bg-card hover:bg-muted/30">
            <td className={`${cell} whitespace-nowrap text-xs font-medium`}>{row.taskCode}</td>
            <td className={cell}>
              <Link href={`/app/hk/rooms/${row.room.id}`} className="text-base font-bold hover:text-primary hover:underline">{row.room.number}</Link>
              <p className="my-1 text-xs text-muted-foreground">{row.room.typeName}</p>
              <span className="inline-flex whitespace-nowrap rounded-full bg-muted px-2 py-1 text-xs">Lantai {row.room.floor}</span>
            </td>
            <td className={cell}><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${PRIORITY_CONFIG[row.priority].className}`}>{row.priority} · {PRIORITY_CONFIG[row.priority].label}</span></td>
            <td className={cell}><StatusPill status={row.room.status} />{row.cleaningState === "IN_PROGRESS" && <p className="mt-2 text-xs text-muted-foreground">Sedang dibersihkan</p>}</td>
            <td className={cell}><SupervisorRoomStatusSelect key={`${row.room.id}-${row.room.status}`} roomId={row.room.id} roomNumber={row.room.number} status={row.room.status} /></td>
            <td className={`${cell} hidden min-w-56 desktop:table-cell`}><Context row={row} /></td>
            <td className={cell}><InlineHousekeeperSelect roomId={row.room.id} roomNumber={row.room.number} dateIso={dateIso} assignedId={row.assignedHousekeeper?.id ?? null} assignedName={row.assignedHousekeeper?.name} housekeepers={housekeepers} /></td>
            <td className={`${cell} hidden min-w-60 desktop:table-cell`}><Notes row={row} /><div className="mt-3"><RoomTaskNoteDialog rooms={rooms} housekeepers={housekeepers} todayIso={todayIso} defaultRoomId={row.room.id} /></div></td>
          </tr>
          <tr className="bg-muted/20 desktop:hidden"><td colSpan={6} className="border-b border-border px-3">
            <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Konteks & catatan kamar {row.room.number}</summary>
              <div className="grid max-w-xl gap-4 border-t border-border py-3 sm:grid-cols-2"><Context row={row} /><Notes row={row} /><RoomTaskNoteDialog rooms={rooms} housekeepers={housekeepers} todayIso={todayIso} defaultRoomId={row.room.id} /></div>
            </details>
          </td></tr>
        </Fragment>)}
        {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Tidak ada kamar yang sesuai. Ubah atau reset filter untuk melihat kamar lainnya.</td></tr>}
      </tbody>
    </table>
  </div>;
}
