import type { LostFoundCategory, LostFoundStatus } from "@prisma/client";
import { CircleHelp, FileText, Gem, Glasses, Shirt, Smartphone, type LucideIcon } from "lucide-react";

export const LOST_FOUND_CATEGORY_LABELS: Record<LostFoundCategory, string> = {
  ELECTRONICS: "Electronics / Gadgets", CLOTHING: "Clothing / Textiles", DOCUMENTS: "Documents / Identification",
  VALUABLES: "Valuables", ACCESSORIES: "Accessories / Personal Items", OTHER: "Other",
};
export const LOST_FOUND_STATUS_LABELS: Record<LostFoundStatus, string> = {
  UNCLAIMED: "Stored", RETURNED: "Returned", DISPOSED: "Disposed / Donated",
};
export const LOST_FOUND_STATUS_STYLES: Record<LostFoundStatus, { badge: string; pip: string }> = {
  UNCLAIMED: { badge: "bg-status-vd-bg text-status-vd-fg border-status-vd-pip", pip: "bg-status-vd-pip" },
  RETURNED: { badge: "bg-status-vc-bg text-status-vc-fg border-status-vc-pip", pip: "bg-status-vc-pip" },
  DISPOSED: { badge: "bg-status-oos-bg text-status-oos-fg border-status-oos-pip", pip: "bg-status-oos-pip" },
};
export const LOST_FOUND_CATEGORY_ICONS: Record<LostFoundCategory, LucideIcon> = {
  ELECTRONICS: Smartphone, CLOTHING: Shirt, DOCUMENTS: FileText,
  VALUABLES: Gem, ACCESSORIES: Glasses, OTHER: CircleHelp,
};
