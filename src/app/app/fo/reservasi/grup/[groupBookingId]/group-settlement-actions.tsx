"use client";

import {
  DepositStatus,
  GuestIdType,
  PaymentMethod,
  ReservationStatus,
} from "@prisma/client";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  LogIn,
  LogOut,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import { formatGuestIdentity } from "@/lib/guest-id-type";

import { completeCheckIn } from "@/lib/check-in/actions";
import { GROUP_MUTATION_UNCERTAIN_MESSAGE } from "@/lib/check-in/errors";
import { SignaturePadField } from "@/components/check-in/signature-pad-field";
import {
  createMutationGuard,
  type MutationGuard,
} from "../../../check-out/[folioId]/errors";
import {
  checkoutEligibleGroupRooms,
  collectGroupDeposits,
  settleGroupBalances,
  type GroupActionDetail,
  type GroupActionResult,
  type GroupRoomActionResult,
} from "./actions";

const paymentMethods = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.CARD,
] as const;

type BatchSummaryVariant = "deposit-check-in" | "settlement-checkout";

export type BatchResult = {
  title: string;
  results: GroupRoomActionResult[];
  variant: BatchSummaryVariant;
};

export type GroupFinancialResultClassification =
  | "known-no-write"
  | "committed"
  | "uncertain";

export type GroupBatchMutationOutcome = {
  batchResult: BatchResult | null;
  uncertaintyMessage: string | null;
  errorMessage: string | null;
  successMessage: string | null;
  classification: GroupFinancialResultClassification;
};

export function classifyGroupFinancialResults(
  results: GroupRoomActionResult[],
): GroupFinancialResultClassification {
  let hasCommittedWork = false;

  for (const result of results) {
    if (
      result.status === "uncertain" ||
      result.details?.some((detail) => detail.status === "uncertain") === true
    ) {
      return "uncertain";
    }

    if (
      result.status === "completed" ||
      result.details?.some((detail) => detail.status === "completed") === true
    ) {
      hasCommittedWork = true;
    }
  }

  return hasCommittedWork ? "committed" : "known-no-write";
}

export function resolvedGroupBatchOutcome(
  title: string,
  results: GroupRoomActionResult[],
  successLabel: string,
  variant: BatchSummaryVariant,
): GroupBatchMutationOutcome {
  const completedCount = results.filter(
    (item) => item.status === "completed",
  ).length;
  const classification = classifyGroupFinancialResults(results);
  const visibleResults =
    variant === "settlement-checkout"
      ? results
      : results.filter((item) => item.status !== "completed");

  return {
    batchResult:
      visibleResults.length > 0
        ? { title, results: visibleResults, variant }
        : null,
    uncertaintyMessage:
      classification === "uncertain" ? GROUP_MUTATION_UNCERTAIN_MESSAGE : null,
    errorMessage: null,
    successMessage:
      completedCount > 0
        ? `${completedCount} kamar berhasil ${successLabel}.`
        : null,
    classification,
  };
}

export async function runGroupBatchMutation(
  action: () => Promise<GroupActionResult>,
  options: {
    title: string;
    successLabel: string;
    variant: BatchSummaryVariant;
  },
): Promise<GroupBatchMutationOutcome> {
  try {
    const result = await action();
    if (!result.ok) {
      return {
        batchResult: null,
        uncertaintyMessage: null,
        errorMessage: result.error,
        successMessage: null,
        classification: "known-no-write",
      };
    }

    return resolvedGroupBatchOutcome(
      options.title,
      result.results,
      options.successLabel,
      options.variant,
    );
  } catch {
    return {
      batchResult: null,
      uncertaintyMessage: GROUP_MUTATION_UNCERTAIN_MESSAGE,
      errorMessage: null,
      successMessage: null,
      classification: "uncertain",
    };
  }
}

type GroupFinancialMutationEffects = {
  clearBatchResult: () => void;
  applyOutcome: (outcome: GroupBatchMutationOutcome) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  refresh: () => void;
};

function runGroupFinancialEffect(sideEffect: string, effect: () => void) {
  try {
    effect();
  } catch {
    try {
      console.error("[GroupFinancialClient] Follow-up failed", { sideEffect });
    } catch {
      // Logging must not prevent the remaining post-commit effects.
    }
  }
}

export type GroupMutationOperation =
  | "deposit"
  | "check-in"
  | "settlement"
  | "checkout";

const GROUP_MUTATION_VARIANTS: Record<
  GroupMutationOperation,
  BatchSummaryVariant
> = {
  deposit: "deposit-check-in",
  "check-in": "deposit-check-in",
  settlement: "settlement-checkout",
  checkout: "settlement-checkout",
};

// Deposit, check-in, settlement, and check-out all mutate the same group
// folios, so they share one mounted-component guard. A lease is the proof of
// ownership handed to whichever operation won the `idle -> in-flight`
// transition. Only that lease may settle the guard, so a stale callback can
// neither release a terminal state nor latch on top of a newer operation.
export type GroupMutationLease = {
  readonly operation: GroupMutationOperation;
  readonly guard: MutationGuard;
};

const groupGuardOwners = new WeakMap<MutationGuard, GroupMutationLease>();

export function acquireGroupMutationLease(
  guard: MutationGuard,
  operation: GroupMutationOperation,
): GroupMutationLease | null {
  if (!guard.tryAcquireAction()) return null;

  const lease: GroupMutationLease = { operation, guard };
  groupGuardOwners.set(guard, lease);
  return lease;
}

export function groupMutationLeaseOwnsGuard(lease: GroupMutationLease) {
  return (
    groupGuardOwners.get(lease.guard) === lease &&
    lease.guard.state === "in-flight"
  );
}

function settleGroupMutationLease(
  lease: GroupMutationLease,
  settle: (guard: MutationGuard) => void,
) {
  if (!groupMutationLeaseOwnsGuard(lease)) return false;

  settle(lease.guard);
  groupGuardOwners.delete(lease.guard);
  return true;
}

export function latchGroupMutationUncertain(lease: GroupMutationLease) {
  return settleGroupMutationLease(lease, (guard) =>
    guard.latchUncertainAction(),
  );
}

export function latchGroupMutationCommitted(lease: GroupMutationLease) {
  return settleGroupMutationLease(lease, (guard) =>
    guard.latchCommittedAction(),
  );
}

export function releaseGroupMutationLease(lease: GroupMutationLease) {
  return settleGroupMutationLease(lease, (guard) => guard.releaseKnownAction());
}

// Every real handler calls this synchronously, before it clears a summary,
// starts a transition, calls a server action, toasts, or refreshes.
export function beginGroupMutation(
  guard: MutationGuard,
  operation: GroupMutationOperation,
  begin: (lease: GroupMutationLease) => void,
): "started" | "blocked" {
  const lease = acquireGroupMutationLease(guard, operation);
  if (!lease) return "blocked";

  // A synchronous failure here happens before the server action can start, so
  // no write can be in flight. Release the lease instead of leaving the panel
  // silently locked, and never surface the raw exception.
  let started = false;
  runGroupFinancialEffect("begin", () => {
    begin(lease);
    started = true;
  });
  if (!started) {
    releaseGroupMutationLease(lease);
    return "blocked";
  }

  return "started";
}

export type GroupTerminalClassification = Exclude<
  GroupFinancialResultClassification,
  "known-no-write"
>;

export const GROUP_COMMITTED_RELOAD_MESSAGE =
  "Tindakan berhasil diproses. Muat ulang halaman untuk melanjutkan dengan data terbaru.";

export const GROUP_RELOAD_BUTTON_LABEL = "Muat ulang halaman";

// The component stays mounted across router.refresh(), so a terminal guard
// survives it. Committed work therefore needs its own visible reload path;
// only a real reload builds a new guard.
export function groupMutationRecoveryState(
  terminal: GroupTerminalClassification | null,
) {
  return {
    showCommittedNotice: terminal === "committed",
    showUncertaintyNotice: terminal === "uncertain",
    isMutationLocked: terminal !== null,
  };
}

export function reloadGroupPage(reload = () => window.location.reload()) {
  reload();
}

export async function runGroupLeasedMutation(
  lease: GroupMutationLease,
  action: () => Promise<GroupActionResult>,
  options: {
    title: string;
    successLabel: string;
  },
  effects: GroupFinancialMutationEffects,
): Promise<"applied" | "discarded"> {
  runGroupFinancialEffect("clear-summary", effects.clearBatchResult);

  const outcome = await runGroupBatchMutation(action, {
    title: options.title,
    successLabel: options.successLabel,
    variant: GROUP_MUTATION_VARIANTS[lease.operation],
  });

  // Ownership, not the raw `in-flight` state, decides whether this result may
  // settle the guard. The owning operation always applies its own outcome.
  if (!groupMutationLeaseOwnsGuard(lease)) return "discarded";

  if (outcome.classification === "uncertain") {
    latchGroupMutationUncertain(lease);
  } else if (outcome.classification === "committed") {
    latchGroupMutationCommitted(lease);
  }

  const terminalOutcome = outcome.classification !== "known-no-write";
  if (terminalOutcome) {
    runGroupFinancialEffect("outcome-rendering", () => {
      effects.applyOutcome(outcome);
    });

    if (outcome.classification === "uncertain") {
      // Batch 2B kept refreshing deposit and check-in after an uncertain
      // result. The guard and the warning are already latched, so this is a
      // best-effort data refresh that cannot unlock or reclassify anything.
      if (lease.operation === "deposit" || lease.operation === "check-in") {
        runGroupFinancialEffect("refresh", effects.refresh);
      }
      return "applied";
    }

    if (outcome.errorMessage) {
      runGroupFinancialEffect("error-notification", () => {
        effects.notifyError(outcome.errorMessage!);
      });
    }
    if (outcome.successMessage) {
      runGroupFinancialEffect("success-notification", () => {
        effects.notifySuccess(outcome.successMessage!);
      });
    }
    runGroupFinancialEffect("refresh", effects.refresh);
    return "applied";
  }

  try {
    runGroupFinancialEffect("outcome-rendering", () => {
      effects.applyOutcome(outcome);
    });
    if (outcome.errorMessage) {
      runGroupFinancialEffect("error-notification", () => {
        effects.notifyError(outcome.errorMessage!);
      });
    }
    if (outcome.successMessage) {
      runGroupFinancialEffect("success-notification", () => {
        effects.notifySuccess(outcome.successMessage!);
      });
    }
    runGroupFinancialEffect("refresh", effects.refresh);
  } finally {
    releaseGroupMutationLease(lease);
  }

  return "applied";
}

export function batchSummaryText(result: BatchResult) {
  const skipped = result.results.filter(
    (item) => item.status === "skipped",
  ).length;
  const failed = result.results.filter(
    (item) => item.status === "failed",
  ).length;

  if (result.variant === "deposit-check-in") {
    return `${skipped} dilewati · ${failed} gagal`;
  }

  const completed = result.results.filter(
    (item) => item.status === "completed",
  ).length;
  const uncertain = result.results.filter(
    (item) => item.status === "uncertain",
  ).length;
  return `${completed} selesai · ${skipped} dilewati · ${failed} gagal · ${uncertain} belum dapat dipastikan`;
}

export type GroupCheckInRoom = {
  reservationId: number;
  reservationNo: string;
  roomId: number | null;
  roomNumber: string | null;
  status: ReservationStatus;
  depositStatus: DepositStatus;
  arrivalDate: string;
  requiredDeposit: string | null;
  guest: {
    fullName: string;
    idType: GuestIdType | null;
    idNumber: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
  };
};

function checkInSkipReason(room: GroupCheckInRoom, todayIso: string) {
  if (room.status === ReservationStatus.CHECKED_IN) return "Sudah check-in.";
  if (room.status === ReservationStatus.CHECKED_OUT) return "Sudah check-out.";
  if (room.status === ReservationStatus.CANCELLED) return "Reservasi dibatalkan.";
  if (room.status === ReservationStatus.NO_SHOW) return "Reservasi no-show.";
  if (room.status !== ReservationStatus.CONFIRMED) {
    return "Reservasi tidak dalam status yang bisa check-in.";
  }
  if (room.depositStatus === DepositStatus.PENDING) {
    return "Deposit belum dibayar.";
  }
  if (!room.roomId) return "Kamar belum ditugaskan.";
  if (room.arrivalDate > todayIso) {
    return `Belum waktunya check-in (arrival ${room.arrivalDate}).`;
  }

  return null;
}

function depositSkipReason(room: GroupCheckInRoom, todayIso: string) {
  if (room.status === ReservationStatus.CHECKED_IN) return "Sudah check-in.";
  if (room.status === ReservationStatus.CHECKED_OUT) return "Sudah check-out.";
  if (room.status === ReservationStatus.CANCELLED) return "Reservasi dibatalkan.";
  if (room.status === ReservationStatus.NO_SHOW) return "Reservasi no-show.";
  if (room.status !== ReservationStatus.CONFIRMED) {
    return "Reservasi tidak dapat mengumpulkan deposit.";
  }
  if (room.depositStatus === DepositStatus.COLLECTED) {
    return "Deposit sudah dikumpulkan.";
  }
  if (room.arrivalDate > todayIso) {
    return `Belum waktunya mengumpulkan deposit (arrival ${room.arrivalDate}).`;
  }
  if (
    room.requiredDeposit === null ||
    !Number.isFinite(Number(room.requiredDeposit)) ||
    Number(room.requiredDeposit) <= 0
  ) {
    return "Tarif malam pertama tidak tersedia atau tidak valid.";
  }

  return null;
}

function asResult(
  room: GroupCheckInRoom,
  status: GroupRoomActionResult["status"],
  reason: string,
): GroupRoomActionResult {
  return {
    reservationId: room.reservationId,
    reservationNo: room.reservationNo,
    roomNumber: room.roomNumber,
    status,
    reason,
  };
}

function resultClassName(status: GroupRoomActionResult["status"]) {
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  if (status === "uncertain") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusLabel(status: GroupRoomActionResult["status"]) {
  if (status === "failed") return "Gagal";
  if (status === "uncertain") return "Belum dapat dipastikan";
  if (status === "completed") return "Selesai";
  return "Dilewati";
}

export function groupResultDetailText(detail: GroupActionDetail) {
  return `${detail.label}: ${statusLabel(detail.status)} — ${detail.reason}`;
}

function BatchResultSummary({ result }: { result: BatchResult }) {
  const failed = result.results.filter(
    (item) => item.status === "failed",
  ).length;
  const uncertain = result.results.filter(
    (item) => item.status === "uncertain",
  ).length;

  return (
    <div
      className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      role={failed > 0 || uncertain > 0 ? "alert" : "status"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{result.title}</h3>
        <p className="text-xs font-medium text-slate-500">
          {batchSummaryText(result)}
        </p>
      </div>
      <ul className="mt-3 space-y-2" aria-live="polite">
        {result.results.map((item) => (
          <li
            key={item.reservationId}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${resultClassName(item.status)}`}
          >
            {item.status === "failed" ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : item.status === "uncertain" ? (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            ) : item.status === "completed" ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            ) : null}
            <div>
              <p>
                <span className="font-semibold">
                  {item.roomNumber ? `Kamar ${item.roomNumber}` : item.reservationNo}
                </span>{" "}
                <span className="text-xs">({item.reservationNo})</span>: {statusLabel(item.status)} — {item.reason}
              </p>
              {item.details ? (
                <ul className="mt-2 space-y-1 border-t border-current/15 pt-2 text-xs">
                  {item.details.map((detail) => (
                    <li key={detail.label}>{groupResultDetailText(detail)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GroupSettlementActions({
  groupBookingId,
  checkInRooms,
  todayIso,
  pendingDepositTotal,
}: {
  groupBookingId: string;
  checkInRooms: GroupCheckInRoom[];
  todayIso: string;
  pendingDepositTotal: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState("");
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [depositReference, setDepositReference] = useState("");
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [uncertaintyMessage, setUncertaintyMessage] = useState<string | null>(
    null,
  );
  const [financialMutationTerminal, setFinancialMutationTerminal] =
    useState<GroupTerminalClassification | null>(null);
  const [isCheckInPanelOpen, setIsCheckInPanelOpen] = useState(false);
  const [groupPurposeOfVisit, setGroupPurposeOfVisit] = useState("Bisnis");
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const [signatures, setSignatures] = useState<Record<number, string>>({});
  const [isCollectingDeposits, startDepositTransition] = useTransition();
  const [isSettling, startSettleTransition] = useTransition();
  const [isCheckingOut, startCheckoutTransition] = useTransition();
  const [isCheckingIn, startCheckInTransition] = useTransition();
  const financialMutationGuard = useRef(createMutationGuard());

  const depositEligibleRooms = checkInRooms.filter(
    (room) => !depositSkipReason(room, todayIso),
  );
  const checkInEligibleRooms = checkInRooms.filter(
    (room) => !checkInSkipReason(room, todayIso),
  );
  const everyEligibleRoomIsSigned = checkInEligibleRooms.every(
    (room) => Boolean(signatures[room.reservationId]),
  );

  const groupMutationEffects: GroupFinancialMutationEffects = {
    clearBatchResult: () => setBatchResult(null),
    applyOutcome: (outcome: GroupBatchMutationOutcome) => {
      setFinancialMutationTerminal(
        outcome.classification === "known-no-write"
          ? null
          : outcome.classification,
      );
      setBatchResult(outcome.batchResult);
      setUncertaintyMessage(outcome.uncertaintyMessage);
    },
    notifySuccess: (message: string) => toast.success(message),
    notifyError: (message: string) => toast.error(message),
    refresh: () => router.refresh(),
  };

  const checkInMutationEffects: GroupFinancialMutationEffects = {
    ...groupMutationEffects,
    applyOutcome: (outcome: GroupBatchMutationOutcome) => {
      groupMutationEffects.applyOutcome(outcome);
      if (outcome.classification !== "uncertain") setIsCheckInPanelOpen(false);
    },
  };

  function collectDeposits() {
    beginGroupMutation(financialMutationGuard.current, "deposit", (lease) => {
      startDepositTransition(async () => {
        await runGroupLeasedMutation(
          lease,
          () =>
            collectGroupDeposits({
              groupBookingId,
              method: depositMethod,
              reference: depositReference,
            }),
          {
            title: "Hasil pengumpulan deposit grup",
            successLabel: "dikumpulkan depositnya",
          },
          groupMutationEffects,
        );
      });
    });
  }

  function settleBalances() {
    beginGroupMutation(
      financialMutationGuard.current,
      "settlement",
      (lease) => {
        startSettleTransition(async () => {
          await runGroupLeasedMutation(
            lease,
            () =>
              settleGroupBalances({
                groupBookingId,
                method,
                reference,
              }),
            {
              title: "Hasil pelunasan saldo grup",
              successLabel: "dilunasi",
            },
            groupMutationEffects,
          );
        });
      },
    );
  }

  function checkoutEligibleRooms() {
    beginGroupMutation(financialMutationGuard.current, "checkout", (lease) => {
      startCheckoutTransition(async () => {
        await runGroupLeasedMutation(
          lease,
          () => checkoutEligibleGroupRooms(groupBookingId),
          {
            title: "Hasil check-out kamar siap",
            successLabel: "di-check-out",
          },
          groupMutationEffects,
        );
      });
    });
  }

  // Each eligible room delegates to the same completeCheckIn action as the
  // individual flow. Deposit collection remains an explicit separate step;
  // Phase 1 skips PENDING siblings instead of silently failing them. A thrown
  // call aborts the remaining siblings and surfaces as whole-call uncertainty.
  async function runGroupCheckInBatch(): Promise<GroupActionResult> {
    const results: GroupRoomActionResult[] = [];

    for (const room of checkInRooms) {
      const skipReason = checkInSkipReason(room, todayIso);

      if (skipReason) {
        results.push(asResult(room, "skipped", skipReason));
        continue;
      }

      const signatureDataUrl = signatures[room.reservationId];
      if (!signatureDataUrl) {
        results.push(
          asResult(room, "skipped", "Tanda tangan GRC tamu wajib diisi."),
        );
        continue;
      }

      const formData = new FormData();
      formData.set("reservationId", String(room.reservationId));
      formData.set("roomId", String(room.roomId));
      formData.set("guestFullName", room.guest.fullName);
      formData.set("guestIdType", room.guest.idType ?? "");
      formData.set("guestIdNumber", room.guest.idNumber ?? "");
      formData.set("guestPhone", room.guest.phone ?? "");
      formData.set("guestEmail", room.guest.email ?? "");
      formData.set("guestNationality", room.guest.nationality ?? "");
      formData.set("purposeOfVisit", groupPurposeOfVisit);
      formData.set("purposeOfVisitOther", "");
      formData.set("signatureDataUrl", signatureDataUrl);
      formData.set("arrivalConfirmation", String(arrivalConfirmed));
      formData.set("depositMethod", "");
      formData.set("depositReference", "");

      const result = await completeCheckIn(formData, {
        redirectAfterCheckIn: false,
      });
      results.push(
        result.ok
          ? asResult(room, "completed", "Check-in selesai.")
          : asResult(room, "failed", result.error),
      );
    }

    return { ok: true, results };
  }

  function checkInEligibleRoomsInBatch() {
    beginGroupMutation(financialMutationGuard.current, "check-in", (lease) => {
      startCheckInTransition(async () => {
        await runGroupLeasedMutation(
          lease,
          runGroupCheckInBatch,
          {
            title: "Hasil check-in kamar siap",
            successLabel: "di-check-in",
          },
          checkInMutationEffects,
        );
      });
    });
  }

  const isPending =
    isCollectingDeposits || isSettling || isCheckingOut || isCheckingIn;
  const financialMutationRecovery = groupMutationRecoveryState(
    financialMutationTerminal,
  );
  const isFinancialMutationLocked = financialMutationRecovery.isMutationLocked;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-sky-200 bg-white shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50 px-5 py-4">
        <h2 className="text-base font-semibold text-sky-950">Aksi grup</h2>
        <p className="mt-1 text-sm text-sky-800">
          Setiap pembayaran dan check-out tetap diproses pada folio kamar masing-masing.
        </p>
      </div>
      {uncertaintyMessage ? (
        <div
          className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <p className="font-semibold">{uncertaintyMessage}</p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-red-300 text-red-800 hover:bg-red-100"
              onClick={() => window.location.reload()}
            >
              Muat ulang halaman
            </Button>
          </div>
        </div>
      ) : null}
      {financialMutationRecovery.showCommittedNotice ? (
        <div
          className="mx-5 mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          role="status"
        >
          <p className="font-semibold">{GROUP_COMMITTED_RELOAD_MESSAGE}</p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              onClick={() => reloadGroupPage()}
            >
              {GROUP_RELOAD_BUTTON_LABEL}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-5 p-5 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">
                Kumpulkan deposit semua kamar
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Catat tarif malam pertama setiap kamar ke folionya sendiri. Deposit yang sudah terkumpul akan dilewati.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-emerald-200 bg-white px-3 py-2.5">
            <p className="text-xs font-semibold text-emerald-800">
              Total deposit kamar pending
            </p>
            <p className="mt-0.5 font-bold tabular-nums text-emerald-950">
              {formatIDR(pendingDepositTotal)} untuk {depositEligibleRooms.length} kamar
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Metode deposit batch
              </span>
              <select
                value={depositMethod}
                onChange={(event) =>
                  setDepositMethod(event.target.value as PaymentMethod)
                }
                disabled={isPending || isFinancialMutationLocked}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 desktop:h-10"
              >
                {paymentMethods.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>
                    {paymentMethod}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Referensi {depositMethod === PaymentMethod.TRANSFER ? "(wajib)" : "(opsional)"}
              </span>
              <Input
                value={depositReference}
                onChange={(event) => setDepositReference(event.target.value)}
                disabled={isPending || isFinancialMutationLocked}
                maxLength={100}
                placeholder="BCA TRF 12345"
                className="mt-1 h-11 border-slate-300 desktop:h-10"
              />
            </label>
          </div>
          <Button
            type="button"
            onClick={collectDeposits}
            disabled={isPending || isFinancialMutationLocked || depositEligibleRooms.length === 0}
            className="mt-4"
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            {isCollectingDeposits
              ? "Memproses..."
              : depositEligibleRooms.length === 0
                ? "Tidak ada deposit pending"
                : `Kumpulkan ${formatIDR(pendingDepositTotal)} untuk ${depositEligibleRooms.length} kamar`}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Settle saldo grup</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Lunasi setiap folio OPEN yang masih memiliki saldo. Kamar tanpa folio atau yang sudah lunas akan dilewati.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Metode pembayaran batch</span>
              <select
                              value={method}
                              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                              disabled={isPending || isFinancialMutationLocked}
                              className="mt-1 h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                            >
                {paymentMethods.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>{paymentMethod}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Referensi {method === PaymentMethod.TRANSFER ? "(wajib)" : "(opsional)"}
              </span>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={isPending || isFinancialMutationLocked}
                maxLength={100}
                placeholder="BCA TRF 12345"
                className="mt-1 h-11 desktop:h-10 border-slate-300"
              />
            </label>
          </div>
          <Button
            type="button"
            onClick={settleBalances}
            disabled={isPending || isFinancialMutationLocked}
            className="mt-4"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            {isSettling ? "Memproses..." : "Settle saldo grup"}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <LogOut className="mt-0.5 h-5 w-5 text-sky-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Check-out kamar yang siap</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Hanya kamar yang sudah check-in, lunas, dan departure hari ini yang diproses. Kamar lain akan dilewati dan dilaporkan.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={checkoutEligibleRooms}
            disabled={isPending || isFinancialMutationLocked}
            className="mt-4 border-sky-300 text-sky-800 hover:bg-sky-50 hover:text-sky-950"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isCheckingOut ? "Memproses..." : "Check-out kamar yang siap"}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <LogIn className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-900">Check-in kamar yang siap</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Kamar CONFIRMED yang sudah tiba, memiliki kamar, serta berstatus deposit COLLECTED dengan pembayaran DEPOSIT pada folio akan diproses satu per satu. Setiap tamu tetap wajib menandatangani GRC-nya sendiri.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCheckInPanelOpen((current) => !current)}
            disabled={isPending || isFinancialMutationLocked || checkInEligibleRooms.length === 0}
            className="mt-4"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {checkInEligibleRooms.length === 0
              ? "Tidak ada kamar siap"
              : "Check-in kamar yang siap"}
          </Button>
        </div>
      </div>
      {isCheckInPanelOpen ? (
        <div className="border-t border-slate-100 px-5 py-5">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">
              Lengkapi GRC sebelum check-in batch
            </h3>
            <p className="mt-1 text-sm leading-5 text-emerald-900">
              Tanda tangan di bawah disimpan pada reservasi kamar masing-masing. Data kontak tamu yang ada tidak diubah. Aksi check-in batch ini tidak mengumpulkan deposit; kamar dengan deposit PENDING akan dilewati dan deposit harus dikumpulkan terlebih dahulu.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Tujuan kunjungan seluruh grup</span>
                <select
                                  value={groupPurposeOfVisit}
                                  onChange={(event) => setGroupPurposeOfVisit(event.target.value)}
                                  disabled={isPending}
                                  className="mt-1 h-11 desktop:h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                >
                  <option value="Bisnis">Bisnis</option>
                  <option value="Liburan">Liburan</option>
                  <option value="Keluarga">Keluarga</option>
                  <option value="Acara">Acara</option>
                </select>
              </label>
              <label className="mt-5 flex items-start gap-2 text-sm leading-5 text-slate-700 sm:mt-6">
                <input
                  type="checkbox"
                  checked={arrivalConfirmed}
                  onChange={(event) => setArrivalConfirmed(event.target.checked)}
                  disabled={isPending}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Saya mengonfirmasi setiap tamu yang diproses sudah hadir dan menandatangani GRC-nya sendiri.
              </label>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {checkInEligibleRooms.map((room) => (
                <div key={room.reservationId} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">
                    {room.roomNumber ? `Kamar ${room.roomNumber}` : room.reservationNo}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{room.guest.fullName} · {room.reservationNo}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Identitas: {formatGuestIdentity(room.guest.idType, room.guest.idNumber)}
                  </p>
                  <div className="mt-3">
                    <span className="text-xs font-semibold text-slate-600">Tanda tangan tamu</span>
                    <div className="mt-1">
                      <SignaturePadField
                        value={signatures[room.reservationId] ?? ""}
                        onChange={(value) =>
                          setSignatures((current) => ({
                            ...current,
                            [room.reservationId]: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              onClick={checkInEligibleRoomsInBatch}
              disabled={isPending || isFinancialMutationLocked || !arrivalConfirmed || !everyEligibleRoomIsSigned}
              className="mt-5"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {isCheckingIn ? "Memproses..." : `Proses ${checkInEligibleRooms.length} kamar siap`}
            </Button>
          </div>
        </div>
      ) : null}
      {batchResult ? <div className="border-t border-slate-100 px-5 pb-5"> <BatchResultSummary result={batchResult} /> </div> : null}
    </section>
  );
}
