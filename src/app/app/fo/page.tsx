import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";

import { auth } from "@/auth";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { todayDateOnly } from "@/lib/date-only";
import { calculateOccupancy, summarizeInHouse, summarizeRoomStatuses } from "@/lib/fo-dashboard";
import { absoluteBalanceLabel, folioBalanceState } from "@/lib/folio-balance-display";
import { computeFolioTotals } from "@/lib/folio-totals";
import { formatIDR } from "@/lib/format";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FOIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "reservations:read")) redirect("/app/forbidden");

  const { today } = todayDateOnly();
  const [settings, arrivals, departures, inHouseReservations, rooms] = await Promise.all([
    prisma.hotelSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.reservation.findMany({
      where: { status: "CONFIRMED", arrivalDate: today },
      include: { guest: true, roomType: true, room: true },
      orderBy: [{ room: { number: "asc" } }, { reservationNo: "asc" }],
    }),
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN", departureDate: today },
      include: { guest: true, room: true, folio: { include: { lineItems: { include: { article: true } }, payments: true } } },
      orderBy: [{ room: { number: "asc" } }, { reservationNo: "asc" }],
    }),
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN" },
      select: { id: true, adults: true, children: true },
    }),
    prisma.room.findMany({ select: { id: true, number: true, status: true } }),
  ]);
  const statuses = summarizeRoomStatuses(rooms);
  const inHouse = summarizeInHouse(inHouseReservations);
  const occupancy = calculateOccupancy(rooms.length, statuses.occupied, statuses.ooo);
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long", timeZone: "UTC",
  }).format(today);
  const metrics = [
    { label: "Kedatangan Hari Ini", value: arrivals.length, detail: "Menunggu check-in" },
    { label: "Keberangkatan Hari Ini", value: departures.length, detail: "Menunggu check-out" },
    { label: "Tamu Menginap", value: `${inHouse.guestCount} tamu`, detail: `${inHouse.roomCount} kamar ditempati` },
    { label: "Tingkat Okupansi", value: `${occupancy.occupancyRate.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`, detail: `${statuses.occupied} terisi / ${occupancy.sellableRooms} kamar layak jual` },
  ];
  const statusCards = [
    { label: "Bersih (VC)", count: statuses.clean, color: "bg-status-vc-bg text-status-vc-fg" },
    { label: "Kotor (VD)", count: statuses.dirty, color: "bg-status-vd-bg text-status-vd-fg" },
    { label: "Menunggu Inspeksi (VCU)", count: statuses.inspected, color: "bg-status-vcu-bg text-status-vcu-fg" },
    { label: "Terisi (OC/OD)", count: statuses.occupied, color: "bg-status-oc-bg text-status-oc-fg" },
    { label: "Perbaikan (OOO)", count: statuses.ooo, color: "bg-status-ooo-bg text-status-ooo-fg" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard Front Office</h1>
            <p className="mt-1 text-sm text-slate-500">Ringkasan operasional hari ini. Data diperbarui saat halaman dimuat.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
            <CalendarDays aria-hidden="true" className="size-4" />{dateLabel} WIB
          </span>
        </div>
        <nav aria-label="Aksi cepat" className="flex flex-wrap gap-2">
          <Link className={buttonVariants()} href="/app/fo/reservasi/new"><Plus aria-hidden="true" />Reservasi Baru</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/app/fo/reservasi/kalender">Kalender</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/app/fo/reservasi/list">Daftar Reservasi</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/app/fo/tamu">Tamu</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/app/fo/room-blocks">Blokir Kamar</Link>
        </nav>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <dt className="text-sm font-medium text-slate-600">{metric.label}</dt>
            <dd className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{metric.value}</dd>
            <dd className="mt-1 text-sm text-slate-500">{metric.detail}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section aria-labelledby="arrivals-heading" className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 md:p-5">
            <h2 id="arrivals-heading" className="text-lg font-semibold text-slate-900">Antrean Kedatangan</h2>
            <p className="mt-1 text-sm text-slate-500">{arrivals.length} reservasi menunggu check-in hari ini.</p>
          </div>
          {arrivals.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Tidak ada kedatangan yang menunggu check-in hari ini. Lihat Kalender untuk jadwal berikutnya.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {arrivals.map((reservation) => (
                <li key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 p-4 md:px-5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="break-words font-semibold text-slate-900">{reservation.guest.fullName}</p>
                    <p className="text-xs text-slate-500">{reservation.reservationNo}</p>
                    <p className="mt-1 text-sm text-slate-600">{reservation.room ? `Kamar ${reservation.room.number}` : "Kamar belum ditentukan"} · {reservation.roomType.name} · {reservation.adults + reservation.children} tamu</p>
                  </div>
                  <Link href={`/app/fo/reservasi/${reservation.id}`} aria-label={`Check-in ${reservation.guest.fullName}, ${reservation.reservationNo}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Check-in</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="departures-heading" className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 md:p-5">
            <h2 id="departures-heading" className="text-lg font-semibold text-slate-900">Antrean Keberangkatan</h2>
            <p className="mt-1 text-sm text-slate-500">Saldo berdasarkan tagihan yang sudah dibukukan. Tagihan tertunda dihitung saat check-out.</p>
          </div>
          {departures.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Tidak ada tamu yang menunggu check-out hari ini. Lihat Daftar Reservasi untuk jadwal berikutnya.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {departures.map((reservation) => {
                const balance = reservation.folio ? computeFolioTotals(reservation.folio.lineItems, reservation.folio.payments, settings).balance : null;
                const state = balance === null ? null : folioBalanceState(balance);
                return (
                  <li key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 p-4 md:px-5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="break-words font-semibold text-slate-900">{reservation.guest.fullName}</p>
                      <p className="text-xs text-slate-500">{reservation.reservationNo} · {reservation.room ? `Kamar ${reservation.room.number}` : "Kamar belum ditentukan"}</p>
                      <div className="mt-2">
                        <StatusBadge className={state === "settled" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"} label={balance === null ? "Folio belum tersedia" : state === "settled" ? "Lunas" : state === "credit" ? `Kelebihan ${absoluteBalanceLabel(balance)}` : `Sisa ${formatIDR(balance)}`} />
                      </div>
                    </div>
                    <Link href={reservation.folio ? `/app/fo/check-out/${reservation.folio.id}` : `/app/fo/reservasi/${reservation.id}`} aria-label={`${reservation.folio ? "Check-out" : "Lihat reservasi"} ${reservation.guest.fullName}, ${reservation.reservationNo}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{reservation.folio ? "Check-out" : "Lihat Reservasi"}</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="rooms-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <h2 id="rooms-heading" className="text-lg font-semibold text-slate-900">Status Kamar</h2>
        <p className="mt-1 text-sm text-slate-500">{rooms.length} kamar · Kamar OOO tidak termasuk kapasitas layak jual.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statusCards.map((status) => (
            <div key={status.label} className="rounded-md border border-slate-100 p-3">
              <dt><StatusBadge className={`${status.color} h-auto min-h-5 whitespace-normal py-1`} label={status.label} /></dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{status.count}<span className="ml-2 text-sm font-normal text-slate-500">kamar</span></dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
