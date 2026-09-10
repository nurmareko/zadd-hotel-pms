import { auth } from "@/auth";
import { getHousekeepingNotifications } from "@/lib/housekeeping-notifications";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (session?.user.role !== "HK") {
    return Response.json({ error: "Tidak berwenang" }, { status: 403 });
  }

  return Response.json(
    await getHousekeepingNotifications(Number(session.user.id)),
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (session?.user.role !== "HK") {
    return Response.json({ error: "Tidak berwenang" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const notificationId = Number(body?.notificationId);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return Response.json({ error: "Notifikasi tidak valid" }, { status: 400 });
  }

  const updated = await prisma.housekeepingNotification.updateMany({
    where: {
      id: notificationId,
      recipientId: Number(session.user.id),
      assignment: { housekeeperId: Number(session.user.id) },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  if (updated.count === 0) {
    return Response.json({ error: "Notifikasi tidak ditemukan" }, { status: 404 });
  }

  return Response.json({ ok: true });
}