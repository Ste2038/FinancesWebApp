export interface SqliteResult {
  changes: number;
  lastInsertRowId: number;
}

export type SqliteParameters = readonly unknown[];

export interface SqliteClient {
  readonly databasePath: string;
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: SqliteParameters): Promise<T[]>;
  run(sql: string, params?: SqliteParameters): Promise<SqliteResult>;
  close(): Promise<void>;
}

export interface SqliteClientOptions {
  databasePath: string;
}
