import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatusBadgeSize = "sm" | "md";

const sizeClassNames: Record<StatusBadgeSize, string> = {
  sm: "h-5 px-1.5",
  md: "h-6 px-2",
};

export function StatusBadge({
  label,
  className,
  pipClassName = "bg-current",
  showPip = true,
  size = "sm",
}: {
  label: ReactNode;
  className: string;
  pipClassName?: string;
  showPip?: boolean;
  size?: StatusBadgeSize;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border text-[10px] font-semibold uppercase tracking-[0.06em]",
        sizeClassNames[size],
        className,
      )}
    >
      {showPip ? (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5", pipClassName)} />
      ) : null}
      {label}
    </span>
  );
}
