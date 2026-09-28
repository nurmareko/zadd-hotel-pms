"use client";

import { useEffect, useState } from "react";
import { Check, ChefHat, Clock3, Flame, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";

import { advanceKitchenOrder } from "./actions";
import {
  formatKitchenElapsedTime,
  isKitchenOrderLate,
} from "@/lib/kitchen-display";

type KitchenTicket = {
  id: number;
  orderNo: string;
  destination: string;
  serviceLabel: string;
  waiterName: string;
  openedAt: string;
  isCooking: boolean;
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    notes: string | null;
  }>;
};

type KitchenDisplayProps = {
  tickets: KitchenTicket[];
  initialNow: string;
};

function KitchenTicketCard({ ticket, now }: { ticket: KitchenTicket; now: Date }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCooking, setIsCooking] = useState(ticket.isCooking);
  const openedAt = new Date(ticket.openedAt);
  const isLate = isKitchenOrderLate(openedAt, now);

  async function handleKitchenAction() {
    setIsPending(true);
    setActionError(null);

    try {
      const result = await advanceKitchenOrder({
        orderId: ticket.id,
        transition: isCooking ? "READY" : "START",
      });

      if (!result.ok) {
        setActionError(result.error);
        router.refresh();
        return;
      }

      if (result.status === "COOKING") {
        setIsCooking(true);
      }
      router.refresh();
    } catch {
      setActionError("Status pesanan gagal diperbarui. Coba lagi.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <article
      className={`flex min-h-72 flex-col rounded-lg border-2 bg-white p-4 shadow-sm transition-colors ${isLate ? "border-red-500" : "border-slate-200"
        }`}
      aria-label={`Order ${ticket.orderNo}${isLate ? ", terlambat" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {ticket.orderNo} · {ticket.serviceLabel}
          </p>
          <h2 className="mt-1 truncate text-xl font-bold text-slate-950">
            {ticket.destination}
          </h2>
          <p className="mt-1 truncate text-sm text-slate-500">Pelayan: {ticket.waiterName}</p>
        </div>
        <div className={`shrink-0 text-right ${isLate ? "text-red-600" : "text-emerald-700"}`}>
          {isLate ? (
            <span className="block text-xs font-extrabold uppercase tracking-wider">Terlambat</span>
          ) : null}
          <span className="mt-1 flex items-center justify-end gap-1 font-mono text-lg font-bold tabular-nums">
            <Clock3 className="size-4" aria-hidden="true" />
            {formatKitchenElapsedTime(openedAt, now)}
          </span>
        </div>
      </div>

      <ul className="flex-1 divide-y divide-slate-100 py-2" aria-label={`Item ${ticket.orderNo}`}>
        {ticket.items.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-sm font-bold text-emerald-800">
                {item.quantity}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{item.name}</p>
                {item.notes ? <p className="mt-0.5 text-sm text-amber-800">Catatan: {item.notes}</p> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {isCooking ? (
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700" role="status">
          <Flame className="size-4" aria-hidden="true" />
          Sedang dimasak
        </p>
      ) : null}
      {actionError ? (
        <p className="mb-2 text-sm font-medium text-red-700" role="alert">
          {actionError}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        disabled={isPending}
        onClick={() => void handleKitchenAction()}
      >
        {isCooking ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Flame className="size-4" aria-hidden="true" />
        )}
        {isPending
          ? "Memperbarui..."
          : isCooking
            ? "Tandai selesai"
            : "Mulai memasak"}
      </button>
    </article>
  );
}

export function KitchenDisplay({ tickets, initialNow }: KitchenDisplayProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const refresh = window.setInterval(() => router.refresh(), 10_000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [router]);

  return (
    <section aria-live="polite" aria-label="Antrian pesanan dapur">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock3 className="size-4" aria-hidden="true" />
          <span>Waktu diperbarui setiap detik · Antrian disegarkan otomatis</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
          <UtensilsCrossed className="size-4" aria-hidden="true" />
          {tickets.length} pesanan aktif
        </span>
      </div>

      {tickets.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center">
          <ChefHat className="size-8 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Belum ada pesanan untuk dapur</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Pesanan akan muncul di sini setelah item ditambahkan ke order yang masih terbuka.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tickets.map((ticket) => <KitchenTicketCard key={ticket.id} ticket={ticket} now={now} />)}
        </div>
      )}
    </section>
  );
}
