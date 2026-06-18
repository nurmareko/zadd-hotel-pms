import { cn } from "@/lib/utils";

const consoleButtonBaseClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 px-4 py-2 shadow-sm [&_svg]:h-4 [&_svg]:w-4";

const consoleButtonVariantClassNames = {
  primary:
    "border-transparent bg-emerald-600 text-white hover:bg-emerald-700",
  secondary:
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
  danger: "border-transparent bg-red-600 text-white hover:bg-red-700",
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
