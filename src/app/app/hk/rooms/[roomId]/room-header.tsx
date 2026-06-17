import Link from "next/link";
import type { RoomStatus } from "@prisma/client";

import { StatusPill } from "../../room-status-grid";

type RoomHeaderProps = {
  roomNumber: string;
  roomTypeName: string;
  status: RoomStatus;
};

export function RoomHeader({ roomNumber, roomTypeName, status }: RoomHeaderProps) {
  return (
    <header className="space-y-3">
      <Link
        href="/app/hk"
        className="inline-flex min-h-8 items-center text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500 hover:text-slate-900"
      >
        &lt;- Kembali ke Dashboard
      </Link>

      <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-3.5">
        <div className="min-w-0">
          <h1 className="num text-[20px] font-bold font-semibold tracking-tight text-slate-900">
            Kamar {roomNumber}
          </h1>
          <p className="mt-1 truncate text-[11px] text-slate-500">
            {roomTypeName}
          </p>
        </div>
        <StatusPill status={status} />
      </div>
    </header>
  );
}
