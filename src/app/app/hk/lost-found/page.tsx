import { Prisma, type LostFoundStatus } from "@prisma/client";
import { Archive, CheckCircle2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-blue-500/15 focus:ring-4 focus:outline-none desktop:h-10";
const headerCellClass =
  "bg-white border-b border-slate-200 px-3 py-2 text-left text-[12px] font-medium text-slate-500";
const bodyCellClass =
  "border-b border-slate-100 px-3 py-[9px] align-top";

const statusClassNames: Record<
  LostFoundStatus,
  { badge: string; pip: string; label: string }
> = {
  UNCLAIMED: {
    badge: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
    pip: "bg-status-vd-pip",
    label: "Belum diambil",
  },
  RETURNED: {
    badge: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
    pip: "bg-status-vc-pip",
    label: "Dikembalikan",
  },
};

type LostFoundRow = {
  id: number;
  description: string;
  status: LostFoundStatus;
  returnedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
  room: { id: number; number: string } | null;
  foundBy: { fullName: string };
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

function ReturnedInfo({ item }: { item: LostFoundRow }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-status-vc-fg">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="num text-[11px] font-semibold">
          {item.returnedAt
            ? formatCompactDateTimeID(item.returnedAt)
            : "Dikembalikan"}
        </span>
      </div>
      <div className="text-[12px] leading-5 text-slate-600">
        {item.resolution ?? "Tidak ada catatan penyelesaian"}
      </div>
    </div>
  );
}

function MarkReturnedForm({ item }: { item: LostFoundRow }) {
  return (
    <form
      action={markLostFoundItemReturned}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="itemId" value={item.id} />
      <input
        type="text"
        name="resolution"
        maxLength={500}
        placeholder="Catatan penyelesaian"
        className={fieldClass}
      />
      <Button type="submit" className="w-fit rounded-md">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Tandai dikembalikan
      </Button>
    </form>
  );
}

function LostFoundCard({ item }: { item: LostFoundRow }) {
  return (
    <Card className="rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Archive
            className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
            aria-hidden="true"
          />
          <span className="text-[13px] leading-5 text-slate-900">
            {item.description}
          </span>
        </div>
        {statusBadge(item.status)}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
        <dt className="text-[11px] font-medium tracking-tight text-slate-500">
          Kamar
        </dt>
        <dd>
          {item.room ? (
            <span className="num font-semibold">{item.room.number}</span>
          ) : (
            <span className="text-[11px] italic text-slate-400">
              Tanpa kamar
            </span>
          )}
        </dd>
        <dt className="text-[11px] font-medium tracking-tight text-slate-500">
          Ditemukan Oleh
        </dt>
        <dd>{item.foundBy.fullName}</dd>
        <dt className="text-[11px] font-medium tracking-tight text-slate-500">
          Waktu
        </dt>
        <dd className="num text-slate-600">
          {formatCompactDateTimeID(item.createdAt)}
        </dd>
      </dl>

      <div className="border-t border-border pt-3">
        {item.status === "RETURNED" ? (
          <ReturnedInfo item={item} />
        ) : (
          <MarkReturnedForm item={item} />
        )}
      </div>
    </Card>
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 md:py-6 text-foreground">
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Lost &amp; Found
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {items.length} barang · terbaru dulu
          </p>
        </div>
      </div>

        <Card className="mb-4 rounded-lg overflow-hidden p-0">
          <form
            action="/app/hk/lost-found"
            method="get"
            className="flex flex-wrap items-center gap-2 border-b border-border p-3.5"
          >
            <div className="relative w-full sm:w-[300px]">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Cari deskripsi..."
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3.5 text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/15 focus:ring-4 focus:outline-none desktop:h-10"
              />
            </div>
            <input
              type="search"
              name="room"
              defaultValue={room}
              placeholder="Kamar"
              className={`${fieldClass} sm:w-[110px]`}
            />
            <select
              name="status"
              defaultValue={status ?? ""}
              className={`${fieldClass} sm:w-[150px]`}
            >
              <option value="">Semua Status</option>
              <option value={LOST_FOUND_STATUS_VALUES[0]}>Belum diambil</option>
              <option value={LOST_FOUND_STATUS_VALUES[1]}>Dikembalikan</option>
            </select>
            <Button type="submit" variant="outline" size="default" className="rounded-md">
              <Search className="h-4 w-4" aria-hidden="true" />
              Cari
            </Button>
            <span className="min-w-0 flex-1" />
            <span className="num whitespace-nowrap text-right text-xs font-semibold text-slate-500">
              {items.length} hasil
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
              placeholder="Tambah manual: deskripsi barang"
              className={fieldClass}
            />
            <select name="roomId" defaultValue="" className={fieldClass}>
              <option value="">Tanpa kamar</option>
              {rooms.map((roomOption) => (
                <option key={roomOption.id} value={roomOption.id}>
                  Kamar {roomOption.number}
                </option>
              ))}
            </select>
            <Button type="submit" className="rounded-md px-4">
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Tambah Barang
            </Button>
          </form>
        </Card>

      <section className="space-y-2 md:hidden">
        {items.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-3 py-8 text-center text-sm italic text-muted-foreground">
            Tidak ada barang Lost &amp; Found yang cocok dengan filter.
          </p>
        ) : (
          items.map((item) => <LostFoundCard key={item.id} item={item} />)
        )}
      </section>

      <Card className="hidden overflow-hidden rounded-lg md:block p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className={headerCellClass}>Barang</th>
                <th className={headerCellClass}>Kamar</th>
                <th className={headerCellClass}>Ditemukan Oleh</th>
                <th className={headerCellClass}>Waktu</th>
                <th className={headerCellClass}>Status</th>
                <th className={headerCellClass}>Penyelesaian</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[12px] italic text-slate-400"
                  >
                    Tidak ada barang Lost & Found yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className={`${bodyCellClass} max-w-[320px]`}>
                      <div className="flex items-start gap-2">
                        <Archive
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                          aria-hidden="true"
                        />
                        <span className="leading-5 text-slate-900">
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
                          Tanpa kamar
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
                        <ReturnedInfo item={item} />
                      ) : (
                        <MarkReturnedForm item={item} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
