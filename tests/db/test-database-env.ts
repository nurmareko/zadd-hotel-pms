function normalizedDatabaseUrl(value: string): string {
  const url = new URL(value);

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must be a PostgreSQL connection URL.");
  }

  url.hash = "";
  return url.toString();
}

export function assertSafeTestDatabaseEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const testDatabaseUrl = env.TEST_DATABASE_URL?.trim();
  const developmentDatabaseUrl = env.DATABASE_URL?.trim();

  if (!testDatabaseUrl) {
    throw new Error(
      "DB TEST SAFETY: TEST_DATABASE_URL is required. Refusing to use DATABASE_URL.",
    );
  }

  const normalizedTestUrl = normalizedDatabaseUrl(testDatabaseUrl);

  if (
    developmentDatabaseUrl &&
    normalizedTestUrl === normalizedDatabaseUrl(developmentDatabaseUrl) &&
    env.TEST_DATABASE_SAFETY_VERIFIED !== normalizedTestUrl
  ) {
    throw new Error(
      "DB TEST SAFETY: TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run destructive test cleanup.",
    );
  }

  return testDatabaseUrl;
}

export function configureTestDatabaseEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const testDatabaseUrl = assertSafeTestDatabaseEnvironment(env);

  env.DATABASE_URL = testDatabaseUrl;
  env.DATABASE_URL_UNPOOLED = testDatabaseUrl;
  env.TEST_DATABASE_SAFETY_VERIFIED = normalizedDatabaseUrl(testDatabaseUrl);
  env.TZ = "UTC";

  return testDatabaseUrl;
}
