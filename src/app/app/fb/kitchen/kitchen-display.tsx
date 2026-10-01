"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChefHat, Clock3, Flame, Maximize, Minimize, UtensilsCrossed, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";

import { advanceKitchenOrder } from "./actions";
import {
  formatKitchenElapsedTime,
  isKitchenOrderLate,
} from "@/lib/kitchen-display";

import { filterTicketsByStation, KITCHEN_STATIONS, KITCHEN_STATION_LABELS, resolveItemStation, type KitchenStation } from "@/lib/kitchen-stations";

const categoryLabels: Record<string, string> = {
  mains: "Hidangan utama", breakfast: "Sarapan", dessert: "Hidangan penutup",
  soup: "Sup", beverage: "Minuman", beverages: "Minuman", drink: "Minuman",
  drinks: "Minuman", snacks: "Camilan", grill: "Panggangan", fryer: "Gorengan",
};

function categoryLabel(category?: string | null) {
  return categoryLabels[category?.trim().toLowerCase() ?? ""] ?? (category?.trim() || "Lainnya");
}

function playChime(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, start);
  oscillator.frequency.setValueAtTime(880, start + 0.15);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(start);
  oscillator.stop(start + 0.5);
}

type KitchenTicket = {
  id: number;
  orderNo: string;
  destination: string;
  serviceLabel: string;
  waiterName: string;
  guestCount?: number;
  openedAt: string;
  kitchenStartedAt: string | null;
  items: Array<{
    id: number;
    name: string;
    category?: string | null;
    quantity: number;
    notes: string | null;
  }>;
};

type KitchenDisplayProps = {
  tickets: KitchenTicket[];
  initialNow: string;
};

function KitchenTicketCard({ ticket, now, hidden }: { ticket: KitchenTicket; now: Date; hidden: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [readyItems, setReadyItems] = useState<Set<number>>(() => new Set());
  const isCooking = ticket.kitchenStartedAt !== null;
  const groups = new Map<string, KitchenTicket["items"]>();
  for (const item of ticket.items) {
    const label = categoryLabel(item.category);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  const primaryStation = resolveItemStation(ticket.items[0]?.category, ticket.items[0]?.name);
  const readyCount = ticket.items.filter((item) => readyItems.has(item.id)).length;
  const openedAt = new Date(ticket.openedAt);
  const isLate = isKitchenOrderLate(openedAt, now);

  async function handleKitchenAction() {
    setIsPending(true);
    setActionError(null);

    try {
      const result = await advanceKitchenOrder({
        orderId: ticket.id,
        transition: isCooking ? "READY" : "START",
        expectedKitchenStartedAt: ticket.kitchenStartedAt,
      });

      if (!result.ok) {
        setActionError(result.error);
        startRefresh(() => router.refresh());
        return;
      }

      startRefresh(() => router.refresh());
    } catch {
      setActionError("Status pesanan gagal diperbarui. Coba lagi.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <article
      hidden={hidden}
      className={`${hidden ? "hidden" : "flex"} min-h-72 flex-col rounded-lg border-2 bg-white p-4 shadow-sm transition-colors ${isLate ? "border-red-500" : "border-slate-200"
        }`}
      aria-label={`Pesanan ${ticket.orderNo}${isLate ? ", terlambat" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            KOT #{ticket.orderNo} · {ticket.serviceLabel}
          </p>
          <h2 className="mt-1 truncate text-xl font-bold text-slate-950">
            {ticket.destination}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{ticket.guestCount !== undefined ? `${ticket.guestCount} tamu · ` : ""}Pelayan: {ticket.waiterName}</p>
                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{KITCHEN_STATION_LABELS[primaryStation]}</span>
        </div>
        <div className={`shrink-0 text-right ${isLate ? "text-red-600" : "text-emerald-700"}`}>
          {isLate ? (
            <span className="block rounded bg-red-50 px-2 py-1 text-xs font-extrabold tracking-wider motion-safe:animate-pulse">TERLAMBAT</span>
          ) : null}
          <span className="mt-1 flex items-center justify-end gap-1 font-mono text-lg font-bold tabular-nums">
            <Clock3 className="size-4" aria-hidden="true" />
            {formatKitchenElapsedTime(openedAt, now)}
          </span>
        </div>
      </div>

      <div className="flex-1 py-2">
        {Array.from(groups, ([label, items]) => (
          <section key={label} aria-label={label}>
            <h3 className="pt-3 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</h3>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const ready = readyItems.has(item.id);
                return (
                  <li key={item.id} className="py-3">
                    <div className="flex items-start gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-sm font-bold text-emerald-800">{item.quantity}</span>
                      <UtensilsCrossed className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className={`break-words font-semibold ${ready ? "text-emerald-700" : "text-slate-900"}`}>{item.name}</p>
                        {item.notes ? <p className="mt-0.5 break-words text-sm text-amber-800">Catatan: {item.notes}</p> : null}
                        <button type="button" aria-pressed={ready} aria-label={`${ready ? "Batalkan kesiapan" : "Tandai Siap"}: ${item.name}`}
                          className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          onClick={() => setReadyItems((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                            return next;
                          })}>
                          {ready ? <Check className="size-4" aria-hidden="true" /> : null}
                          {ready ? "Siap" : "Tandai Siap"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mb-3 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-600" role="status">{`${readyCount} dari ${ticket.items.length} siap`}</p>

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
        disabled={isPending || isRefreshing}
        onClick={() => void handleKitchenAction()}
      >
        {isCooking ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Flame className="size-4" aria-hidden="true" />
        )}
        {isPending || isRefreshing
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
  const [station, setStation] = useState<KitchenStation>("ALL");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const previousIds = useRef(new Set(tickets.map((ticket) => ticket.id)));
  const visibleTickets = filterTicketsByStation(tickets, station);
  const visibleIds = new Set(visibleTickets.map((ticket) => ticket.id));

  useEffect(() => {
    const hasNewOrders = tickets.some((ticket) => !previousIds.current.has(ticket.id));
    previousIds.current = new Set(tickets.map((ticket) => ticket.id));
    if (hasNewOrders && soundEnabled && audio.current) {
      const context = audio.current;
      void context.resume().then(() => {
        if (audio.current === context) playChime(context);
      }).catch(() => {
        setSoundEnabled(false);
        setControlError("Suara gagal diputar. Aktifkan kembali suara untuk mencoba lagi.");
      });
    }
  }, [tickets, soundEnabled]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      const context = audio.current;
      audio.current = null;
      if (context) void context.close().catch(() => {});
    };
  }, []);

  async function toggleSound() {
    setControlError(null);
    if (soundEnabled) {
      setSoundEnabled(false);
      const context = audio.current;
      audio.current = null;
      if (context) void context.close().catch(() => {});
      return;
    }
    setSoundPending(true);
    try {
      if (!window.AudioContext) throw new Error("Audio unavailable");
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      await context.resume();
      playChime(context);
      setSoundEnabled(true);
    } catch {
      setControlError("Suara tidak tersedia. Periksa izin suara pada peramban, lalu coba lagi.");
    } finally {
      setSoundPending(false);
    }
  }

  async function toggleFullscreen() {
    setControlError(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setControlError("Layar penuh tidak tersedia pada peramban ini.");
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const refresh = window.setInterval(() => router.refresh(), 10_000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [router]);

  return (
    <section aria-label="Antrian pesanan dapur">
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter stasiun">
          {KITCHEN_STATIONS.map((value) => (
            <button key={value} type="button" aria-pressed={station === value} onClick={() => setStation(value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${station === value ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>
              {KITCHEN_STATION_LABELS[value]}
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{filterTicketsByStation(tickets, value).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={soundEnabled} disabled={soundPending} onClick={() => void toggleSound()} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60">
            {soundEnabled ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
            {soundEnabled ? "Suara aktif" : "Suara hening"}
          </button>
          <button type="button" aria-pressed={fullscreen} onClick={() => void toggleFullscreen()} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-100">
            {fullscreen ? <Minimize className="size-4" aria-hidden="true" /> : <Maximize className="size-4" aria-hidden="true" />}
            {fullscreen ? "Keluar layar penuh" : "Layar penuh"}
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">Daftar kesiapan hanya di layar ini; tidak tersimpan atau dibagikan. Perubahan isi pesanan menghapus tanda siap. Selesaikan pesanan setelah semua stasiun siap.</p>
      {controlError ? <p role="alert" className="mb-4 text-sm text-red-700">{controlError}</p> : null}
      <p className="sr-only" role="status">{visibleTickets.length} pesanan di stasiun {KITCHEN_STATION_LABELS[station]}</p>
      {visibleTickets.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center">
          <ChefHat className="size-8 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Belum ada pesanan untuk dapur</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Pesanan akan muncul di sini setelah item ditambahkan ke pesanan yang masih terbuka.
          </p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tickets.map((ticket) => (
          // Keep filtered tickets mounted; reset local readiness only when their contents change.
          <KitchenTicketCard key={`${ticket.id}:${JSON.stringify(ticket.items)}`} ticket={ticket} now={now} hidden={!visibleIds.has(ticket.id)} />
        ))}
      </div>
    </section>
  );
}
