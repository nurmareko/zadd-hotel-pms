import { afterEach, describe, expect, it, vi } from "vitest";

import {
  StayChargePostingError,
  type StayChargePostingBlocker,
} from "@/lib/stay-charges";
import {
  CHECKOUT_FAILURE_CODES,
  CHECKOUT_FAILURE_MESSAGES,
  CHECKOUT_UNKNOWN_RESULT_MESSAGE,
  checkoutAuthorizationFailure,
  checkoutErrorPresentation,
  checkoutFailure,
  checkoutStayChargeFailure,
  checkoutValidationFailure,
  INITIAL_CHECKOUT_UI_STATE,
  createMutationGuard,
  reduceCheckoutActionRejection,
  reduceCheckoutActionResult,
  reloadCheckoutPage,
  runCheckoutMutation,
  type CheckoutFailureCode,
} from "./errors";

const STATIC_MESSAGES: Record<
  Exclude<CheckoutFailureCode, "BALANCE_DUE">,
  string
> = {
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INVALID_INPUT: "Invalid check-out data. Please review the form.",
  FOLIO_NOT_FOUND:
    "Folio not found. Return to the reservation and reload the data.",
  SETTINGS_UNAVAILABLE:
    "Hotel settings are unavailable. Contact an administrator before continuing.",
  FOLIO_NOT_OPEN:
    "Payment cannot be recorded because the folio is no longer open.",
  FOLIO_VOIDED:
    "The folio has been voided and cannot be used for check-out.",
  RESERVATION_NOT_CHECKED_IN:
    "The reservation is no longer checked in. Reload the page and check its current status.",
  BALANCE_ALREADY_SETTLED:
    "The outstanding balance is already settled. Reload the page to continue check-out.",
  PAYMENT_EXCEEDS_BALANCE:
    "The payment exceeds the current outstanding balance. Reload and check the payment amount.",
  FOLIO_CHANGED:
    "The folio status has changed. Reload the page before continuing.",
  PAYMENT_CONFLICT:
    "Final payment encountered a data conflict. Reload the page before trying again.",
  CHECKOUT_CONFLICT:
    "Check-out encountered a data conflict. Reload the page and check the current status.",
  FINAL_PAYMENT_UNEXPECTED:
    "Final payment could not be recorded. Please try again.",
  CHECKOUT_UNEXPECTED:
    "Check-out could not be completed. Please try again.",
  STAY_SCHEDULE_INCOMPLETE:
    "The stay rate schedule is incomplete. Enter a rate for every night before continuing check-out.",
  STAY_SCHEDULE_OUT_OF_ORDER:
    "The stay rate dates are out of order. Correct the rate schedule before continuing check-out.",
  STAY_NIGHT_OWNERSHIP_INVALID:
    "A nightly rate belongs to a different reservation. Stop check-out and request a data review.",
  ROOM_RATE_INVALID:
    "A nightly room rate is invalid. Correct the rate before continuing check-out.",
  INVALID_STAY_CHARGE_AMOUNT:
    "A nightly Arrangement allocation exceeds the package rate, making the room amount negative. Correct the package rate or Arrangement allocation before continuing check-out.",
  MEAL_VALUES_INCOMPLETE:
    "Meal inclusion data for a night is incomplete. Complete or remove the inclusion before check-out.",
  MEAL_VALUES_INVALID:
    "Meal inclusion data for a night is invalid. Correct the guest count and inclusion amounts before check-out.",
  STAY_NIGHT_COUNT_INVALID:
    "The stay dates do not produce a valid night count. Check the reservation dates.",
  STAY_SCHEDULE_SHORTFALL:
    "Rates are missing for some nights already stayed. Complete the rate schedule before check-out.",
  MEAL_PLAN_UNSUPPORTED:
    "A nightly inclusion package cannot be posted. Select an available package or remove the inclusion.",
  STAY_ARTICLE_MISSING:
    "A stay-charge article is unavailable. Contact an administrator before continuing check-out.",
  STAY_POSTING_STATE_CHANGED:
    "The folio or reservation status changed while posting stay charges. Reload the page before continuing.",
  STAY_POSTING_CONFLICT:
    "Stay-charge posting encountered a data conflict. Reload the page before trying again.",
  STAY_POSTING_UNEXPECTED:
    "Stay charges could not be posted. Please try again.",
  RESULT_UNKNOWN:
    "The action result is uncertain. Reload the page before making another payment or attempting check-out again.",
};

const DATE = new Date("2026-08-05T00:00:00.000Z");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function checkoutMutationHarness() {
  let state = INITIAL_CHECKOUT_UI_STATE;
  const notifySuccess = vi.fn();
  const refresh = vi.fn();
  return {
    guard: createMutationGuard(),
    get state() {
      return state;
    },
    effects: {
      applyState(nextState: typeof state) {
        state = nextState;
      },
      notifySuccess,
      refresh,
    },
    notifySuccess,
    refresh,
  };
}

const BLOCKERS: Array<{
  blocker: StayChargePostingBlocker;
  code: CheckoutFailureCode;
}> = [
  {
    blocker: {
      kind: "INCOMPLETE_STAY_SCHEDULE",
      expectedCount: 2,
      actualCount: 1,
      affectedDate: DATE,
    },
    code: "STAY_SCHEDULE_INCOMPLETE",
  },
  {
    blocker: {
      kind: "OUT_OF_ORDER_STAY_SCHEDULE",
      position: 1,
      expectedDate: DATE,
      actualDate: DATE,
    },
    code: "STAY_SCHEDULE_OUT_OF_ORDER",
  },
  {
    blocker: {
      kind: "NIGHT_OWNERSHIP_MISMATCH",
      nightId: "night-secret",
      affectedDate: DATE,
      expectedReservationId: 123,
      actualReservationId: 456,
    },
    code: "STAY_NIGHT_OWNERSHIP_INVALID",
  },
  {
    blocker: {
      kind: "INVALID_ROOM_RATE",
      nightId: "night-secret",
      affectedDate: DATE,
      rateAmount: "123456.789",
    },
    code: "ROOM_RATE_INVALID",
  },
  {
    blocker: {
      kind: "INVALID_STAY_CHARGE_AMOUNT",
      nightId: "night-secret",
      affectedDate: DATE,
      rateAmount: "50000",
      mealAmount: "100000",
    },
    code: "INVALID_STAY_CHARGE_AMOUNT",
  },
  {
    blocker: {
      kind: "INCOMPLETE_MEAL_VALUES",
      nightId: "night-secret",
      affectedDate: DATE,
    },
    code: "MEAL_VALUES_INCOMPLETE",
  },
  {
    blocker: {
      kind: "INVALID_MEAL_VALUES",
      nightId: "night-secret",
      affectedDate: DATE,
      mealPlan: "SECRET_PLAN",
      mealPax: -3,
      mealUnitPrice: "99999.99",
      mealAmount: "-1",
    },
    code: "MEAL_VALUES_INVALID",
  },
  {
    blocker: {
      kind: "INVALID_EXPECTED_NIGHT_COUNT",
      expectedCount: -1,
      affectedDate: DATE,
    },
    code: "STAY_NIGHT_COUNT_INVALID",
  },
  {
    blocker: {
      kind: "STAY_SCHEDULE_SHORTFALL",
      expectedCount: 2,
      actualCount: 1,
      affectedDate: DATE,
    },
    code: "STAY_SCHEDULE_SHORTFALL",
  },
  {
    blocker: {
      kind: "UNSUPPORTED_MEAL_PLAN",
      mealPlan: "SECRET_PLAN",
      affectedDate: DATE,
    },
    code: "MEAL_PLAN_UNSUPPORTED",
  },
  {
    blocker: {
      kind: "MISSING_STAY_CHARGE_ARTICLE",
      articleCode: "SECRET-ARTICLE",
      affectedDate: DATE,
    },
    code: "STAY_ARTICLE_MISSING",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkout failure contract", () => {
  it("defines every stable code and exact English static message", () => {
    expect(new Set(CHECKOUT_FAILURE_CODES)).toEqual(
      new Set([...Object.keys(STATIC_MESSAGES), "BALANCE_DUE"]),
    );
    expect(CHECKOUT_FAILURE_CODES).toHaveLength(
      Object.keys(STATIC_MESSAGES).length + 1,
    );
    expect(CHECKOUT_FAILURE_MESSAGES).toEqual(STATIC_MESSAGES);
    expect(CHECKOUT_UNKNOWN_RESULT_MESSAGE).toBe(STATIC_MESSAGES.RESULT_UNKNOWN);
  });

  it("formats BALANCE_DUE with only the operator-facing amount", () => {
    expect(checkoutFailure("BALANCE_DUE", { amount: "Rp 125.000" })).toEqual({
      ok: false,
      code: "BALANCE_DUE",
      error:
        "The outstanding balance is not yet settled (Rp 125.000). Record the final payment first.",
    });
  });

  it("distinguishes an expired session from insufficient permission", () => {
    expect(checkoutAuthorizationFailure(null)).toEqual(
      checkoutFailure("SESSION_EXPIRED"),
    );
    expect(
      checkoutAuthorizationFailure({ user: { role: "HK" } }),
    ).toEqual(checkoutFailure("FORBIDDEN"));
    expect(
      checkoutAuthorizationFailure({ user: { role: "FO" } }),
    ).toBeNull();
  });

  it("targets known invalid fields without returning generated validation text", () => {
    expect(
      checkoutValidationFailure({
        issues: [
          { path: ["amount"] },
          { path: ["method"] },
          { path: ["reference"] },
          { path: ["unknown"] },
        ],
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      error: STATIC_MESSAGES.INVALID_INPUT,
      fieldErrors: {
        amount: ["Invalid payment amount."],
        method: ["Invalid payment method."],
        reference: ["Invalid payment reference."],
      },
    });
  });
});

describe("checkout client failure state", () => {
  it("keeps returned field failures targeted without duplicating the form error", () => {
    const state = reduceCheckoutActionResult(INITIAL_CHECKOUT_UI_STATE, {
      ok: false,
      code: "INVALID_INPUT",
      error: STATIC_MESSAGES.INVALID_INPUT,
      fieldErrors: { amount: ["Invalid payment amount."] },
    });

    expect(state).toEqual({
      isUncertain: false,
      isCommitted: false,
      actionError: STATIC_MESSAGES.INVALID_INPUT,
      fieldErrors: { amount: ["Invalid payment amount."] },
    });
  });

  it("locks mutations with the exact persistent uncertainty message after rejection", () => {
    const uncertain = reduceCheckoutActionRejection(INITIAL_CHECKOUT_UI_STATE);

    expect(uncertain).toEqual({
      isUncertain: true,
      isCommitted: false,
      actionError: CHECKOUT_UNKNOWN_RESULT_MESSAGE,
      fieldErrors: {},
    });
    expect(
      reduceCheckoutActionResult(uncertain, { ok: true }),
    ).toBe(uncertain);
  });

  it("clears a controlled failure into committed UI state after confirmed success", () => {
    const failed = reduceCheckoutActionResult(
      INITIAL_CHECKOUT_UI_STATE,
      checkoutFailure("CHECKOUT_CONFLICT"),
    );

    expect(reduceCheckoutActionResult(failed, { ok: true })).toEqual({
      isUncertain: false,
      isCommitted: true,
      actionError: null,
      fieldErrors: {},
    });
  });
});

describe("checkout form orchestration", () => {
  it("keeps committed and uncertain guard states terminal", () => {
    const committed = createMutationGuard();
    expect(committed.tryAcquireAction()).toBe(true);
    committed.latchCommittedAction();
    committed.releaseKnownAction();
    committed.latchUncertainAction();

    const uncertain = createMutationGuard();
    expect(uncertain.tryAcquireAction()).toBe(true);
    uncertain.latchUncertainAction();
    uncertain.releaseKnownAction();
    uncertain.latchCommittedAction();

    expect(committed.state).toBe("committed");
    expect(committed.tryAcquireAction()).toBe(false);
    expect(uncertain.state).toBe("uncertain");
    expect(uncertain.tryAcquireAction()).toBe(false);
  });

  it("returns one targeted field failure surface without a success notification", async () => {
    const harness = checkoutMutationHarness();
    const outcome = await runCheckoutMutation(
      harness.guard,
      harness.state,
      async () => ({
        ...checkoutFailure("INVALID_INPUT"),
        fieldErrors: { amount: ["Invalid payment amount."] },
      }),
      harness.effects,
    );
    const presentation = checkoutErrorPresentation(harness.state, true);

    expect(outcome).toBe("applied");
    expect(harness.state.fieldErrors.amount).toEqual([
      "Invalid payment amount.",
    ]);
    expect(harness.notifySuccess).not.toHaveBeenCalled();
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(presentation).toEqual({
      showActionError: false,
      showReload: false,
    });
  });

  it("returns one persistent form failure surface without a success notification", async () => {
    const harness = checkoutMutationHarness();
    const outcome = await runCheckoutMutation(
      harness.guard,
      harness.state,
      async () => checkoutFailure("CHECKOUT_CONFLICT"),
      harness.effects,
    );
    const presentation = checkoutErrorPresentation(harness.state, false);

    expect(outcome).toBe("applied");
    expect(harness.state.actionError).toBe(
      CHECKOUT_FAILURE_MESSAGES.CHECKOUT_CONFLICT,
    );
    expect(presentation).toEqual({
      showActionError: true,
      showReload: false,
    });
  });

  it.each(["final-payment", "checkout"])(
    "synchronously excludes a duplicate %s invocation while the first is pending",
    async () => {
      const pending = deferred<{ ok: true }>();
      const action = vi.fn(() => pending.promise);
      const harness = checkoutMutationHarness();

      const first = runCheckoutMutation(
        harness.guard,
        harness.state,
        action,
        harness.effects,
      );
      const second = runCheckoutMutation(
        harness.guard,
        harness.state,
        action,
        harness.effects,
      );

      expect(action).toHaveBeenCalledOnce();
      await expect(second).resolves.toBe("blocked");
      pending.resolve({ ok: true });
      await expect(first).resolves.toBe("applied");
      expect(harness.guard.state).toBe("committed");
      expect(harness.notifySuccess).toHaveBeenCalledOnce();
      expect(harness.refresh).toHaveBeenCalledOnce();
    },
  );

  it.each(["final-payment", "checkout"])(
    "permanently latches %s uncertainty after rejection",
    async () => {
      const pending = deferred<{ ok: true }>();
      const action = vi.fn(() => pending.promise);
      const laterAction = vi.fn<() => Promise<{ ok: true }>>().mockResolvedValue({
        ok: true,
      });
      const harness = checkoutMutationHarness();

      const first = runCheckoutMutation(
        harness.guard,
        harness.state,
        action,
        harness.effects,
      );
      pending.reject(new Error("raw transport secret"));
      await expect(first).resolves.toBe("applied");

      expect(harness.guard.state).toBe("uncertain");
      expect(harness.state).toEqual({
        isUncertain: true,
        isCommitted: false,
        actionError: CHECKOUT_UNKNOWN_RESULT_MESSAGE,
        fieldErrors: {},
      });
      await expect(
        runCheckoutMutation(
          harness.guard,
          harness.state,
          laterAction,
          harness.effects,
        ),
      ).resolves.toBe("blocked");
      expect(laterAction).not.toHaveBeenCalled();
      expect(harness.state.actionError).not.toContain("raw transport secret");
      expect(harness.notifySuccess).not.toHaveBeenCalled();
      expect(harness.refresh).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["controlled failure", checkoutFailure("CHECKOUT_CONFLICT")],
    ["success", { ok: true } as const],
  ])("discards a later %s after uncertainty is latched", async (_, laterResult) => {
    const harness = checkoutMutationHarness();
    const rejected = runCheckoutMutation(
      harness.guard,
      harness.state,
      async () => Promise.reject(new Error("network unavailable")),
      harness.effects,
    );
    await expect(rejected).resolves.toBe("applied");
    const uncertainState = harness.state;
    const laterAction = vi.fn().mockResolvedValue(laterResult);

    const later = runCheckoutMutation(
      harness.guard,
      harness.state,
      laterAction,
      harness.effects,
    );

    await expect(later).resolves.toBe("blocked");
    expect(laterAction).not.toHaveBeenCalled();
    expect(harness.state).toBe(uncertainState);
    expect(harness.notifySuccess).not.toHaveBeenCalled();
    expect(harness.refresh).not.toHaveBeenCalled();
  });

  it("keeps the uncertainty latch across local state changes and exposes real reload", async () => {
    const harness = checkoutMutationHarness();
    await runCheckoutMutation(
      harness.guard,
      harness.state,
      async () => Promise.reject(new Error("network unavailable")),
      harness.effects,
    );
    const changedLocalDialogState = { open: true, method: "TRANSFER" };
    const reload = vi.fn();

    reloadCheckoutPage(reload);

    expect(changedLocalDialogState).toEqual({ open: true, method: "TRANSFER" });
    expect(harness.guard.state).toBe("uncertain");
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(["final-payment", "checkout"])(
    "latches confirmed %s success and blocks replay before refreshed state is installed",
    async () => {
      const harness = checkoutMutationHarness();
      const action = vi.fn().mockResolvedValue({ ok: true as const });
      const replay = vi.fn().mockResolvedValue({ ok: true as const });

      await expect(
        runCheckoutMutation(
          harness.guard,
          harness.state,
          action,
          harness.effects,
        ),
      ).resolves.toBe("applied");

      expect(harness.guard.state).toBe("committed");
      expect(harness.state).toEqual({
        isUncertain: false,
        isCommitted: true,
        actionError: null,
        fieldErrors: {},
      });
      expect(harness.notifySuccess).toHaveBeenCalledOnce();
      expect(harness.refresh).toHaveBeenCalledOnce();

      await expect(
        runCheckoutMutation(
          harness.guard,
          harness.state,
          replay,
          harness.effects,
        ),
      ).resolves.toBe("blocked");
      expect(replay).not.toHaveBeenCalled();
    },
  );

  it("keeps confirmed success committed when applying success UI throws", async () => {
    const harness = checkoutMutationHarness();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    harness.effects.applyState = vi.fn(() => {
      throw new Error("render raw secret");
    });

    await expect(
      runCheckoutMutation(
        harness.guard,
        harness.state,
        async () => ({ ok: true }),
        harness.effects,
      ),
    ).resolves.toBe("applied");

    expect(harness.guard.state).toBe("committed");
    expect(harness.notifySuccess).toHaveBeenCalledOnce();
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      "[CheckoutClient] Confirmed-success follow-up failed",
      { sideEffect: "outcome-rendering" },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "render raw secret",
    );
  });

  it("keeps confirmed success committed when notification throws and still attempts refresh", async () => {
    const harness = checkoutMutationHarness();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    harness.notifySuccess.mockImplementation(() => {
      throw new Error("toast raw secret");
    });

    await expect(
      runCheckoutMutation(
        harness.guard,
        harness.state,
        async () => ({ ok: true }),
        harness.effects,
      ),
    ).resolves.toBe("applied");

    expect(harness.guard.state).toBe("committed");
    expect(harness.state.isCommitted).toBe(true);
    expect(harness.state.isUncertain).toBe(false);
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      "[CheckoutClient] Confirmed-success follow-up failed",
      { sideEffect: "notification" },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("toast raw secret");
  });

  it("keeps confirmed success committed when refresh throws without exposing uncertainty or retry", async () => {
    const harness = checkoutMutationHarness();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    harness.refresh.mockImplementation(() => {
      throw new Error("navigation raw secret");
    });

    await expect(
      runCheckoutMutation(
        harness.guard,
        harness.state,
        async () => ({ ok: true }),
        harness.effects,
      ),
    ).resolves.toBe("applied");

    expect(harness.notifySuccess).toHaveBeenCalledOnce();
    expect(harness.guard.state).toBe("committed");
    expect(harness.state).toEqual({
      isUncertain: false,
      isCommitted: true,
      actionError: null,
      fieldErrors: {},
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[CheckoutClient] Confirmed-success follow-up failed",
      { sideEffect: "refresh-or-navigation" },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "navigation raw secret",
    );
  });

  it("cannot release committed success through local UI changes", async () => {
    const harness = checkoutMutationHarness();
    await runCheckoutMutation(
      harness.guard,
      harness.state,
      async () => ({ ok: true }),
      harness.effects,
    );
    const localUi = { dialogOpen: false, method: "CASH" };

    localUi.dialogOpen = true;
    localUi.method = "TRANSFER";
    harness.guard.releaseKnownAction();

    expect(localUi).toEqual({ dialogOpen: true, method: "TRANSFER" });
    expect(harness.guard.state).toBe("committed");
    expect(harness.state.isCommitted).toBe(true);
  });
});

describe("checkout stay-charge mapping", () => {
  it.each(BLOCKERS)("maps $blocker.kind to $code without leaking diagnostics", ({ blocker, code }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = checkoutStayChargeFailure(
      new StayChargePostingError(
        "internal reservation 123 night-secret Prisma P2002 123456.789",
        blocker,
      ),
      { action: "test" },
    );

    expect(result).toEqual(checkoutFailure(code));
    expect(result.error).not.toMatch(
      /123|night-secret|P2002|123456\.789|SECRET|internal reservation/i,
    );
  });

  it("uses the safe generic fallback when a posting error has no structured blocker", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = checkoutStayChargeFailure(
      new StayChargePostingError(
        "Folio 991 berubah dari OPEN; raw database identifier secret-id",
      ),
    );

    expect(result).toEqual(checkoutFailure("STAY_POSTING_UNEXPECTED"));
    expect(result.error).not.toMatch(/991|OPEN|secret-id/);
  });
});
