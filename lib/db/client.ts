import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { SqliteClient, SqliteClientOptions, SqliteParameters, SqliteResult } from "./types";

function ensureParentDirectory(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
}

function normalizeRunResult(result: Database.RunResult): SqliteResult {
  return {
    changes: result.changes,
    lastInsertRowId: Number(result.lastInsertRowid),
  };
}

export function createSqliteClient(options: SqliteClientOptions): SqliteClient {
  const { databasePath } = options;
  ensureParentDirectory(databasePath);

  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  const client: SqliteClient = {
    databasePath,
    async exec(sql: string) {
      database.exec(sql);
    },
    async query<T = Record<string, unknown>>(
      sql: string,
      params: SqliteParameters = [],
    ): Promise<T[]> {
      const statement = database.prepare(sql);
      return statement.all(...params) as T[];
    },
    async run(sql: string, params: SqliteParameters = []): Promise<SqliteResult> {
      const statement = database.prepare(sql);
      const result = statement.run(...params);
      return normalizeRunResult(result);
    },
    async close() {
      database.close();
    },
  };

  return client;
}
