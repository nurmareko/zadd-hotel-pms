import { ActivityAction, type Prisma } from "@prisma/client";
import { formatCompactDateTimeID, formatIDR } from "@/lib/format";

export const activityLabels = {
  RESERVATION_CREATED: "Reservation Created",
  RESERVATION_UPDATED: "Reservation Updated",
  RESERVATION_CANCELLED: "Reservation Cancelled",
  CHECK_IN_COMPLETED: "Check-in Completed",
  CHECK_OUT_COMPLETED: "Check-out Completed",
  PAYMENT_RECORDED: "Payment Recorded",
  FOLIO_CHARGE_POSTED: "Charge Posted",
  ROOM_CLEANED: "Room Cleaned",
  ROOM_INSPECTED: "Room Inspected",
  FB_ORDER_CREATED: "F&B Order Created",
  FB_ORDER_SETTLED: "F&B Order Settled",
  NIGHT_AUDIT_EXECUTED: "Night Audit Executed",
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
  CASH: "Cash", CARD: "Card", TRANSFER: "Transfer", CHARGE_TO_ROOM: "Charge to Room",
};

const serviceTypes: Record<string, string> = {
  DINE_IN: "Dine-in", ROOM_SERVICE: "Room Service",
};
const roomStatuses = new Set(["VC", "OC", "VD", "OD", "VCU", "OOO", "OOS"]);

function summaryText(value: Prisma.JsonValue | undefined) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const text = value.trim();
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

export function activitySummary(metadata: Prisma.JsonValue, action?: keyof typeof activityLabels) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "—";
  const summary: string[] = [];
  if (action === "ROOM_CLEANED" || action === "ROOM_INSPECTED") {
    const room = summaryText(metadata.roomNumber);
    if (room) summary.push(`Room ${room}`);
    if (typeof metadata.targetStatus === "string" && roomStatuses.has(metadata.targetStatus)) {
      summary.push(`Status: ${metadata.targetStatus}`);
    }
    return summary.join(" · ") || "—";
  }
  if (action === "FB_ORDER_CREATED" || action === "FB_ORDER_SETTLED") {
    const order = summaryText(metadata.orderNo);
    const service = typeof metadata.orderType === "string" && Object.hasOwn(serviceTypes, metadata.orderType)
      ? serviceTypes[metadata.orderType] : undefined;
    if (order) summary.push(`Order #${order}${action === "FB_ORDER_CREATED" && service ? ` (${service})` : ""}`);
    if (action === "FB_ORDER_SETTLED") {
      const amount = metadata.amount;
      const validAmount = (typeof amount === "number" ||
        (typeof amount === "string" && /^-?\d+(\.\d+)?$/.test(amount))) && Number.isFinite(Number(amount));
      const method = typeof metadata.paymentMethod === "string" && Object.hasOwn(paymentMethods, metadata.paymentMethod)
        ? paymentMethods[metadata.paymentMethod] : undefined;
      if (validAmount) summary.push(`Total: ${formatIDR(amount as number | string)}${method ? ` via ${method}` : ""}`);
    }
    return summary.join(" · ") || "—";
  }
  if (action === "NIGHT_AUDIT_EXECUTED") {
    const date = metadata.businessDate;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
      ? `Operating Date: ${date}` : "—";
  }
  if (typeof metadata.amount === "number" && Number.isFinite(metadata.amount)) {
    summary.push(formatIDR(metadata.amount));
  }
  if (typeof metadata.method === "string" && Object.hasOwn(paymentMethods, metadata.method)) {
    summary.push(`Method: ${paymentMethods[metadata.method]}`);
  }
  // Only fields emitted by production writers or the activity demo seed belong here.
  for (const [key, label] of [["article", "Article"], ["note", "Notes"]] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      const text = value.trim();
      summary.push(`${label}: ${text.length > 300 ? `${text.slice(0, 300)}…` : text}`);
    }
  }
  return summary.join(" · ") || "—";
}
