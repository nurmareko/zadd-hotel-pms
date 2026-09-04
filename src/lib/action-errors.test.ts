import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import {
  checkActionAuthorization,
  logActionFailure,
  runPostCommitSideEffects,
  safelyRunAction,
  UNIVERSAL_ACTION_FAILURE_CODES,
  UNIVERSAL_ACTION_MESSAGES,
} from "./action-errors";

describe("shared action-errors foundation", () => {
  it("defines standard universal codes and established Indonesian copy", () => {
    expect(UNIVERSAL_ACTION_FAILURE_CODES).toContain("SESSION_EXPIRED");
    expect(UNIVERSAL_ACTION_FAILURE_CODES).toContain("FORBIDDEN");
    expect(UNIVERSAL_ACTION_FAILURE_CODES).toContain("INVALID_INPUT");
    expect(UNIVERSAL_ACTION_FAILURE_CODES).toContain("UNEXPECTED");

    expect(UNIVERSAL_ACTION_MESSAGES.SESSION_EXPIRED).toBe(
      "Sesi Anda telah berakhir. Silakan masuk kembali.",
    );
    expect(UNIVERSAL_ACTION_MESSAGES.FORBIDDEN).toBe(
      "Anda tidak memiliki izin untuk melakukan tindakan ini.",
    );
  });

  describe("checkActionAuthorization", () => {
    it("returns SESSION_EXPIRED when session or user is missing", () => {
      expect(checkActionAuthorization(null, ["FO"])).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: "Sesi Anda telah berakhir. Silakan masuk kembali.",
      });

      expect(checkActionAuthorization(undefined, ["FO"])).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: "Sesi Anda telah berakhir. Silakan masuk kembali.",
      });

      expect(checkActionAuthorization({}, ["FO"])).toEqual({
        ok: false,
        code: "SESSION_EXPIRED",
        error: "Sesi Anda telah berakhir. Silakan masuk kembali.",
      });
    });

    it("returns FORBIDDEN when user role is not in allowed roles", () => {
      expect(
        checkActionAuthorization({ user: { role: "HK" } }, ["FO", "ADMIN"]),
      ).toEqual({
        ok: false,
        code: "FORBIDDEN",
        error: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
      });
    });

    it("returns null when user role is authorized", () => {
      expect(
        checkActionAuthorization({ user: { role: "FO" } }, ["FO", "ADMIN"]),
      ).toBeNull();
    });
  });

  describe("safelyRunAction", () => {
    it("returns successful result when action resolves", async () => {
      const result = await safelyRunAction(
        async () => ({ ok: true as const, value: 42 }),
        { ok: false as const, code: "UNEXPECTED", error: "Failed" },
      );

      expect(result).toEqual({ ok: true, value: 42 });
    });

    it("returns action failure when action resolves with failure", async () => {
      const result = await safelyRunAction(
        async () => ({ ok: false as const, code: "INVALID_INPUT", error: "Bad input" }),
        { ok: false as const, code: "UNEXPECTED", error: "Failed" },
      );

      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        error: "Bad input",
      });
    });

    it("contains unexpected exceptions and returns fallback failure", async () => {
      const fallback = {
        ok: false as const,
        code: "UNEXPECTED" as const,
        error: "Terjadi kesalahan",
      };

      const result = await safelyRunAction(async () => {
        throw new Error("Sensitive database credentials leaked");
      }, fallback);

      expect(result).toEqual(fallback);
      expect((result as typeof fallback).error).not.toContain("database credentials");
    });

    it("supports a lazy fallback function", async () => {
      const fallbackFn = vi.fn(() => ({
        ok: false as const,
        code: "UNEXPECTED" as const,
        error: "Lazy error",
      }));

      const result = await safelyRunAction(async () => {
        throw new Error("boom");
      }, fallbackFn);

      expect(result).toEqual({
        ok: false,
        code: "UNEXPECTED",
        error: "Lazy error",
      });
      expect(fallbackFn).toHaveBeenCalledTimes(1);
    });

    it("rethrows a genuine Next.js redirect control-flow error", async () => {
      let redirectError: unknown;

      try {
        redirect("/app/fo/reservasi");
      } catch (error) {
        redirectError = error;
      }

      await expect(
        safelyRunAction(async () => {
          throw redirectError;
        }, { ok: false, code: "UNEXPECTED", error: "Fallback" }),
      ).rejects.toBe(redirectError);
    });

    it("rethrows a Next.js router error wrapped through Error.cause", async () => {
      let redirectError: unknown;

      try {
        redirect("/app/fo/reservasi");
      } catch (error) {
        redirectError = error;
      }

      const wrappedError = new Error("Transport wrapper", {
        cause: redirectError,
      });

      await expect(
        safelyRunAction(async () => {
          throw wrappedError;
        }, { ok: false, code: "UNEXPECTED", error: "Fallback" }),
      ).rejects.toBe(redirectError);
    });

    it("does not mistake a malformed redirect-like digest for router control flow", async () => {
      const malformedError = Object.assign(new Error("not a redirect"), {
        digest: "NEXT_REDIRECT-malformed",
      });

      const fallback = {
        ok: false as const,
        code: "UNEXPECTED" as const,
        error: "Fallback",
      };

      await expect(
        safelyRunAction(async () => {
          throw malformedError;
        }, fallback),
      ).resolves.toEqual(fallback);
    });
  });

  describe("runPostCommitSideEffects", () => {
    it("runs all side effects sequentially when all succeed", async () => {
      const order: number[] = [];

      await runPostCommitSideEffects([
        {
          name: "first",
          run: async () => {
            order.push(1);
          },
        },
        {
          name: "second",
          run: () => {
            order.push(2);
          },
        },
      ]);

      expect(order).toEqual([1, 2]);
    });

    it("continues running later side effects when an earlier side effect throws", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const executed: string[] = [];

      await runPostCommitSideEffects(
        [
          {
            name: "revalidate:first",
            run: () => {
              throw new Error("Network timeout during revalidation");
            },
          },
          {
            name: "revalidate:second",
            run: () => {
              executed.push("second");
            },
          },
        ],
        { action: "postCharge", folioId: 10 },
      );

      expect(executed).toEqual(["second"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[PostCommitSideEffect] Failed: revalidate:first",
        expect.objectContaining({
          action: "postCharge",
          folioId: 10,
          sideEffect: "revalidate:first",
          errorMessage: "Network timeout during revalidation",
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("logActionFailure", () => {
    it("logs safe diagnostic context and prisma code", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const prismaError = Object.assign(new Error("Serialization failure"), {
        code: "P2034",
      });

      logActionFailure("folioAction", prismaError, {
        action: "postCharge",
        folioId: 99,
        attempt: 3,
        committed: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[folioAction] Action failure:",
        expect.objectContaining({
          action: "postCharge",
          folioId: 99,
          attempt: 3,
          committed: false,
          prismaCode: "P2034",
          errorMessage: "Serialization failure",
        }),
      );

      consoleSpy.mockRestore();
    });
  });
});
