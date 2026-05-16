import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function HKRoomPlaceholderPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const parsedRoomId = Number(roomId);
  const room = Number.isInteger(parsedRoomId)
    ? await prisma.room.findUnique({
        where: { id: parsedRoomId },
        select: { number: true, roomType: { select: { name: true } } },
      })
    : null;

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <Link
          href="/app/hk"
          className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500 hover:text-console-ink"
        >
          &lt;- Kembali ke Dashboard
        </Link>
      </div>

      <section className="border border-console-border bg-console-surface p-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Kamar {room?.number ?? roomId}
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">
          {room?.roomType.name ?? "Room detail"}
        </p>
        <div className="mt-4 border border-console-border-soft bg-console-bg p-3 text-[12px] text-slate-600">
          Room detail and update flow - HK-02. Coming next session.
        </div>
      </section>
    </main>
  );
}
