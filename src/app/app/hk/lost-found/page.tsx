import { Prisma, type LostFoundStatus } from "@prisma/client";
import { Archive, CheckCircle2, Plus, Search } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { formatCompactDateTimeID } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import {
  createLostFoundItem,
  markLostFoundItemReturned,
} from "./actions";
import {
  LOST_FOUND_STATUS_VALUES,
  parseLostFoundStatus,
} from "./schema";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string | string[];
  room?: string | string[];
  status?: string | string[];
};

const fieldClass =
  "h-8 w-full border border-slate-400 bg-console-surface px-2.5 text-[11px] font-medium text-console-ink outline-none focus:border-console-ink focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]";
const headerCellClass =
  "bg-console-ink px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-console-accent";
const bodyCellClass =
  "border-b border-console-border-soft px-3 py-[9px] align-top";

const statusClassNames: Record<
  LostFoundStatus,
  { badge: string; pip: string; label: string }
> = {
  UNCLAIMED: {
    badge: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
    pip: "bg-status-vd-pip",
    label: "Unclaimed",
  },
  RETURNED: {
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
    label: "Returned",
  },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusBadge(status: LostFoundStatus) {
  const classes = statusClassNames[status];

  return (
    <StatusBadge
      label={classes.label}
      className={classes.badge}
      pipClassName={classes.pip}
      size="md"
    />
  );
}

export default async function LostFoundPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q)?.trim() ?? "";
  const room = firstParam(params.room)?.trim() ?? "";
  const status = parseLostFoundStatus(firstParam(params.status));

  const where: Prisma.LostFoundItemWhereInput = {};

  if (q) {
    where.description = {
      contains: q,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  if (room) {
    where.room = {
      number: {
        contains: room,
        mode: Prisma.QueryMode.insensitive,
      },
    };
  }

  if (status) {
    where.status = status;
  }

  const [items, rooms] = await Promise.all([
    prisma.lostFoundItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        description: true,
        status: true,
        returnedAt: true,
        resolution: true,
        createdAt: true,
        room: { select: { id: true, number: true } },
        foundBy: { select: { fullName: true } },
      },
    }),
    prisma.room.findMany({
      orderBy: [{ floor: "asc" }, { number: "asc" }],
      select: { id: true, number: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Lost & Found
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {items.length} items · newest first
          </p>
        </div>
      </div>

      <section className="mb-4 border border-console-border bg-console-surface">
        <form
          action="/app/hk/lost-found"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-console-border p-3.5"
        >
          <div className="relative w-full sm:w-[300px]">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search description..."
              className="h-8 w-full border border-slate-400 bg-console-surface pl-8 pr-2.5 text-[12px] text-console-ink outline-none placeholder:text-slate-400 focus:border-console-ink focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]"
            />
          </div>
          <input
            type="search"
            name="room"
            defaultValue={room}
            placeholder="Room"
            className={`${fieldClass} sm:w-[110px]`}
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className={`${fieldClass} sm:w-[150px]`}
          >
            <option value="">All status</option>
            <option value={LOST_FOUND_STATUS_VALUES[0]}>Unclaimed</option>
            <option value={LOST_FOUND_STATUS_VALUES[1]}>Returned</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Search
          </button>
          <span className="min-w-0 flex-1" />
          <span className="num whitespace-nowrap text-right text-[11px] font-medium text-slate-500">
            {items.length} results
          </span>
        </form>

        <form
          action={createLostFoundItem}
          className="grid gap-2 p-3.5 md:grid-cols-[minmax(220px,1fr)_150px_auto]"
        >
          <input
            type="text"
            name="description"
            required
            minLength={3}
            maxLength={500}
            placeholder="Manual add: item description"
            className={fieldClass}
          />
          <select name="roomId" defaultValue="" className={fieldClass}>
            <option value="">No room</option>
            {rooms.map((roomOption) => (
              <option key={roomOption.id} value={roomOption.id}>
                Room {roomOption.number}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center gap-1.5 border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Item
          </button>
        </form>
      </section>

      <section className="overflow-hidden border border-console-border bg-console-surface">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className={headerCellClass}>Item</th>
                <th className={headerCellClass}>Room</th>
                <th className={headerCellClass}>Found By</th>
                <th className={headerCellClass}>When</th>
                <th className={headerCellClass}>Status</th>
                <th className={headerCellClass}>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[12px] italic text-slate-400"
                  >
                    No lost-and-found items match this filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-console-bg">
                    <td className={`${bodyCellClass} max-w-[320px]`}>
                      <div className="flex items-start gap-2">
                        <Archive
                          className="mt-0.5 h-4 w-4 shrink-0 text-console-accent"
                          aria-hidden="true"
                        />
                        <span className="leading-5 text-console-ink">
                          {item.description}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      {item.room ? (
                        <span className="num font-semibold">
                          {item.room.number}
                        </span>
                      ) : (
                        <span className="text-[11px] italic text-slate-400">
                          No room
                        </span>
                      )}
                    </td>
                    <td className={bodyCellClass}>{item.foundBy.fullName}</td>
                    <td className={`${bodyCellClass} num text-slate-600`}>
                      {formatCompactDateTimeID(item.createdAt)}
                    </td>
                    <td className={bodyCellClass}>{statusBadge(item.status)}</td>
                    <td className={`${bodyCellClass} min-w-[280px]`}>
                      {item.status === "RETURNED" ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-status-vc-fg">
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            <span className="num text-[11px] font-semibold">
                              {item.returnedAt
                                ? formatCompactDateTimeID(item.returnedAt)
                                : "Returned"}
                            </span>
                          </div>
                          <div className="text-[12px] leading-5 text-slate-600">
                            {item.resolution ?? "No resolution note"}
                          </div>
                        </div>
                      ) : (
                        <form
                          action={markLostFoundItemReturned}
                          className="flex flex-col gap-2"
                        >
                          <input
                            type="hidden"
                            name="itemId"
                            value={item.id}
                          />
                          <input
                            type="text"
                            name="resolution"
                            maxLength={500}
                            placeholder="Resolution note"
                            className={fieldClass}
                          />
                          <button
                            type="submit"
                            className="inline-flex h-8 w-fit items-center justify-center gap-1.5 border border-status-vc-pip bg-status-vc-bg px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-status-vc-fg hover:border-console-ink"
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Mark Returned
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
