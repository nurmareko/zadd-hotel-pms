import { Fragment } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
const contextLabels = { arrival: "Arrival", departure: "Departure", stayover: "Stayover" };

function Context({ row }: { row: HousekeepingListRow }) {
  return <div className="space-y-3">
    {row.reservationContexts.length === 0 && <p className="text-muted-foreground">No reservation activity</p>}
    {row.reservationContexts.map((context) => <div key={`${context.kind}-${context.reservationNo}`} className="space-y-1">
      <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium">{contextLabels[context.kind]}</span>
      <p className="font-semibold">{context.guestName}</p>
      <p className="text-xs text-muted-foreground">{context.reservationNo} · {context.nightsLabel}{context.etaLabel ? ` · ETA ${context.etaLabel}` : ""}</p>
    </div>)}
  </div>;
}

function Notes({ row }: { row: HousekeepingListRow }) {
  return <div className="max-w-xs space-y-2 break-words whitespace-pre-wrap text-xs leading-5">
    <div><p className="font-medium">Reservation notes</p><p className="text-muted-foreground">{row.note?.notes || "No reservation notes"}</p></div>
    <div><p className="font-medium">Task notes</p><p className="text-muted-foreground">{row.taskNote || "No task notes yet"}</p></div>
  </div>;
}

export function RoomBoardTable({ rows, dateIso, query, sortBy, sortOrder, rooms, housekeepers, todayIso }: RoomBoardTableProps) {
  function sortLink(key: BoardSortBy, label: string) {
    const params = new URLSearchParams(query);
    params.set("sortBy", key);
    params.set("sortOrder", sortBy === key && sortOrder === "asc" ? "desc" : "asc");
    const Icon = sortBy !== key ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
    return <Link href={`/app/hk/rooms?${params}`} scroll={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-ring" aria-label={`Sort ${label.toLowerCase()} ${sortBy === key && sortOrder === "asc" ? "descending" : "ascending"}`}>{label}<Icon className="size-3.5" aria-hidden="true" /></Link>;
  }
  function ariaSort(key: BoardSortBy) { return sortBy === key ? sortOrder === "asc" ? "ascending" as const : "descending" as const : "none" as const; }
  return <div className="relative max-w-full overflow-x-auto focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" role="region" aria-label="Room worksheet, scroll horizontally" tabIndex={0}>
    <table className="w-full min-w-[900px] border-collapse text-sm desktop:min-w-[1400px]">
      <caption className="sr-only">Room tasks in the selected order, including priority, status, reservation details, attendant and notes.</caption>
      <thead><tr>
        <th scope="col" className={header}>{sortLink("room", "Task Code")}</th>
        <th scope="col" className={header} aria-sort={sortBy === "floor" ? ariaSort("floor") : ariaSort("room")}>
          {sortLink("room", "Room & Type")}
          <div>{sortLink("floor", "Floor")}</div>
        </th>
        <th scope="col" className={header} aria-sort={ariaSort("priority")}>{sortLink("priority", "Priority")}</th>
        <th scope="col" className={header} aria-sort={ariaSort("status")}>{sortLink("status", "Room Status")}</th>
        <th scope="col" className={header}>Change Status</th>
        <th scope="col" className={`${header} hidden desktop:table-cell`}>Reservation / Guest Details</th>
        <th scope="col" className={header} aria-sort={ariaSort("assignee")}>{sortLink("assignee", "Staff")}</th>
        <th scope="col" className={`${header} hidden desktop:table-cell`}>Notes & Actions</th>
      </tr></thead>
      <tbody>
        {rows.map((row) => <Fragment key={row.room.id}>
          <tr className="bg-card hover:bg-muted/30">
            <td className={`${cell} whitespace-nowrap text-xs font-medium`}>{row.taskCode}</td>
            <td className={cell}>
              <Link href={`/app/hk/rooms/${row.room.id}`} className="text-base font-bold hover:text-primary hover:underline">{row.room.number}</Link>
              <p className="my-1 text-xs text-muted-foreground">{row.room.typeName}</p>
              <span className="inline-flex whitespace-nowrap rounded-full bg-muted px-2 py-1 text-xs">Floor {row.room.floor}</span>
            </td>
            <td className={cell}><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${PRIORITY_CONFIG[row.priority].className}`}>{row.priority} · {PRIORITY_CONFIG[row.priority].label}</span></td>
            <td className={cell}><StatusPill status={row.room.status} />{row.cleaningState === "IN_PROGRESS" && <p className="mt-2 text-xs text-muted-foreground">Cleaning in progress</p>}</td>
            <td className={cell}><SupervisorRoomStatusSelect key={`${row.room.id}-${row.room.status}`} roomId={row.room.id} roomNumber={row.room.number} status={row.room.status} /></td>
            <td className={`${cell} hidden min-w-56 desktop:table-cell`}><Context row={row} /></td>
            <td className={cell}><InlineHousekeeperSelect roomId={row.room.id} roomNumber={row.room.number} dateIso={dateIso} assignedId={row.assignedHousekeeper?.id ?? null} assignedName={row.assignedHousekeeper?.name} housekeepers={housekeepers} /></td>
            <td className={`${cell} hidden min-w-60 desktop:table-cell`}><Notes row={row} /><div className="mt-3"><RoomTaskNoteDialog rooms={rooms} housekeepers={housekeepers} todayIso={todayIso} defaultRoomId={row.room.id} /></div></td>
          </tr>
          <tr className="bg-muted/20 desktop:hidden"><td colSpan={6} className="border-b border-border px-3">
            <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Room details & notes {row.room.number}</summary>
              <div className="grid max-w-xl gap-4 border-t border-border py-3 sm:grid-cols-2"><Context row={row} /><Notes row={row} /><RoomTaskNoteDialog rooms={rooms} housekeepers={housekeepers} todayIso={todayIso} defaultRoomId={row.room.id} /></div>
            </details>
          </td></tr>
        </Fragment>)}
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="p-8">
              <EmptyState
                icon={SearchX}
                title="No matching rooms"
                description="No rooms match the selected filters. Change the search term or reset the filters."
                action={
                  <Link
                    href={`/app/hk/rooms?date=${dateIso}`}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted"
                  >
                    Reset Filters
                  </Link>
                }
              />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>;
}
