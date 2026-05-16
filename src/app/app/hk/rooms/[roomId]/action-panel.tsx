import { RoomStatus } from "@prisma/client";

import { ActiveCleaningPanel } from "./active-cleaning-panel";
import { InspectionPanel } from "./inspection-panel";
import { StartCleaningForm } from "./start-cleaning-form";

type ActionPanelProps = {
  roomId: number;
  status: RoomStatus;
  activeCleaningLog: {
    id: number;
    startedAt: Date;
    updatedByName: string;
  } | null;
  latestCompletedCleaningLog: {
    startedAt: Date;
    completedAt: Date;
    updatedByName: string;
  } | null;
};

function CardHeader({ children }: { children: string }) {
  return (
    <div className="bg-console-ink px-3.5 py-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
        {children}
      </h2>
    </div>
  );
}

function CalmCard({ title, children }: { title: string; children: string }) {
  return (
    <section className="border border-console-border bg-console-surface">
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
  activeCleaningLog,
  latestCompletedCleaningLog,
}: ActionPanelProps) {
  if (activeCleaningLog) {
    return (
      <ActiveCleaningPanel
        roomId={roomId}
        startedAt={activeCleaningLog.startedAt}
        updatedByName={activeCleaningLog.updatedByName}
      />
    );
  }

  if (status === RoomStatus.VD || status === RoomStatus.OD) {
    return (
      <section className="border border-console-border bg-console-surface">
        <CardHeader>{"// Aksi"}</CardHeader>
        <StartCleaningForm roomId={roomId} />
      </section>
    );
  }

  if (status === RoomStatus.VCU) {
    return (
      <InspectionPanel
        roomId={roomId}
        latestCompletedCleaningLog={latestCompletedCleaningLog}
      />
    );
  }

  if (status === RoomStatus.OOO) {
    return (
      <CalmCard title="// Aksi">
        Kamar sedang diperbaiki. Hubungi admin untuk mengembalikan status.
      </CalmCard>
    );
  }

  return (
    <CalmCard title="// Aksi">
      Kamar dalam kondisi baik. Tidak ada aksi yang diperlukan.
    </CalmCard>
  );
}
