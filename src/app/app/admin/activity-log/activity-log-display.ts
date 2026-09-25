import { ActivityAction, type Prisma } from "@prisma/client";
import { formatCompactDateTimeID, formatIDR } from "@/lib/format";

export const activityLabels = {
  RESERVATION_CREATED: "Reservasi Dibuat",
  RESERVATION_UPDATED: "Reservasi Diubah",
  RESERVATION_CANCELLED: "Reservasi Dibatalkan",
  CHECK_IN_COMPLETED: "Check-in Selesai",
  CHECK_OUT_COMPLETED: "Check-out Selesai",
  PAYMENT_RECORDED: "Pembayaran Dicatat",
  FOLIO_CHARGE_POSTED: "Biaya Ditambahkan",
} satisfies Record<ActivityAction, string>;

export type ActivityQuery = {
  action?: string | string[];
  userId?: string | string[];
  page?: string | string[];
};

function positiveInteger(value: string | string[] | undefined, max: number) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= max
    ? number
    : undefined;
}

export function parseActivityQuery(query: ActivityQuery) {
  return {
    action: Object.values(ActivityAction).find((action) => action === query.action),
    // User.id is a PostgreSQL Int, not a cuid or an arbitrary JS number.
    userId: positiveInteger(query.userId, 2_147_483_647),
    page: positiveInteger(query.page, Number.MAX_SAFE_INTEGER) ?? 1,
  };
}

export function activityHref(filters: ReturnType<typeof parseActivityQuery>, page = 1) {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.userId) params.set("userId", String(filters.userId));
  if (page > 1) params.set("page", String(page));
  return `/app/admin/activity-log${params.size ? `?${params}` : ""}`;
}

const hotelTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function activityTime(date: Date) {
  const parts = Object.fromEntries(hotelTime.formatToParts(date).map(({ type, value }) => [type, value]));
  // The shared formatter uses server-local time. Format the WIB calendar date at
  // local noon, then append the explicit WIB clock to avoid server DST gaps.
  const calendarDate = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12);
  return `${formatCompactDateTimeID(calendarDate).slice(0, -5)}${parts.hour}:${parts.minute} WIB`;
}

const paymentMethods: Record<string, string> = {
  CASH: "Tunai", CARD: "Kartu", TRANSFER: "Transfer", CHARGE_TO_ROOM: "Tagihkan ke kamar",
};

export function activitySummary(metadata: Prisma.JsonValue) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "—";
  const summary: string[] = [];
  if (typeof metadata.amount === "number" && Number.isFinite(metadata.amount)) {
    summary.push(formatIDR(metadata.amount));
  }
  if (typeof metadata.method === "string" && Object.hasOwn(paymentMethods, metadata.method)) {
    summary.push(`Metode: ${paymentMethods[metadata.method]}`);
  }
  // Only fields emitted by production writers or the activity demo seed belong here.
  for (const [key, label] of [["article", "Artikel"], ["note", "Catatan"]] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      const text = value.trim();
      summary.push(`${label}: ${text.length > 300 ? `${text.slice(0, 300)}…` : text}`);
    }
  }
  return summary.join(" · ") || "—";
}
