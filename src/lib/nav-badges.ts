import type { AppRole } from "@/auth";
import { todayDateOnly } from "@/lib/date-only";
import type { NavBadgeMap } from "@/lib/nav-badge-types";
import { prisma } from "@/lib/prisma";

export async function getRoleNavBadges(role: AppRole): Promise<NavBadgeMap> {
  // The only nav badge is the ACC night-audit pending indicator: a binary
  // marker shown when today's night audit has not run yet. No live counts.
  if (role !== "ACC") {
    return {};
  }

  const { today } = todayDateOnly();
  const todayAudit = await prisma.nightAudit.findUnique({
    where: { businessDate: today },
    select: { id: true },
  });

  if (todayAudit) {
    return {};
  }

  return {
    "/app/acc/night-audit": {
      value: "!",
      label: "Night Audit hari ini belum dijalankan",
    },
  };
}
