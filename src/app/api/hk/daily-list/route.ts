import { renderToBuffer } from "@react-pdf/renderer";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";
import { formatISODate } from "@/lib/format";
import {
  getHousekeepingForecastData,
  type HousekeepingForecastHousekeeperLoad,
} from "@/lib/housekeeping-forecast-data";
import { getHousekeepingListData } from "@/lib/housekeeping-list-data";
import {
  HkDailyList,
  type HkDailyListHousekeeperSection,
} from "@/lib/pdf/hk-daily-list";
import { prisma } from "@/lib/prisma";

function dateOnlyFromISO(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function isSupervisorSession(session: Session | null) {
  return Boolean(
    session?.user &&
      (session.user.role === "ADMIN" || isHkSupervisor(session)),
  );
}

function housekeeperSections(
  housekeepers: HousekeepingForecastHousekeeperLoad[],
  rows: Awaited<ReturnType<typeof getHousekeepingListData>>["rows"],
): HkDailyListHousekeeperSection[] {
  return housekeepers.map((housekeeper) => ({
    id: housekeeper.id,
    name: housekeeper.name,
    initials: housekeeper.initials,
    assignedCount: housekeeper.assignedCount,
    rows: rows.filter(
      (row) => row.assignedHousekeeper?.id === housekeeper.id,
    ),
  }));
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isSupervisorSession(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const selectedDate = dateParam ? dateOnlyFromISO(dateParam) : undefined;

  if (dateParam && !selectedDate) {
    return new Response("Invalid date", { status: 400 });
  }

  const date = selectedDate ?? undefined;
  const [listData, forecast, settings] = await Promise.all([
    getHousekeepingListData(date),
    getHousekeepingForecastData(date),
    prisma.hotelSettings.findUnique({
      where: { id: 1 },
      select: { hotelName: true, address: true },
    }),
  ]);

  if (!settings) {
    return new Response("Hotel settings not found", { status: 500 });
  }

  const attentionRoomIds = new Set(
    forecast.rooms
      .filter((row) => row.needsAttention)
      .map((row) => row.room.id),
  );
  const unassignedRows = listData.rows.filter(
    (row) => !row.assignedHousekeeper && attentionRoomIds.has(row.room.id),
  );
  const pdfDocument = HkDailyList({
    date: listData.date,
    settings,
    housekeepers: housekeeperSections(forecast.housekeepers, listData.rows),
    unassignedRows,
  });
  const buffer = await renderToBuffer(pdfDocument);
  const dateISO = formatISODate(listData.date);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="hk-daily-list-${dateISO}.pdf"`,
    },
  });
}
