import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PinnedActionFooterProps = {
  hint: ReactNode;
  actions: ReactNode;
  actionsClassName?: string;
  className?: string;
  desktopPanel?: boolean;
};

/**
 * Keeps a form's current action clear of the mobile bottom navigation while
 * preserving the standard desktop inset.
 */
export function PinnedActionFooter({
  hint,
  actions,
  actionsClassName,
  className,
  desktopPanel = false,
}: PinnedActionFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 desktop:bottom-4",
        desktopPanel && "desktop:lg:static desktop:lg:mt-auto desktop:lg:z-auto",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur",
          desktopPanel &&
            "desktop:lg:flex-col desktop:lg:items-stretch desktop:lg:gap-0 desktop:lg:bg-white desktop:lg:p-0 desktop:lg:backdrop-blur-none",
        )}
      >
        {hint ? (
          <div
            className={cn(
              "min-w-0 text-sm",
              desktopPanel && "desktop:lg:px-4 desktop:lg:py-3",
            )}
          >
            {hint}
          </div>
        ) : null}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            desktopPanel &&
              "desktop:lg:w-full desktop:lg:px-4 desktop:lg:py-3 desktop:lg:[&>*]:flex-1",
            desktopPanel && hint && "desktop:lg:border-t desktop:lg:border-slate-200",
            actionsClassName,
          )}
        >
          {actions}
        </div>
      </div>
    </div>
  );
}
