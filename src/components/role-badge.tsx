import { cn } from "@/lib/utils";
import type { AppRole } from "@/auth";

export const roleBadgeClassNames: Record<AppRole, string> = {
  FO: "border-blue-200 bg-blue-50 text-blue-700",
  HK: "border-amber-200 bg-amber-50 text-amber-700",
  FB: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ACC: "border-purple-200 bg-purple-50 text-purple-700",
  ADMIN: "border-slate-300 bg-slate-100 text-slate-800",
};

export const roleNames: Record<AppRole, string> = {
  FO: "Front Office",
  HK: "Housekeeping",
  FB: "Food & Beverage",
  ACC: "Accounting",
  ADMIN: "Administrator",
};

export function RoleBadge({
  role,
  showFullName = false,
  className,
}: {
  role: AppRole;
  showFullName?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide",
        roleBadgeClassNames[role],
        className,
      )}
    >
      {showFullName ? roleNames[role] : role}
    </span>
  );
}
