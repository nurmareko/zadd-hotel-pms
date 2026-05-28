import { FBOrderStatus, ReservationStatus, RoomStatus } from "@prisma/client";

import type { AppRole } from "@/auth";
import { todayDateOnly } from "@/lib/date-only";
import type { NavBadgeMap } from "@/lib/nav-badge-types";
import { prisma } from "@/lib/prisma";

function countBadge(href: string, count: number, label: string): NavBadgeMap {
  if (count <= 0) {
    return {};
  }

  return {
    [href]: {
      value: String(count),
      label,
      tone: "count",
    },
  };
}

export async function getRoleNavBadges(role: AppRole): Promise<NavBadgeMap> {
  switch (role) {
    case "FO": {
      const inHouseCount = await prisma.reservation.count({
        where: { status: ReservationStatus.CHECKED_IN },
      });

      return countBadge(
        "/app/fo",
        inHouseCount,
        `${inHouseCount} in-house guests`,
      );
    }
    case "FB": {
      const openOrderCount = await prisma.fBOrder.count({
        where: {
          status: { in: [FBOrderStatus.OPEN, FBOrderStatus.BILLED] },
        },
      });

      return countBadge(
        "/app/fb",
        openOrderCount,
        `${openOrderCount} open F&B orders`,
      );
    }
    case "HK": {
      const cleaningQueueCount = await prisma.room.count({
        where: { status: { in: [RoomStatus.VD, RoomStatus.OD, RoomStatus.VCU] } },
      });

      return countBadge(
        "/app/hk",
        cleaningQueueCount,
        `${cleaningQueueCount} rooms need housekeeping`,
      );
    }
    case "ACC": {
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
          value: "PENDING",
          label: "today's night audit is pending",
          tone: "pending",
        },
      };
    }
    case "ADMIN":
      return {};
  }
}
