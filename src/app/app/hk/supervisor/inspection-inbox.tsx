import Link from "next/link";

import { formatMonthDayTimeID } from "@/lib/format";

export type InspectionInboxRow = {
  id: number;
  number: string;
  roomTypeName: string;
  cleanedByName: string | null;
  cleanedAt: Date | null;
  href: string;
  linenChanged: boolean;
  towelChanged: boolean;
};

export function InspectionInbox({ rooms }: { rooms: InspectionInboxRow[] }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 rounded-t-2xl px-5 py-4">
        <span className="text-base font-semibold text-slate-900">
          Menunggu Inspeksi
        </span>
        <span className="num flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
          {rooms.length}
        </span>
      </div>

      {rooms.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-slate-500">
          Tidak ada kamar menunggu inspeksi.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={room.href}
                className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="num shrink-0 text-[15px] font-bold text-slate-900">
                    {room.number}
                  </span>
                  <span className="truncate text-[11px] font-medium tracking-tight text-slate-500">
                    {room.roomTypeName}
                  </span>
                  {room.linenChanged || room.towelChanged ? (
                    <span className="inline-flex gap-1 shrink-0">
                      {room.linenChanged ? (
                        <span className="border border-status-vc-pip bg-status-vc-bg text-status-vc-fg text-[9px] font-bold px-1 uppercase tracking-wide rounded-xl">Linen</span>
                      ) : null}
                      {room.towelChanged ? (
                        <span className="border border-status-vc-pip bg-status-vc-bg text-status-vc-fg text-[9px] font-bold px-1 uppercase tracking-wide rounded-xl">Handuk</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-[11px] text-slate-500">
                  {room.cleanedByName ? (
                    <>
                      <span className="text-slate-900">{room.cleanedByName}</span>
                      {room.cleanedAt ? (
                        <span> · {formatMonthDayTimeID(room.cleanedAt)}</span>
                      ) : null}
                    </>
                  ) : (
                    <span>Housekeeper tidak diketahui</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
