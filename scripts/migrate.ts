import { createSqliteClient } from "../lib/db/client";
import { readRuntimeEnv } from "../lib/config/env";
import { runMigrations } from "../lib/db/migrate";
import { resolveProjectPath } from "../lib/config/paths";

async function main(): Promise<void> {
  const env = readRuntimeEnv();
  const client = createSqliteClient({ databasePath: resolveProjectPath(env.databasePath) });

  try {
    await runMigrations(client);
  } finally {
    await client.close();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main as migrateDatabase };
