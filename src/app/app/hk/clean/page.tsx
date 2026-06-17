import { CheckCircle2, ChevronRight, Sparkles, Wind } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { auth } from "@/auth";
import { formatTimeID, formatWeekdayLongDateID } from "@/lib/format";
import {
  getHousekeeperCleanData,
  type CleanRoom,
} from "@/lib/housekeeper-clean-data";

export const dynamic = "force-dynamic";

const statusBadgeClass: Record<CleanRoom["status"], string> = {
  VC: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  OC: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  VD: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  OD: "border-status-od-pip bg-status-od-bg text-status-od-fg",
  VCU: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
  OOO: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",
};

const groupLabels: Record<CleanRoom["group"], string> = {
  ready: "Siap",
  freshen: "Freshen-up",
  done: "Selesai",
};

type CleanGroupSectionProps = {
  title: string;
  hint: string;
  icon: typeof Sparkles;
  rooms: CleanRoom[];
  emptyLabel: string;
};

function RoomContext({ room }: { room: CleanRoom }) {
  if (!room.context && !room.notes) {
    return (
      <span className="text-[11px] italic text-slate-400">
        Tidak ada konteks
      </span>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      {room.context ? (
        <div className="truncate text-[12px] text-slate-600">
          {room.context.kind === "turnover" ? (
            <>
              <span className="font-semibold text-slate-900">Berikutnya:</span>{" "}
              {room.context.guestName}
              {room.context.etaLabel ? (
                <span className="num"> · ETA {room.context.etaLabel}</span>
              ) : null}
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-900">Tamu:</span>{" "}
              {room.context.guestName}
              <span className="num"> · {room.context.nightsLabel}</span>
            </>
          )}
        </div>
      ) : null}
      {room.notes ? (
        <div className="truncate text-[11px] text-slate-500">{room.notes}</div>
      ) : null}
    </div>
  );
}

function CleaningState({ room }: { room: CleanRoom }) {
  if (room.inProgress && room.startedAt) {
    return (
      <StatusBadge
        label={`Berjalan ${formatTimeID(room.startedAt)}`}
        className="bg-blue-50 border-blue-200 text-blue-700"
        pipClassName="bg-blue-500"
        size="md"
      />
    );
  }

  return (
    <StatusBadge
      label={room.status}
      className={statusBadgeClass[room.status]}
      size="md"
    />
  );
}

function CleanRoomCard({ room }: { room: CleanRoom }) {
  return (
    <Link
      href={`/app/hk/rooms/${room.id}`}
      className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="num text-lg font-bold leading-none text-slate-900">
            {room.number}
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {room.typeCode} · L{room.floor}
          </div>
        </div>
        <CleaningState room={room} />
      </div>
      <RoomContext room={room} />
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <StatusBadge
          label={groupLabels[room.group]}
          className="w-fit border-slate-200 bg-slate-50 text-slate-900"
          showPip={false}
          size="md"
        />
        <ChevronRight
          className="h-4 w-4 shrink-0 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function CleanGroupSection({
  title,
  hint,
  icon: Icon,
  rooms,
  emptyLabel,
}: CleanGroupSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-slate-700" aria-hidden="true" />
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <span className="num flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
          {rooms.length}
        </span>
        <span className="text-xs text-slate-500">· {hint}</span>
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs italic text-slate-400">
          {emptyLabel}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <CleanRoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function MyRoomsPage() {
  const session = await auth();

  if (session?.user.role !== "HK") {
    notFound();
  }

  const userId = Number(session?.user.id);
  const { date, ready, freshen, done } = await getHousekeeperCleanData(userId);
  const totalRooms = ready.length + freshen.length + done.length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-6 text-slate-900">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Kamar Saya
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {formatWeekdayLongDateID(date)} · {totalRooms} kamar ditugaskan
        </p>
      </div>

      {totalRooms === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-8 text-center text-[12px] text-slate-500">
          Belum ada kamar yang ditugaskan untuk Anda hari ini.
        </p>
      ) : (
        <div className="space-y-6">
          <CleanGroupSection
            title="Siap Dibersihkan"
            hint="turnover vacant (VD)"
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
