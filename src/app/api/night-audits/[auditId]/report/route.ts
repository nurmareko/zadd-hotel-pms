import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { formatISODate } from "@/lib/format";
import { NightReport } from "@/lib/pdf/night-report";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (session.user.role !== "ACC") {
    return new Response("Forbidden", { status: 403 });
  }

  const { auditId } = await params;
  const id = Number(auditId);

  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid audit id", { status: 400 });
  }

  const [audit, settings] = await Promise.all([
    prisma.nightAudit.findUnique({
      where: { id },
      include: { runBy: { select: { fullName: true } } },
    }),
    prisma.hotelSettings.findUnique({
      where: { id: 1 },
      select: { hotelName: true, address: true },
    }),
  ]);

  if (!audit) {
    return new Response("Night audit not found", { status: 404 });
  }

  if (!settings) {
    return new Response("Hotel settings not found", { status: 500 });
  }

  const reportDocument = NightReport({ audit, settings });
  const buffer = await renderToBuffer(reportDocument);
  const businessDate = formatISODate(audit.businessDate);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="night-audit-${businessDate}.pdf"`,
    },
  });
}
