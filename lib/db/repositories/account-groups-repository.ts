import { SqliteClient } from "../types";
import { AccountGroupInput } from "../../domain/models";

export interface AccountGroupRow {
  id: number;
  source_uid: string;
  source_hash: string;
  display_name: string;
  source_type: number | null;
  source_deleted: number;
  deleted_at: string | null;
}

export interface AccountGroupsRepository {
  list(): Promise<AccountGroupRow[]>;
  findBySourceUid(sourceUid: string): Promise<AccountGroupRow | undefined>;
  upsert(input: AccountGroupInput): Promise<void>;
  softDelete(sourceUid: string): Promise<void>;
}

export function createAccountGroupsRepository(
  client: SqliteClient,
): AccountGroupsRepository {
  return {
    async list() {
      return client.query<AccountGroupRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          name AS display_name,
          source_type,
          source_deleted,
          deleted_at
        FROM account_groups
        ORDER BY COALESCE(order_seq, 999999), name`,
      );
    },
    async findBySourceUid(sourceUid: string) {
      const rows = await client.query<AccountGroupRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          name AS display_name,
          source_type,
          source_deleted,
          deleted_at
        FROM account_groups
        WHERE source_uid = ?
        LIMIT 1`,
        [sourceUid],
      );
      return rows[0];
    },
    async upsert(input: AccountGroupInput) {
      await client.run(
        `INSERT INTO account_groups (
          source_uid,
          source_hash,
          source_type,
          name,
          order_seq,
          source_deleted,
          deleted_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, datetime('now'))
        ON CONFLICT(source_uid) DO UPDATE SET
          source_hash = excluded.source_hash,
          source_type = excluded.source_type,
          name = excluded.name,
          order_seq = excluded.order_seq,
          source_deleted = excluded.source_deleted,
          deleted_at = excluded.deleted_at,
          updated_at = datetime('now')`,
        [
          input.sourceUid,
          input.sourceHash,
          input.sourceType,
          input.displayName,
          input.orderSeq,
          input.sourceDeleted ? 1 : 0,
          input.sourceDeleted ? 1 : 0,
        ],
      );
    },
    async softDelete(sourceUid: string) {
      await client.run(
        `UPDATE account_groups
        SET source_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE source_uid = ?`,
        [sourceUid],
      );
    },
  };
}
