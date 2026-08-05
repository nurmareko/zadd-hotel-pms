import { spawnSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";

import { configureTestDatabaseEnvironment } from "../tests/db/test-database-env";

loadEnvConfig(process.cwd());
configureTestDatabaseEnvironment();

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["vitest", "run", "--config", "vitest.db.config.mts"]);
