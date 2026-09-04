import { unstable_rethrow } from "next/navigation";

export const UNIVERSAL_ACTION_FAILURE_CODES = [
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "UNEXPECTED",
] as const;

export type UniversalActionFailureCode =
  (typeof UNIVERSAL_ACTION_FAILURE_CODES)[number];

export type ActionFailure<
  TCode extends string = string,
  TField extends string = string,
> = {
  ok: false;
  code: TCode;
  error: string;
  field?: TField;
};

export type ActionSuccess = {
  ok: true;
};

export type ActionResult<
  TCode extends string = string,
  TField extends string = string,
> = ActionSuccess | ActionFailure<TCode, TField>;

export const UNIVERSAL_ACTION_MESSAGES: Record<
  "SESSION_EXPIRED" | "FORBIDDEN",
  string
> = {
  SESSION_EXPIRED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
};

export function checkActionAuthorization(
  session: { user?: { role?: string } } | null | undefined,
  allowedRoles: readonly string[],
): ActionFailure<"SESSION_EXPIRED" | "FORBIDDEN"> | null {
  if (!session?.user) {
    return {
      ok: false,
      code: "SESSION_EXPIRED",
      error: UNIVERSAL_ACTION_MESSAGES.SESSION_EXPIRED,
    };
  }

  return session.user.role && allowedRoles.includes(session.user.role)
    ? null
    : {
        ok: false,
        code: "FORBIDDEN",
        error: UNIVERSAL_ACTION_MESSAGES.FORBIDDEN,
      };
}

export function rethrowFrameworkErrors(error: unknown): void {
  unstable_rethrow(error);
}

export async function safelyRunAction<TSuccess, TFailure extends { ok: false }>(
  action: () => Promise<TSuccess | TFailure>,
  fallbackFailure: TFailure | (() => TFailure),
): Promise<TSuccess | TFailure> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    return typeof fallbackFailure === "function"
      ? fallbackFailure()
      : fallbackFailure;
  }
}

export type SafeLogContext = {
  action?: string;
  stage?: string;
  attempt?: number;
  committed?: boolean;
  [key: string]: unknown;
};

export function logActionFailure(
  scope: string,
  error: unknown,
  context?: SafeLogContext,
): void {
  const prismaCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : undefined;

  console.error(`[${scope}] Action failure:`, {
    ...context,
    prismaCode: typeof prismaCode === "string" ? prismaCode : undefined,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}

export type PostCommitSideEffect = {
  name: string;
  run: () => unknown | Promise<unknown>;
};

export async function runPostCommitSideEffects(
  effects: readonly PostCommitSideEffect[],
  context?: SafeLogContext,
): Promise<void> {
  for (const effect of effects) {
    try {
      await effect.run();
    } catch (error) {
      console.error(`[PostCommitSideEffect] Failed: ${effect.name}`, {
        ...context,
        sideEffect: effect.name,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
