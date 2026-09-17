"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Monitor, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatWeekdayLongDateID } from "@/lib/format";
import type { HousekeeperMobileData } from "@/lib/housekeeper-mobile-data";
import { MobileTaskCard } from "./mobile-task-card";
import { MobilePoolCard } from "./mobile-pool-card";
import { QuickLostFoundDialog } from "./quick-lost-found-dialog";

export type MobileViewProps = {
  data: HousekeeperMobileData;
  userId: number;
  userName: string;
  userRole: string;
};

export function MobileView({ data, userId, userName, userRole }: MobileViewProps) {
  const router = useRouter();
  const [section, setSection] = useState<"mine" | "pool">("mine");
  const [isRefreshing, startRefresh] = useTransition();
  const [finding, setFinding] = useState<{ roomId?: number } | null>(null);
  const rooms = section === "mine" ? data.myRooms : data.availablePoolRooms;

  function refresh() {
    startRefresh(() => router.refresh());
  }

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-md px-3.5 py-4 pb-28 text-slate-900 [overflow-wrap:anywhere]">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">HK Mobile</h1>
            <p className="mt-1 text-sm font-medium">{userName}</p>
            <p className="text-xs text-slate-600">{userRole === "HK" ? "Petugas tata graha" : userRole === "ADMIN" ? "Administrator" : userRole}</p>
          </div>
          <Button variant="outline" onClick={() => setFinding({})} className="h-auto min-h-12 max-w-full shrink-0 whitespace-normal"><Plus aria-hidden="true" />Lapor Temuan</Button>
        </div>
        <p className="text-xs text-slate-600">{formatWeekdayLongDateID(data.date)}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/app/hk/rooms" className="inline-flex min-h-12 items-center gap-2 rounded-md px-2 text-sm font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2">
            <Monitor className="size-4 shrink-0" aria-hidden="true" />Ke Desktop
          </Link>
          <Button variant="ghost" disabled={isRefreshing} onClick={refresh} className="min-h-12">
            {isRefreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Muat ulang
          </Button>
        </div>
      </header>

      {/* Phone-sticky by design; the shell owns the header and bottom navigation. */}
      <div className="sticky top-(--app-mobile-header-height) z-10 bg-slate-50 py-3 desktop:top-0">
        <div role="group" aria-label="Daftar tugas kamar" className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          <Button variant={section === "mine" ? "default" : "ghost"} aria-pressed={section === "mine"} aria-controls="mobile-room-list" onClick={() => setSection("mine")} className="h-auto min-h-12 min-w-0 whitespace-normal px-2 py-2 desktop:h-auto">
            Tugas Saya ({data.myRooms.length})
          </Button>
          <Button variant={section === "pool" ? "default" : "ghost"} aria-pressed={section === "pool"} aria-controls="mobile-room-list" onClick={() => setSection("pool")} className="h-auto min-h-12 min-w-0 whitespace-normal px-2 py-2 desktop:h-auto">
            Kamar Tersedia ({data.availablePoolRooms.length})
          </Button>
        </div>
      </div>

      <section id="mobile-room-list" aria-labelledby="mobile-room-heading" aria-busy={isRefreshing} className="space-y-3">
        <h2 id="mobile-room-heading" className="text-base font-semibold">{section === "mine" ? "Tugas Anda hari ini" : "Kamar yang dapat diambil"}</h2>
        {rooms.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
            <ClipboardList className="mx-auto size-8 text-slate-400" aria-hidden="true" />
            <p className="text-sm font-semibold">{section === "mine" ? "Belum ada kamar yang ditugaskan" : "Belum ada kamar tersedia"}</p>
            <p className="text-sm text-slate-600">{section === "mine" ? "Lihat kamar tersedia untuk mengambil tugas, atau muat ulang untuk memeriksa penugasan terbaru." : "Semua kamar telah ditugaskan atau belum memerlukan tindakan. Muat ulang untuk memeriksa perubahan."}</p>
            {section === "mine" ? <Button variant="outline" onClick={() => setSection("pool")} className="min-h-12 w-full">Lihat kamar tersedia</Button> : null}
            <Button variant="outline" disabled={isRefreshing} onClick={refresh} className="min-h-12 w-full">
              {isRefreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Muat ulang
            </Button>
          </div>
        ) : section === "mine" ? (
          data.myRooms.map((room) => (
            <MobileTaskCard key={`${room.id}-${room.status}-${room.startedAt ? new Date(room.startedAt).getTime() : "idle"}-${room.activeHousekeeperId}-${room.inProgress}`} room={room} userId={userId} onReportFound={(roomId) => setFinding({ roomId })} />
          ))
        ) : (
          data.availablePoolRooms.map((room) => <MobilePoolCard key={room.id} room={room} />)
        )}
      </section>
      <QuickLostFoundDialog open={finding !== null} onOpenChange={(open) => { if (!open) setFinding(null); }} rooms={data.allHotelRooms} defaultRoomId={finding?.roomId} />
    </div>
  );
}
