import { formatTimeID } from "@/lib/format";

import { CleaningTimer } from "./cleaning-timer";

type ActiveCleaningPanelProps = {
  startedAt: Date;
  housekeeperName: string;
};

export function ActiveCleaningPanel({
  startedAt,
  housekeeperName,
}: ActiveCleaningPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/50 rounded-t-2xl px-5 py-4">
        <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">
          {"Pembersihan Berlangsung"}
        </h2>
      </div>
      <div className="space-y-3.5 p-3.5">
        <div className="text-[12px] text-slate-600">
          Dimulai{" "}
          <span className="font-semibold text-slate-900">
            {formatTimeID(startedAt)}
          </span>{" "}
          oleh {housekeeperName}
        </div>

        <div className="border border-slate-100 bg-slate-50 p-4 text-center">
          <CleaningTimer startedAt={startedAt} />
        </div>

        <p className="border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
          Pembersihan berjalan dari tugas housekeeper. Supervisor dapat memantau
          timer di sini, tetapi penyelesaian tetap dilakukan oleh housekeeper
          yang bertugas.
        </p>
      </div>
    </section>
  );
}
