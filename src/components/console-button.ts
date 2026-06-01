import { cn } from "@/lib/utils";

const consoleButtonBaseClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-none border px-3 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5";

const consoleButtonVariantClassNames = {
  primary:
    "border-console-ink bg-console-ink text-console-accent hover:border-slate-800 hover:bg-slate-800",
  secondary:
    "border-console-border bg-console-surface text-console-ink hover:border-console-ink hover:bg-console-bg",
  danger: "border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700",
};

export type ConsoleButtonVariant = keyof typeof consoleButtonVariantClassNames;

export function consoleButtonClassName(
  variant: ConsoleButtonVariant = "secondary",
  className?: string,
) {
  return cn(
    consoleButtonBaseClassName,
    consoleButtonVariantClassNames[variant],
    className,
  );
}
