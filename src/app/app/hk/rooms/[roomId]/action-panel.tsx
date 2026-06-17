import { RoomStatus } from "@prisma/client";

import { ActiveCleaningPanel } from "./active-cleaning-panel";
import { InspectionPanel } from "./inspection-panel";

type ActionPanelProps = {
  roomId: number;
  status: RoomStatus;
  activeCleaningSession: {
    startedAt: Date;
    housekeeperName: string;
  } | null;
  latestCompletedCleaningSession: {
    startedAt: Date;
    finishedAt: Date;
    housekeeperName: string;
    note?: string | null;
    linenChanged?: boolean;
    towelChanged?: boolean;
  } | null;
  assignedHousekeeperName: string | null;
};

function CardHeader({ children }: { children: string }) {
  return (
    <div className="border-b border-slate-200 bg-slate-50/50 rounded-t-2xl px-5 py-4">
      <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">
        {children}
      </h2>
    </div>
  );
}

function CalmCard({ title, children }: { title: string; children: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader>{title}</CardHeader>
      <div className="p-3.5 text-[12px] leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

export function ActionPanel({
  roomId,
  status,
  activeCleaningSession,
  latestCompletedCleaningSession,
  assignedHousekeeperName,
}: ActionPanelProps) {
  if (activeCleaningSession) {
    return (
      <ActiveCleaningPanel
        startedAt={activeCleaningSession.startedAt}
        housekeeperName={activeCleaningSession.housekeeperName}
      />
    );
  }

  if (status === RoomStatus.VD || status === RoomStatus.OD) {
    return (
      <CalmCard title="Menunggu Pembersihan">
        {assignedHousekeeperName
          ? `Kamar masuk antrean pembersihan dan ditugaskan ke ${assignedHousekeeperName}.`
          : "Kamar masuk antrean pembersihan dan belum memiliki petugas hari ini."}
      </CalmCard>
    );
  }

  if (status === RoomStatus.VCU) {
    return (
      <InspectionPanel
        roomId={roomId}
        latestCompletedCleaningSession={latestCompletedCleaningSession}
      />
    );
  }

  if (status === RoomStatus.OOO) {
    return (
      <CalmCard title="Aksi">
        Kamar sedang diperbaiki. Hubungi admin untuk mengembalikan status.
      </CalmCard>
    );
  }

  return (
    <CalmCard title="Aksi">
      Kamar dalam kondisi baik. Tidak ada aksi yang diperlukan.
    </CalmCard>
  );
}
