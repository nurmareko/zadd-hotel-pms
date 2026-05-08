import { ReservationStatus } from "@prisma/client";
import { format } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dateOnlyBoundary, todayDateOnly } from "@/lib/date-only";
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="num text-right font-medium text-console-ink">
        {value}
      </span>
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

  const { today } = todayDateOnly();
  const canCheckIn =
    reservation.status === ReservationStatus.CONFIRMED &&
    dateOnlyBoundary(reservation.arrivalDate) <= today;
  const nights = Math.max(
    0,
    Math.round(
      (reservation.departureDate.getTime() - reservation.arrivalDate.getTime()) /
        86_400_000,
    ),
  );

  return (
    <main className="min-h-screen bg-console-bg px-5 py-4 text-console-ink md:px-6 md:py-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold uppercase tracking-[0.02em]">
            <span className="text-console-accent">▸ </span>
            Reservation Form
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Review data tamu dan periode menginap reservasi.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
            href="/app/fo/reservations"
            className="inline-flex h-8 items-center justify-center border border-console-border bg-console-surface px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg"
          >
            Kembali
          </Link>
          {canCheckIn ? (
            <Link
              href={`/app/fo/check-in/${reservation.id}`}
              className="inline-flex h-8 items-center justify-center border border-console-ink bg-console-ink px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-console-accent hover:bg-slate-800"
            >
              Check In Guest
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-console-border bg-console-surface">
          <div className="p-5">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Data Tamu
            </h2>
            <dl className="grid gap-3.5 sm:grid-cols-2">
              <DetailItem
                label="Nama Lengkap"
                value={reservation.guest.fullName}
              />
              <DetailItem label="Nomor Identitas" value="-" />
              <DetailItem label="Telepon" value="-" />
              <DetailItem label="Email" value="-" />
              <DetailItem label="Kewarganegaraan" value="-" />
              <DetailItem label="Alamat" value="-" />
            </dl>

            <div className="mt-5 border-t border-console-border-soft pt-5">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                Detail Reservasi
              </h2>
              <dl className="grid gap-3.5 sm:grid-cols-2">
                <DetailItem
                  label="Reservation No"
                  value={reservation.reservationNo}
                />
                <DetailItem label="Status" value={reservation.status} />
                <DetailItem
                  label="Arrival"
                  value={dateLabel(reservation.arrivalDate)}
                />
                <DetailItem
                  label="Departure"
                  value={dateLabel(reservation.departureDate)}
                />
                <DetailItem
                  label="Tipe Kamar"
                  value={`${reservation.roomType.code} - ${reservation.roomType.name}`}
                />
                <DetailItem
                  label="Kamar"
                  value={reservation.room?.number ?? "-"}
                />
              </dl>
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-3">
          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Ringkasan Tarif"}
            </div>
            <div className="p-3.5">
              <SummaryRow label="Tipe" value={reservation.roomType.name} />
              <SummaryRow
                label="Rate / malam"
                value={formatIDR(reservation.rateAmount.toString())}
              />
              <SummaryRow label="Jumlah malam" value={String(nights)} />
              <div className="my-2 border-t border-console-border-soft" />
              <SummaryRow
                label="Subtotal kamar"
                value={formatIDR(
                  Number(reservation.rateAmount.toString()) * nights,
                )}
              />
              <SummaryRow
                label="Deposit"
                value={formatIDR(reservation.deposit.toString())}
              />
            </div>
          </section>

          <section className="border border-console-border bg-console-surface">
            <div className="bg-console-ink px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
              {"// Ketersediaan"}
            </div>
            <div className="p-3.5 text-[13px]">
              <div className="flex items-center gap-2 bg-status-oc-bg px-2.5 py-2 font-medium text-status-oc-fg">
                <span className="h-2 w-2 bg-status-oc-pip" aria-hidden="true" />
                <span>
                  {reservation.room
                    ? `Kamar ${reservation.room.number} tercatat`
                    : "Kamar belum tercatat"}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Status dan ketersediaan mengikuti data reservasi saat ini.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
