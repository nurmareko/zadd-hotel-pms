import { CheckCircle2, ChevronRight, Sparkles, Wind } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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

const groupLabelMap: Record<CleanRoom["group"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  ready: { label: "Siap", variant: "default" },
  freshen: { label: "Freshen-up", variant: "secondary" },
  done: { label: "Selesai", variant: "outline" },
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
      <span className="text-xs italic text-muted-foreground">
        Tidak ada konteks
      </span>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      {room.context ? (
        <div className="truncate text-sm text-foreground">
          {room.context.kind === "turnover" ? (
            <>
              <span className="font-semibold">Berikutnya:</span>{" "}
              {room.context.guestName}
              {room.context.etaLabel ? (
                <span className="text-muted-foreground"> · ETA {room.context.etaLabel}</span>
              ) : null}
            </>
          ) : (
            <>
              <span className="font-semibold">Tamu:</span>{" "}
              {room.context.guestName}
              <span className="text-muted-foreground"> · {room.context.nightsLabel}</span>
            </>
          )}
        </div>
      ) : null}
      {room.notes ? (
        <div className="truncate text-xs text-muted-foreground">{room.notes}</div>
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
  const groupInfo = groupLabelMap[room.group];
  return (
    <Link
      href={`/app/hk/rooms/${room.id}`}
      className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border/80 hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-bold leading-none text-foreground">
            {room.number}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {room.typeCode} · L{room.floor}
          </div>
        </div>
        <CleaningState room={room} />
      </div>
      <RoomContext room={room} />
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <Badge variant={groupInfo.variant} className="rounded-full text-xs">
          {groupInfo.label}
        </Badge>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
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
        <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <Badge variant="secondary" className="rounded-full h-5 min-w-5 px-1.5 text-xs font-semibold">
          {rooms.length}
        </Badge>
        <span className="text-sm text-muted-foreground">· {hint}</span>
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-3 py-6 text-center text-sm italic text-muted-foreground">
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 md:py-6 text-foreground">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Kamar Saya
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {formatWeekdayLongDateID(date)} · {totalRooms} kamar ditugaskan
        </p>
      </div>

      {totalRooms === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
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
