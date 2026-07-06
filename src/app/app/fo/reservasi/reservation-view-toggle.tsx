"use client";

import { CalendarDays, List } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  FO_RESERVASI_VIEW_PATHS,
  type FoReservasiView,
} from "@/lib/nav-preferences";
import { setFoReservasiView } from "./view-actions";

const views: Array<{
  value: FoReservasiView;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { value: "kalender", label: "Kalender", icon: CalendarDays },
  { value: "list", label: "List", icon: List },
];

export function ReservationViewToggle({
  currentView,
}: {
  currentView: FoReservasiView;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectView(view: FoReservasiView) {
    if (view === currentView) {
      return;
    }

    startTransition(async () => {
      await setFoReservasiView(view);
      router.push(FO_RESERVASI_VIEW_PATHS[view]);
    });
  }

  return (
    <div
      aria-label="Tampilan reservasi"
      className="inline-flex rounded-md border border-slate-300 bg-white p-1 shadow-sm"
      role="group"
    >
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = view.value === currentView;

        return (
          <button
            key={view.value}
            type="button"
            aria-pressed={isActive}
            disabled={isPending}
            onClick={() => selectView(view.value)}
            className={[
              "inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-sm font-medium transition-colors disabled:cursor-wait",
              isActive
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
