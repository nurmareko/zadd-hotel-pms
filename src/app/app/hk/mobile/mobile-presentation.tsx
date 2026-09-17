"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";
import type { MobileCleaningRoom } from "@/lib/housekeeper-mobile-data";

const statusClasses: Record<string, string> = {
  VC: "border-status-vc-pip bg-status-vc-bg text-status-vc-fg",
  OC: "border-status-oc-pip bg-status-oc-bg text-status-oc-fg",
  VD: "border-status-vd-pip bg-status-vd-bg text-status-vd-fg",
  OD: "border-status-od-pip bg-status-od-bg text-status-od-fg",
  VCU: "border-status-vcu-pip bg-status-vcu-bg text-status-vcu-fg",
  OOO: "border-status-ooo-pip bg-status-ooo-bg text-status-ooo-fg",

};

const serviceLabels = {
  turnover: "Pembersihan pergantian tamu",
  stayover: "Pembersihan selama menginap",
  inspection: "Inspeksi kamar",
  routine: "Perawatan rutin",
};

export function MobileRoomSummary({ room }: { room: MobileCleaningRoom }) {
  return (
    <div className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold text-slate-900">Kamar {room.number}</h3>
          <p className="text-xs text-slate-600">Lantai {room.floor} · {room.typeName}</p>
        </div>
        <StatusBadge label={room.status} className={statusClasses[room.status]} size="md" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-1 font-semibold ${PRIORITY_CONFIG[room.priority].className}`}>
          {room.priority} - {PRIORITY_CONFIG[room.priority].label}
        </span>
        {room.taskCode ? <span className="font-semibold">{room.taskCode}</span> : null}
        <span className="text-slate-600">{serviceLabels[room.serviceKind]}</span>
      </div>
      {room.reservationContexts.map((context, index) => (
        <div key={`${context.kind}-${context.reservationNo}-${index}`} className="border-l-2 border-slate-200 pl-3 text-sm">
          <p className="font-medium">{context.label}: {context.guestName}</p>
          <p className="text-xs text-slate-600">
            {[context.reservationNo, context.nightsLabel].filter(Boolean).join(" · ")}
          </p>
          {context.etaLabel ? <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">ETA {context.etaLabel}</span> : null}
        </div>
      ))}
      {room.notes ? <p className="whitespace-pre-wrap text-sm text-slate-600"><span className="font-semibold">Catatan: </span>{room.notes}</p> : null}
      {room.taskNote ? <p className="whitespace-pre-wrap rounded-md bg-amber-50 p-3 text-sm text-amber-900"><span className="font-semibold">Instruksi tugas: </span>{room.taskNote}</p> : null}
    </div>
  );
}

// UI feedback only; authorization and state transitions remain in the local actions.
export function useMobileAction() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(successMessage);
        onSuccess?.();
      } catch {
        toast.error("Permintaan gagal. Periksa koneksi dan muat ulang sebelum mencoba lagi.");
      } finally {
        // Refresh failures too: a claim or session may have changed on another device.
        router.refresh();
        inFlight.current = false;
      }
    });
  }

  return { isPending, run };
}
