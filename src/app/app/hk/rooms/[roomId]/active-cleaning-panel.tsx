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
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/50 rounded-t-lg px-5 py-4">
        <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">
          {"Cleaning in Progress"}
        </h2>
      </div>
      <div className="space-y-3.5 p-3.5">
        <div className="text-[12px] text-slate-600">
          Started{" "}
          <span className="font-semibold text-slate-900">
            {formatTimeID(startedAt)}
          </span>{" "}
          by {housekeeperName}
        </div>

        <div className="border border-slate-100 bg-slate-50 p-4 text-center">
          <CleaningTimer startedAt={startedAt} />
        </div>

        <p className="border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
          The assigned attendant is cleaning this room. You can monitor the timer here; only that attendant can complete the session.
        </p>
      </div>
    </section>
  );
}
