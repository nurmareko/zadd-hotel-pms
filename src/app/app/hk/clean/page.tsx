import { CheckCircle2, Sparkles, Wind } from "lucide-react";

import { auth } from "@/auth";
import { formatWeekdayLongDateID } from "@/lib/format";
import {
  getHousekeeperCleanData,
  type CleanRoom,
} from "@/lib/housekeeper-clean-data";

import { RoomCard } from "./room-card";

export const dynamic = "force-dynamic";

type CleanGroupSectionProps = {
  title: string;
  hint: string;
  icon: typeof Sparkles;
  rooms: CleanRoom[];
  emptyLabel: string;
};

function CleanGroupSection({
  title,
  hint,
  icon: Icon,
  rooms,
  emptyLabel,
}: CleanGroupSectionProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-console-accent" aria-hidden="true" />
        <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-console-ink">
          {title}
        </h2>
        <span className="num flex h-5 min-w-5 items-center justify-center border border-console-border bg-console-bg px-1 text-[10px] font-bold text-console-ink">
          {rooms.length}
        </span>
        <span className="text-[10px] text-slate-500">· {hint}</span>
      </div>

      {rooms.length === 0 ? (
        <p className="border border-dashed border-console-border-soft bg-console-surface px-3 py-4 text-center text-[11px] italic text-slate-400">
          {emptyLabel}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function MyRoomsPage() {
  const session = await auth();
  const userId = Number(session?.user.id);
  const { date, ready, freshen, done } = await getHousekeeperCleanData(userId);
  const totalRooms = ready.length + freshen.length + done.length;

  return (
    <main className="min-h-screen bg-console-bg px-4 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
          <span className="text-console-accent">▸ </span>
          Kamar Saya
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">
          {formatWeekdayLongDateID(date)} · {totalRooms} kamar ditugaskan
        </p>
      </div>

      {totalRooms === 0 ? (
        <p className="border border-console-border bg-console-surface px-4 py-8 text-center text-[12px] text-slate-500">
          Belum ada kamar yang ditugaskan untuk Anda hari ini.
        </p>
      ) : (
        <div className="space-y-6">
          <CleanGroupSection
            title="Siap Dibersihkan"
            hint="vacant turnover (VD)"
            icon={Sparkles}
            rooms={ready}
            emptyLabel="Tidak ada turnover menunggu."
          />
          <CleanGroupSection
            title="Freshen-Up"
            hint="stayover (OD)"
            icon={Wind}
            rooms={freshen}
            emptyLabel="Tidak ada layanan stayover."
          />
          <CleanGroupSection
            title="Selesai / Berjalan"
            hint="sudah dimulai atau selesai hari ini"
            icon={CheckCircle2}
            rooms={done}
            emptyLabel="Belum ada pembersihan yang dimulai."
          />
        </div>
      )}
    </main>
  );
}
