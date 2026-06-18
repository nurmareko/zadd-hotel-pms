import { RoomStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function InfoCard({ title, children }: { title: string; children: string }) {
  return (
    <Card className="rounded-2xl p-0">
      <CardHeader className="border-b border-border px-5 py-4 rounded-t-2xl">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4 text-sm text-muted-foreground leading-relaxed">
        {children}
      </CardContent>
    </Card>
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
      <InfoCard title="Menunggu Pembersihan">
        {assignedHousekeeperName
          ? `Kamar masuk antrean pembersihan dan ditugaskan ke ${assignedHousekeeperName}.`
          : "Kamar masuk antrean pembersihan dan belum memiliki petugas hari ini."}
      </InfoCard>
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
      <InfoCard title="Aksi">
        Kamar sedang diperbaiki. Hubungi admin untuk mengembalikan status.
      </InfoCard>
    );
  }

  return (
    <InfoCard title="Aksi">
      Kamar dalam kondisi baik. Tidak ada aksi yang diperlukan.
    </InfoCard>
  );
}
