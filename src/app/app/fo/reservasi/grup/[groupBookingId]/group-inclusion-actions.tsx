"use client";

import {
  ArrangementType,
  ReservationStatus,
  ReservationStayFeeKind,
} from "@prisma/client";
import { CheckCircle2, CircleAlert, Utensils, WalletCards } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import {
  applyGroupMealPlan,
  applyGroupStayFees,
  previewGroupMealPlan,
  type GroupMealPlanPreviewRoom,
} from "./inclusion-actions";
import type { GroupRoomActionResult } from "./actions";

type GroupInclusionRoom = {
  reservationId: number;
  reservationNo: string;
  roomNumber: string | null;
  status: ReservationStatus;
  adults: number;
  children: number;
  currentPlan: ArrangementType;
  mealTotal: string;
  folioStatus: string;
  earlyFeeStatus: string;
  lateFeeStatus: string;
};

type Scope = "all" | "selected";

type BatchReport = {
  title: string;
  results: GroupRoomActionResult[];
};

const mealPlanLabels: Record<ArrangementType, string> = {
  RO: "RO — Room Only",
  BB: "BB — Bed & Breakfast",
  HB: "HB — Breakfast + One Main Meal",
  FB: "FB — Breakfast, Lunch & Dinner",
};

const reservationStatusLabels: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const feeLabels: Record<ReservationStayFeeKind, string> = {
  EARLY_CHECK_IN: "Early Check-in",
  LATE_CHECK_OUT: "Late Check-out",
};

function resultStyles(status: GroupRoomActionResult["status"]) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function resultLabel(status: GroupRoomActionResult["status"]) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Skipped";
}

function BatchReportPanel({ report }: { report: BatchReport }) {
  const completed = report.results.filter(
    (result) => result.status === "completed",
  ).length;
  const skipped = report.results.filter(
    (result) => result.status === "skipped",
  ).length;
  const failed = report.results.filter(
    (result) => result.status === "failed",
  ).length;

  return (
    <div
      className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{report.title}</h3>
        <p className="text-xs font-semibold text-slate-500">
          {completed} completed · {skipped} skipped · {failed} failed
        </p>
      </div>
      <ul className="mt-3 space-y-2" aria-live="polite">
        {report.results.map((result) => (
          <li
            key={result.reservationId}
            className={`rounded-md border px-3 py-2 text-sm ${resultStyles(result.status)}`}
          >
            <p>
              <span className="font-semibold">
                {result.roomNumber
                  ? `Room ${result.roomNumber}`
                  : result.reservationNo}
              </span>{" "}
              <span className="text-xs">({result.reservationNo})</span> ·{" "}
              <span className="font-semibold">{resultLabel(result.status)}</span>
              {" — "}
              {result.reason}
            </p>
            {result.details ? (
              <ul className="mt-2 space-y-1 border-t border-current/10 pt-2 text-xs">
                {result.details.map((detail) => (
                  <li key={detail.label}>
                    <span className="font-semibold">{detail.label}</span> ·{" "}
                    {resultLabel(detail.status)} — {detail.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GroupInclusionActions({
  groupBookingId,
  rooms,
}: {
  groupBookingId: string;
  rooms: GroupInclusionRoom[];
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>(
    rooms.map((room) => room.reservationId),
  );
  const [mealPlan, setMealPlan] = useState<ArrangementType>(ArrangementType.BB);
  const [preview, setPreview] = useState<GroupMealPlanPreviewRoom[] | null>(null);
  const [feeKinds, setFeeKinds] = useState<ReservationStayFeeKind[]>([
    ReservationStayFeeKind.EARLY_CHECK_IN,
  ]);
  const [report, setReport] = useState<BatchReport | null>(null);
  const [isPreviewing, startPreviewTransition] = useTransition();
  const [isApplyingMeal, startMealTransition] = useTransition();
  const [isApplyingFees, startFeeTransition] = useTransition();
  const selectedCount = scope === "all" ? rooms.length : selectedIds.length;
  const requestScope =
    scope === "all"
      ? ({ scope: "all" as const })
      : ({ scope: "selected" as const, reservationIds: selectedIds });
  const isPending = isPreviewing || isApplyingMeal || isApplyingFees;

  function resetPreview() {
    setPreview(null);
    setReport(null);
  }

  function changeScope(nextScope: Scope) {
    setScope(nextScope);
    resetPreview();
  }

  function toggleRoom(reservationId: number, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, reservationId]))
        : current.filter((id) => id !== reservationId),
    );
    resetPreview();
  }

  function loadPreview() {
    if (selectedCount === 0) {
      toast.error("Select at least one room.");
      return;
    }

    setReport(null);
    startPreviewTransition(async () => {
      const result = await previewGroupMealPlan({
        groupBookingId,
        arrangementType: mealPlan,
        ...requestScope,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setPreview(result.rooms);
    });
  }

  function applyMealPlan() {
    if (!preview) {
      toast.error("Load the server preview before applying the meal plan.");
      return;
    }

    const eligibleCount = preview.filter((room) => room.eligible).length;
    if (
      !window.confirm(
        `Apply ${mealPlanLabels[mealPlan]} to ${eligibleCount} eligible rooms? The server will revalidate each room.`,
      )
    ) {
      return;
    }

    startMealTransition(async () => {
      const result = await applyGroupMealPlan({
        groupBookingId,
        arrangementType: mealPlan,
        expectedPreviews: preview,
        ...requestScope,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setReport({ title: "Group meal plan results", results: result.results });
      setPreview(null);
      const completed = result.results.filter(
        (room) => room.status === "completed",
      ).length;
      if (completed > 0) toast.success(`${completed} rooms updated successfully.`);
    });
  }

  function toggleFee(kind: ReservationStayFeeKind, checked: boolean) {
    setFeeKinds((current) =>
      checked
        ? Array.from(new Set([...current, kind]))
        : current.filter((item) => item !== kind),
    );
    setReport(null);
  }

  function applyFees() {
    if (selectedCount === 0 || feeKinds.length === 0) {
      toast.error("Select rooms and at least one stay flexibility fee.");
      return;
    }

    const feeNames = feeKinds.map((kind) => feeLabels[kind]).join(" and ");
    if (
      !window.confirm(
        `Apply ${feeNames} to ${selectedCount} rooms? Each fee type costs Rp100.000 per room and is revalidated by the server.`,
      )
    ) {
      return;
    }

    startFeeTransition(async () => {
      const result = await applyGroupStayFees({
        groupBookingId,
        kinds: feeKinds,
        ...requestScope,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setReport({
        title: "Group stay flexibility results",
        results: result.results,
      });
      const completed = result.results.filter(
        (room) => room.status === "completed",
      ).length;
      if (completed > 0) toast.success(`${completed} rooms processed successfully.`);
    });
  }

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
        <h2 className="text-base font-semibold text-emerald-950">Group Inclusion Actions</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Select all group members or specific rooms. Each room retains its own guest count, calculations, and folio.
        </p>
      </div>

      <div className="border-b border-slate-200 p-5">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Room selection</legend>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="group-inclusion-scope"
                checked={scope === "all"}
                onChange={() => changeScope("all")}
                disabled={isPending}
              />
              All rooms ({rooms.length})
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="group-inclusion-scope"
                checked={scope === "selected"}
                onChange={() => changeScope("selected")}
                disabled={isPending}
              />
              Selected rooms ({selectedIds.length})
            </label>
          </div>
        </fieldset>

        {scope === "selected" ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <label
                key={room.reservationId}
                className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.includes(room.reservationId)}
                  onChange={(event) =>
                    toggleRoom(room.reservationId, event.target.checked)
                  }
                  disabled={isPending}
                />
                <span>
                  <span className="font-semibold text-slate-900">
                    {room.roomNumber ? `Room ${room.roomNumber}` : "Not assigned"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {room.reservationNo} · {room.adults} adults + {room.children} children
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {mealPlanLabels[room.currentPlan]} · total {formatIDR(room.mealTotal)}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {reservationStatusLabels[room.status]} · folio {room.folioStatus}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Early check-in: {room.earlyFeeStatus} · late check-out: {room.lateFeeStatus}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <article className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <Utensils className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Apply Package to Rooms</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                The preview must use server calculations. Past or posted nights remain locked.
              </p>
            </div>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Meal plan
            <select
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={mealPlan}
              onChange={(event) => {
                setMealPlan(event.target.value as ArrangementType);
                resetPreview();
              }}
              disabled={isPending}
            >
              {Object.values(ArrangementType).map((plan) => (
                <option key={plan} value={plan}>
                  {mealPlanLabels[plan]}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={loadPreview}
              disabled={isPending || selectedCount === 0}
            >
              {isPreviewing ? "Loading preview…" : "Load Server Preview"}
            </Button>
            <Button
              type="button"
              onClick={applyMealPlan}
              disabled={
                isPending || !preview || !preview.some((room) => room.eligible)
              }
            >
              {isApplyingMeal ? "Applying…" : "Apply Package to Rooms"}
            </Button>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <WalletCards className="mt-0.5 h-5 w-5 text-sky-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Stay flexibility</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Each fee type is a flat Rp100.000 per reservation, not shared across rooms.
              </p>
            </div>
          </div>
          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium text-slate-700">Fees to apply</legend>
            {Object.values(ReservationStayFeeKind).map((kind) => (
              <label
                key={kind}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={feeKinds.includes(kind)}
                  onChange={(event) => toggleFee(kind, event.target.checked)}
                  disabled={isPending}
                />
                {feeLabels[kind]} · {formatIDR(100000)} per room
              </label>
            ))}
          </fieldset>
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-sky-300 text-sky-800 hover:bg-sky-50 hover:text-sky-950"
            onClick={applyFees}
            disabled={isPending || selectedCount === 0 || feeKinds.length === 0}
          >
            {isApplyingFees ? "Applying…" : "Apply Fees to Rooms"}
          </Button>
        </article>
      </div>

      {preview ? (
        <div
          className="border-t border-slate-200 px-5 py-5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Room-by-Room Preview</h3>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-225 text-left text-sm">
              <caption className="sr-only">
                Room-by-room meal plan preview based on server calculations
              </caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-3">Room</th>
                  <th className="px-3 py-3">Current status / plan</th>
                  <th className="px-3 py-3">Pax</th>
                  <th className="px-3 py-3 text-right">Affected nights</th>
                  <th className="px-3 py-3 text-right">Unit price</th>
                  <th className="px-3 py-3 text-right">Per night</th>
                  <th className="px-3 py-3 text-right">Estimated amount</th>
                  <th className="px-3 py-3">Effective</th>
                  <th className="px-3 py-3">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((room) => (
                  <tr key={room.reservationId}>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {room.roomNumber ? `Room ${room.roomNumber}` : room.reservationNo}
                      <span className="block text-xs font-normal text-slate-500">
                        {room.reservationNo}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <span className="block font-medium">
                        {room.reservationStatus
                          ? reservationStatusLabels[room.reservationStatus]
                          : "Not found"}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {room.currentPlan
                          ? mealPlanLabels[room.currentPlan]
                          : "Plan unavailable"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {room.pax === null
                        ? "—"
                        : `${room.pax} (${room.adults} adults + ${room.children} children)`}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {room.nightsAffected}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatIDR(room.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {formatIDR(room.nightlyAmount)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatIDR(room.expectedAmount)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {room.effectiveDate ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {room.eligible ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Eligible
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-700">
                          {room.reason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {report ? (
        <div className="border-t border-slate-200 px-5 pb-5">
          <BatchReportPanel report={report} />
        </div>
      ) : null}
    </section>
  );
}
