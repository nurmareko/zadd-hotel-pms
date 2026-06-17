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
    <section className="mb-4 border border-console-border bg-console-surface">
      <div className="flex items-center justify-between border-b border-console-border bg-console-ink px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          Menunggu inspeksi
        </span>
        <span className="num text-[11px] font-bold text-console-accent">
          {rooms.length}
        </span>
      </div>

      {rooms.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-slate-500">
          Tidak ada kamar menunggu inspeksi.
        </p>
      ) : (
        <ul className="divide-y divide-console-border">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={room.href}
                className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-console-bg"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="num shrink-0 text-[15px] font-bold text-console-ink">
                    {room.number}
                  </span>
                  <span className="truncate text-[11px] uppercase tracking-[0.04em] text-slate-500">
                    {room.roomTypeName}
                  </span>
                  {room.linenChanged || room.towelChanged ? (
                    <span className="inline-flex gap-1 shrink-0">
                      {room.linenChanged ? (
                        <span className="border border-status-vc-pip bg-status-vc-bg text-status-vc-fg text-[9px] font-bold px-1 uppercase tracking-wide rounded-none">Linen</span>
                      ) : null}
                      {room.towelChanged ? (
                        <span className="border border-status-vc-pip bg-status-vc-bg text-status-vc-fg text-[9px] font-bold px-1 uppercase tracking-wide rounded-none">Handuk</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-[11px] text-slate-500">
                  {room.cleanedByName ? (
                    <>
                      <span className="text-console-ink">{room.cleanedByName}</span>
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
