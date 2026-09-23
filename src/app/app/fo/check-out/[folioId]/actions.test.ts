import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordFinalPayment: vi.fn(),
  completeCheckout: vi.fn(),
}));

vi.mock("@/lib/check-out/actions", () => mocks);

import { checkoutFailure } from "@/lib/check-out/errors";
import { completeCheckout, recordFinalPayment } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
});

describe.each([
  ["recordFinalPayment", recordFinalPayment, mocks.recordFinalPayment],
  ["completeCheckout", completeCheckout, mocks.completeCheckout],
] as const)("checkout route %s", (_name, action, domainAction) => {
  it("forwards the original form and successful result unchanged", async () => {
    const formData = new FormData();
    formData.set("folioId", "8");
    const result = { ok: true as const };
    domainAction.mockResolvedValueOnce(result);

    expect(await action(formData)).toBe(result);
    expect(domainAction).toHaveBeenCalledExactlyOnceWith(formData);
    expect(domainAction.mock.calls[0][0]).toBe(formData);
  });

  it("preserves structured failures and field errors", async () => {
    const formData = new FormData();
    const result = checkoutFailure("INVALID_INPUT", {
      fieldErrors: { folioId: ["Folio wajib dipilih."] },
    });
    domainAction.mockResolvedValueOnce(result);

    expect(await action(formData)).toBe(result);
    expect(domainAction).toHaveBeenCalledExactlyOnceWith(formData);
  });

  it("propagates domain rejections without translating the outcome", async () => {
    const formData = new FormData();
    const error = new Error("NEXT_REDIRECT");
    domainAction.mockRejectedValueOnce(error);

    await expect(action(formData)).rejects.toBe(error);
    expect(domainAction).toHaveBeenCalledExactlyOnceWith(formData);
  });
});
