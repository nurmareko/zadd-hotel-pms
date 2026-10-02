import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
  TRANSACTION_OPTIONS: {},
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createOrder, createRoomServiceOrder } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "FB" } });
  mocks.transaction.mockResolvedValue({ ok: true, orderId: 42 });
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
});

describe.each([
  { name: "createOrder", create: createOrder, input: { tableId: 1, guestCount: 2 } },
  {
    name: "createRoomServiceOrder",
    create: createRoomServiceOrder,
    input: { roomNumber: "101", guestCount: 2 },
  },
])("$name destination", ({ create, input }) => {
  it("keeps the canonical detail redirect when destination is omitted", async () => {
    await expect(create(input)).rejects.toThrow("NEXT_REDIRECT:/app/fb/orders/42");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/app/fb/orders/42");
  });

  it("redirects successful creation to the fixed POS path", async () => {
    await expect(create(input, "pos")).rejects.toThrow("NEXT_REDIRECT:/app/fb/pos?orderId=42");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/app/fb/pos?orderId=42");
  });

  it.each([undefined, "pos"] as const)("revalidates shared paths for destination %s", async (destination) => {
    await expect(create(input, destination)).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/app/fb"],
      ["/app/fb/pos"],
      ["/app/fb/orders/42"],
    ]);
  });

  it("does not accept an arbitrary redirect URL at runtime", async () => {
    // Server-action arguments are untrusted even when the caller is typed.
    // @ts-expect-error Only the literal "pos" is accepted by the public signature.
    await expect(create(input, "https://example.com")).rejects.toThrow("NEXT_REDIRECT:/app/fb/orders/42");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/app/fb/orders/42");
  });

  it.each([undefined, "pos"] as const)("does not redirect a transaction failure for destination %s", async (destination) => {
    const failure = { ok: false, error: "Pesanan tidak dapat dibuat." };
    mocks.transaction.mockResolvedValue(failure);
    await expect(create(input, destination)).resolves.toEqual(failure);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not redirect when the transaction throws", async () => {
    mocks.transaction.mockRejectedValue(new Error("transaction failed"));
    await expect(create(input, "pos")).resolves.toMatchObject({ ok: false });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not redirect or start a transaction for invalid input", async () => {
    await expect(create({}, "pos")).resolves.toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not redirect or start a transaction without authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(create(input, "pos")).resolves.toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
