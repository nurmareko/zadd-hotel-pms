import type { LostFoundCategory, LostFoundStatus } from "@prisma/client";
import { CircleHelp, FileText, Gem, Glasses, Shirt, Smartphone, type LucideIcon } from "lucide-react";

export const LOST_FOUND_CATEGORY_LABELS: Record<LostFoundCategory, string> = {
  ELECTRONICS: "Elektronik / Gadget", CLOTHING: "Pakaian / Tekstil", DOCUMENTS: "Dokumen / Identitas",
  VALUABLES: "Barang Berharga", ACCESSORIES: "Aksesoris / Pribadi", OTHER: "Lainnya",
};
export const LOST_FOUND_STATUS_LABELS: Record<LostFoundStatus, string> = {
  UNCLAIMED: "Disimpan", RETURNED: "Dikembalikan", DISPOSED: "Dimusnahkan / Dihibahkan",
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
