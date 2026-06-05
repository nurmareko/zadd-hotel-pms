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
    <section className="border border-console-border bg-console-surface">
      <div className="bg-console-ink px-3.5 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-console-accent">
          {"// Pembersihan Berlangsung"}
        </h2>
      </div>
      <div className="space-y-3.5 p-3.5">
        <div className="text-[12px] text-slate-600">
          Dimulai{" "}
          <span className="font-semibold text-console-ink">
            {formatTimeID(startedAt)}
          </span>{" "}
          oleh {housekeeperName}
        </div>

        <div className="border border-console-border-soft bg-console-bg p-4 text-center">
          <CleaningTimer startedAt={startedAt} />
        </div>

        <p className="border border-console-border-soft bg-console-bg px-3 py-2 text-[12px] leading-relaxed text-slate-600">
          Pembersihan berjalan dari daftar kerja housekeeper. Supervisor dapat
          memantau timer di sini, tetapi penyelesaian dilakukan dari Kamar Saya.
        </p>
      </div>
    </section>
  );
}
