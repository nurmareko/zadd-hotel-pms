import type { ReactNode } from "react";

type PinnedActionFooterProps = {
  hint: ReactNode;
  actions: ReactNode;
};

/**
 * Keeps a form's current action clear of the mobile bottom navigation while
 * preserving the standard desktop inset.
 */
export function PinnedActionFooter({
  hint,
  actions,
}: PinnedActionFooterProps) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 desktop:bottom-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur">
        <div className="min-w-0 text-sm">{hint}</div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
