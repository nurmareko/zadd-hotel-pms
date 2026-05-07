import { ReservationStatus } from "@prisma/client";
import { format, startOfDay } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReservationDetailPageProps = {
  params: Promise<{ id: string }>;
};

function dateLabel(date: Date) {
  return format(date, "dd MMM yyyy", { locale: indonesianLocale });
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-[12px] font-medium text-console-ink">{value}</dd>
    </div>
  );
}

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { id } = await params;
  const reservationId = Number(id);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    notFound();
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
      roomType: { select: { code: true, name: true } },
    },
  });

  if (!reservation) {
    notFound();
  }

  const canCheckIn =
    reservation.status === ReservationStatus.CONFIRMED &&
    startOfDay(reservation.arrivalDate) <= startOfDay(new Date());

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Reservation Form
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Edit/view mode placeholder with current reservation context.
          </p>
        </div>

        {canCheckIn ? (
          <Link
            href={`/app/fo/check-in/${reservation.id}`}
            className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
          >
            Check In Guest
          </Link>
        ) : null}
      </div>

      <section className="max-w-3xl border border-console-border bg-console-surface">
        <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          // Reservation
        </div>
        <dl className="grid gap-3.5 p-3.5 sm:grid-cols-2">
          <DetailItem label="Reservation No" value={reservation.reservationNo} />
          <DetailItem label="Guest" value={reservation.guest.fullName} />
          <DetailItem label="Status" value={reservation.status} />
          <DetailItem
            label="Room Type"
            value={`${reservation.roomType.code} - ${reservation.roomType.name}`}
          />
          <DetailItem label="Room" value={reservation.room?.number ?? "-"} />
          <DetailItem
            label="Arrival"
            value={dateLabel(reservation.arrivalDate)}
          />
          <DetailItem
            label="Departure"
            value={dateLabel(reservation.departureDate)}
          />
          <DetailItem
            label="Rate / Night"
            value={formatIDR(reservation.rateAmount.toString())}
          />
        </dl>
      </section>
    </main>
  );
}
