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
    return <Card className="p-4" role="alert">Anda tidak memiliki akses untuk mencatat laundry tamu.</Card>;
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
          <h2 className="text-lg font-semibold">Laundry Tamu</h2>
          <p className="mt-1 text-sm text-muted-foreground">Untuk tamu yang sudah check-in dengan folio terbuka.</p>
        </div>
        <GuestLaundryDialog rooms={rooms} catalog={catalog} />
      </div>
      {rooms.length === 0 || catalog.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed px-4 py-8 text-center" role="status">
          <Shirt className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          {rooms.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kamar dengan tamu check-in dan folio terbuka. Periksa status reservasi sebelum mencatat laundry.</p>}
          {catalog.length === 0 && <p className="text-sm text-muted-foreground">Katalog layanan laundry tamu belum tersedia. Hubungi admin untuk menyiapkan artikel layanan.</p>}
        </div>
      ) : (
        <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
          <p><span className="num font-semibold text-foreground">{rooms.length.toLocaleString("id-ID")}</span> kamar tersedia · <span className="num font-semibold text-foreground">{catalog.length.toLocaleString("id-ID")}</span> layanan laundry</p>
          <p className="mt-2">Pilih Catat Laundry Tamu untuk memasukkan jenis cucian, jumlah, dan harga. Biaya dapat dibebankan ke folio kamar atau dibayar langsung.</p>
        </div>
      )}
    </Card>
  );
}
