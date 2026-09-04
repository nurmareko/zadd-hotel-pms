import { vi } from "vitest";

import { configureTestDatabaseEnvironment } from "./test-database-env";

configureTestDatabaseEnvironment();

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => {
    const id = process.env.TEST_AUTH_USER_ID;
    const role = process.env.TEST_AUTH_ROLE ?? "FO";

    return id ? { user: { id, role } } : null;
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    redirect: vi.fn(),
  };
});
