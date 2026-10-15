import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { auth } from "@/auth";
import { createCsvResponse, generateCsv, type CsvColumn } from "@/lib/csv";
import { hotelTodayISO } from "@/lib/date-only";
import { canAccessLostFound } from "@/lib/lost-found/access";
import { buildLostFoundWhere, parseLostFoundFilters } from "@/lib/lost-found/filters";
import { LOST_FOUND_CATEGORY_LABELS, LOST_FOUND_STATUS_LABELS } from "@/lib/lost-found/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Claimant data belongs to this restricted custody export; do not load user profiles.
const select = {
  referenceCode: true,
  category: true,
  description: true,
  room: { select: { number: true } },
  locationDetails: true,
  foundBy: { select: { fullName: true } },
  createdAt: true,
  status: true,
  claimantName: true,
  claimantPhone: true,
  claimantIdNumber: true,
  returnedBy: { select: { fullName: true } },
  returnedAt: true,
  resolution: true,
  disposedBy: { select: { fullName: true } },
  disposedAt: true,
  disposalReason: true,
} satisfies Prisma.LostFoundItemSelect;

type RegistryRow = Prisma.LostFoundItemGetPayload<{ select: typeof select }>;

const columns: CsvColumn<RegistryRow>[] = [
  { header: "Reference Code", accessor: (row) => row.referenceCode },
  { header: "Category", accessor: (row) => LOST_FOUND_CATEGORY_LABELS[row.category] },
  { header: "Description", accessor: (row) => row.description },
  { header: "Room", accessor: (row) => row.room?.number },
  { header: "Location Details", accessor: (row) => row.locationDetails },
  { header: "Found By", accessor: (row) => row.foundBy.fullName },
  { header: "Recorded At (UTC)", accessor: (row) => row.createdAt },
  { header: "Status", accessor: (row) => LOST_FOUND_STATUS_LABELS[row.status] },
  { header: "Claimant Name", accessor: (row) => row.claimantName },
  { header: "Claimant Phone Number", accessor: (row) => row.claimantPhone },
  { header: "Claimant ID Number", accessor: (row) => row.claimantIdNumber },
  { header: "Returned By", accessor: (row) => row.returnedBy?.fullName },
  { header: "Returned At (UTC)", accessor: (row) => row.returnedAt },
  { header: "Resolution Notes", accessor: (row) => row.resolution },
  { header: "Disposed of / Donated By", accessor: (row) => row.disposedBy?.fullName },
  { header: "Disposal / Donation Time (UTC)", accessor: (row) => row.disposedAt },
  { header: "Disposal / Donation Reason", accessor: (row) => row.disposalReason },
];

function errorResponse(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return errorResponse("Please sign in first.", 401);
  if (!(await canAccessLostFound(session.user))) {
    return errorResponse("You do not have permission to export the lost and found register.", 403);
  }

  const searchParams = new URL(request.url).searchParams;
  const params = Object.fromEntries(
    [...new Set(searchParams.keys())].map((key) => [key, searchParams.getAll(key)]),
  );
  let where: Prisma.LostFoundItemWhereInput;
  try {
    where = buildLostFoundWhere(parseLostFoundFilters(params));
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      // Zod unions wrap the domain's Indonesian message in a generic English issue.
      const message = issue?.code === "invalid_union" ? issue.errors[0]?.[0]?.message : issue?.message;
      return errorResponse(message ?? "Invalid filters.", 400);
    }
    throw error;
  }

  const rows = await prisma.lostFoundItem.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select,
  });
  return createCsvResponse(generateCsv(columns, rows), `lost-found-${hotelTodayISO()}.csv`);
}
