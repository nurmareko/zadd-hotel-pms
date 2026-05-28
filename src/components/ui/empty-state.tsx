import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-col items-center justify-center border border-dashed border-console-border bg-console-bg px-4 py-8 text-center",
        className,
      )}
    >
      <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
      <h3 className="mt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-console-ink">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-md text-[11px] leading-5 text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
