import type { LinenBatchStatus } from "@prisma/client";

export {
  LINEN_ITEM_LABELS as ITEM_LABELS,
  LINEN_STATUS_LABELS as STATUS_LABELS,
} from "@/lib/laundry/logic";

export const STATUS_CLASSES = {
  SENT: "border-amber-200 bg-amber-50 text-amber-800",
  WASHING: "border-blue-200 bg-blue-50 text-blue-800",
  CLEAN: "border-emerald-200 bg-emerald-50 text-emerald-800",
} satisfies Record<LinenBatchStatus, string>;

export const controlClass = "mt-1 h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-ring disabled:opacity-50";
