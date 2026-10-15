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
    <Card className="rounded-lg p-0">
      <CardHeader className="border-b border-border px-5 py-4 rounded-t-lg">
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
      <InfoCard title="Awaiting Cleaning">
        {assignedHousekeeperName
          ? `This room is awaiting cleaning and is assigned to ${assignedHousekeeperName}.`
          : "This room is awaiting cleaning and has no attendant assigned today."}
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
      <InfoCard title="Actions">
        This room is under maintenance. Contact an administrator to restore its status.
      </InfoCard>
    );
  }

  return (
    <InfoCard title="Actions">
      This room is in good condition. No action is required.
    </InfoCard>
  );
}
