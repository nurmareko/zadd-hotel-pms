import { ActivityAction } from "@prisma/client";

import { formatIDR } from "@/lib/format";

export type Metrics = {
  reservationsCreated: number;
  checkInsCompleted: number;
  checkOutsCompleted: number;
  paymentsRecordedCount: number;
  paymentsRecordedTotal: number;
  folioChargesPosted: number;
  totalActions: number;
};

export type ActivityWithContext = {
  id: number;
  userId: number;
  action: ActivityAction;
  createdAt: Date;
  metadata: unknown;
  reservationId: number | null;
  folioId: number | null;
  roomId: number | null;
  reservation: {
    reservationNo: string;
    guest: { fullName: string };
  } | null;
  folio: { folioNo: string } | null;
  room: { number: string } | null;
};

export const emptyMetrics: Metrics = {
  reservationsCreated: 0,
  checkInsCompleted: 0,
  checkOutsCompleted: 0,
  paymentsRecordedCount: 0,
  paymentsRecordedTotal: 0,
  folioChargesPosted: 0,
  totalActions: 0,
};

export function metadataAmount(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0;
  }

  const amount = (metadata as { amount?: unknown }).amount;

  if (typeof amount === "number" && Number.isFinite(amount)) {
    return amount;
  }

  if (typeof amount === "string") {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function metadataText(
  metadata: unknown,
  key: "method" | "article" | "note",
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

export function addActivityToMetrics(
  metrics: Metrics,
  activity: Pick<ActivityWithContext, "action" | "metadata">,
) {
  metrics.totalActions += 1;

  if (activity.action === ActivityAction.RESERVATION_CREATED) {
    metrics.reservationsCreated += 1;
  }

  if (activity.action === ActivityAction.CHECK_IN_COMPLETED) {
    metrics.checkInsCompleted += 1;
  }

  if (activity.action === ActivityAction.CHECK_OUT_COMPLETED) {
    metrics.checkOutsCompleted += 1;
  }

  if (activity.action === ActivityAction.PAYMENT_RECORDED) {
    metrics.paymentsRecordedCount += 1;
    metrics.paymentsRecordedTotal += metadataAmount(activity.metadata);
  }

  if (activity.action === ActivityAction.FOLIO_CHARGE_POSTED) {
    metrics.folioChargesPosted += 1;
  }
}

export function buildMetrics(
  activities: Array<Pick<ActivityWithContext, "action" | "metadata">>,
) {
  const metrics = { ...emptyMetrics };

  for (const activity of activities) {
    addActivityToMetrics(metrics, activity);
  }

  return metrics;
}

export function actionLabel(action: ActivityAction) {
  switch (action) {
    case ActivityAction.RESERVATION_CREATED:
      return "Reservasi dibuat";
    case ActivityAction.RESERVATION_UPDATED:
      return "Reservasi diperbarui";
    case ActivityAction.RESERVATION_CANCELLED:
      return "Reservasi dibatalkan";
    case ActivityAction.CHECK_IN_COMPLETED:
      return "Check-in selesai";
    case ActivityAction.CHECK_OUT_COMPLETED:
      return "Check-out selesai";
    case ActivityAction.PAYMENT_RECORDED:
      return "Pembayaran dicatat";
    case ActivityAction.FOLIO_CHARGE_POSTED:
      return "Charge folio diposting";
  }
}

export function actionBadgeClass(action: ActivityAction) {
  switch (action) {
    case ActivityAction.RESERVATION_CREATED:
      return "border-sky-200 bg-sky-50 text-sky-700";
    case ActivityAction.CHECK_IN_COMPLETED:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case ActivityAction.CHECK_OUT_COMPLETED:
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case ActivityAction.PAYMENT_RECORDED:
      return "border-amber-200 bg-amber-50 text-amber-700";
    case ActivityAction.FOLIO_CHARGE_POSTED:
      return "border-violet-200 bg-violet-50 text-violet-700";
    case ActivityAction.RESERVATION_UPDATED:
    case ActivityAction.RESERVATION_CANCELLED:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function activityContext(activity: ActivityWithContext) {
  const reservation = activity.reservation
    ? `Reservasi ${activity.reservation.reservationNo} (${activity.reservation.guest.fullName})`
    : activity.reservationId
      ? `Reservasi #${activity.reservationId}`
      : null;
  const folio = activity.folio
    ? `Folio ${activity.folio.folioNo}`
    : activity.folioId
      ? `Folio #${activity.folioId}`
      : null;
  const room = activity.room
    ? `Kamar ${activity.room.number}`
    : activity.roomId
      ? `Kamar #${activity.roomId}`
      : null;

  return [reservation, folio, room].filter(Boolean).join(" · ");
}

export function activityDetail(activity: ActivityWithContext) {
  if (activity.action === ActivityAction.PAYMENT_RECORDED) {
    const method = metadataText(activity.metadata, "method");
    const amount = metadataAmount(activity.metadata);

    return [amount > 0 ? formatIDR(amount) : null, method]
      .filter(Boolean)
      .join(" · ");
  }

  if (activity.action === ActivityAction.FOLIO_CHARGE_POSTED) {
    const article = metadataText(activity.metadata, "article");
    const amount = metadataAmount(activity.metadata);

    return [article, amount > 0 ? formatIDR(amount) : null]
      .filter(Boolean)
      .join(" · ");
  }

  return metadataText(activity.metadata, "note") ?? "";
}
