import { redirect } from "next/navigation";
import { Shirt } from "lucide-react";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { GuestLaundryDialog } from "./guest-laundry-dialog";

export async function GuestLaundryView() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "laundry:guest-order")) {
    return <Card className="p-4" role="alert">You do not have permission to record guest laundry.</Card>;
  }

  const [reservations, articles] = await Promise.all([
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN", roomId: { not: null }, folio: { is: { status: "OPEN" } } },
      select: { room: { select: { id: true, number: true } }, guest: { select: { fullName: true } } },
      orderBy: { room: { number: "asc" } },
    }),
    prisma.article.findMany({
      where: { type: "SERVICE", code: { in: ["LND-KEMEJA", "LND-CELANA", "LND-JAS", "LND-GAUN", "LND-DRYCLEAN", "LAUNDRY"] } },
      select: { id: true, code: true, name: true, defaultPrice: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const rooms = reservations.flatMap(({ room, guest }) => room ? [{ id: room.id, number: room.number, guestName: guest.fullName }] : []);
  const catalog = articles.map((article) => ({ ...article, defaultPrice: article.defaultPrice === null ? null : Number(article.defaultPrice) }));

  return (
    <Card className="min-w-0 gap-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Guest Laundry</h2>
          <p className="mt-1 text-sm text-muted-foreground">For checked-in guests with an open folio.</p>
        </div>
        <GuestLaundryDialog rooms={rooms} catalog={catalog} />
      </div>
      {rooms.length === 0 || catalog.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed px-4 py-8 text-center" role="status">
          <Shirt className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          {rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms have checked-in guests with open folios. Check the reservation status before recording laundry.</p>}
          {catalog.length === 0 && <p className="text-sm text-muted-foreground">The guest laundry service catalogue is not available. Ask an administrator to set up the service articles.</p>}
        </div>
      ) : (
        <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
          <p><span className="num font-semibold text-foreground">{rooms.length.toLocaleString("id-ID")}</span> rooms available · <span className="num font-semibold text-foreground">{catalog.length.toLocaleString("id-ID")}</span> laundry services</p>
          <p className="mt-2">Select Record Guest Laundry to enter laundry items, quantities and prices. Charges can be posted to the room folio or paid directly.</p>
        </div>
      )}
    </Card>
  );
}
