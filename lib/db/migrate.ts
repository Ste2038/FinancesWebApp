import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectPath } from "../config/paths";
import { SqliteClient } from "./types";

function parseMigrationVersion(filename: string): number {
  const prefix = filename.split("_")[0];
  const version = Number.parseInt(prefix, 10);

  if (!Number.isFinite(version)) {
    throw new Error(`Invalid migration filename: ${filename}`);
  }

  return version;
}

export async function runMigrations(client: SqliteClient): Promise<void> {
  const migrationsDir = resolveProjectPath("lib", "db", "migrations");
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  let hasMigrationTable = false;

  for (const filename of filenames) {
    const version = parseMigrationVersion(filename);

    if (!hasMigrationTable) {
      const tables = await client.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1",
      );
      hasMigrationTable = tables.length > 0;
    }

    const alreadyApplied = hasMigrationTable
      ? await client.query<{ version: number }>(
          "SELECT version FROM schema_migrations WHERE version = ? LIMIT 1",
          [version],
        )
      : [];

    if (alreadyApplied.length > 0) {
      continue;
    }

    const migrationPath = join(migrationsDir, filename);
    const sql = readFileSync(migrationPath, "utf8");

    await client.exec(sql);
    hasMigrationTable = true;
    await client.run(
      "INSERT OR IGNORE INTO schema_migrations (version, filename) VALUES (?, ?)",
      [version, filename],
    );
  }
}
