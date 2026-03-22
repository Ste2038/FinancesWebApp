import { SqliteClient } from "../types";
import { AccountInput } from "../../domain/models";

export interface AccountRow {
  id: number;
  source_uid: string;
  source_hash: string;
  display_name: string;
  nickname: string | null;
  source_group_uid: string | null;
  currency_uid: string | null;
  source_deleted: number;
  is_archived: number;
  archived_at: string | null;
  deleted_at: string | null;
}

export interface AccountsRepository {
  list(): Promise<AccountRow[]>;
  findBySourceUid(sourceUid: string): Promise<AccountRow | undefined>;
  upsert(input: AccountInput): Promise<void>;
  archiveMany(sourceUids: string[]): Promise<number>;
  unarchiveMany(sourceUids: string[]): Promise<number>;
  softDelete(sourceUid: string): Promise<void>;
}

export function createAccountsRepository(client: SqliteClient): AccountsRepository {
  return {
    async list() {
      return client.query<AccountRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          display_name,
          nickname,
          source_group_uid,
          currency_uid,
          source_deleted,
          is_archived,
          archived_at,
          deleted_at
        FROM accounts
        ORDER BY COALESCE(order_seq, 999999), display_name`,
      );
    },
    async findBySourceUid(sourceUid: string) {
      const rows = await client.query<AccountRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          display_name,
          nickname,
          source_group_uid,
          currency_uid,
          source_deleted,
          is_archived,
          archived_at,
          deleted_at
        FROM accounts
        WHERE source_uid = ?
        LIMIT 1`,
        [sourceUid],
      );
      return rows[0];
    },
    async upsert(input: AccountInput) {
      await client.run(
        `INSERT INTO accounts (
          source_uid,
          source_hash,
          account_group_id,
          source_group_uid,
          currency_uid,
          display_name,
          nickname,
          card_day_fin,
          card_day_pay,
          app_package,
          app_name,
          sms_tel,
          sms_string,
          is_transfer_expense,
          is_card_auto_pay,
          source_type,
          order_seq,
          source_deleted,
          deleted_at,
          updated_at
        ) VALUES (
          ?, ?,
          (SELECT id FROM account_groups WHERE source_uid = ? LIMIT 1),
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
          datetime('now')
        )
        ON CONFLICT(source_uid) DO UPDATE SET
          source_hash = excluded.source_hash,
          account_group_id = excluded.account_group_id,
          source_group_uid = excluded.source_group_uid,
          currency_uid = excluded.currency_uid,
          display_name = excluded.display_name,
          nickname = excluded.nickname,
          card_day_fin = excluded.card_day_fin,
          card_day_pay = excluded.card_day_pay,
          app_package = excluded.app_package,
          app_name = excluded.app_name,
          sms_tel = excluded.sms_tel,
          sms_string = excluded.sms_string,
          is_transfer_expense = excluded.is_transfer_expense,
          is_card_auto_pay = excluded.is_card_auto_pay,
          source_type = excluded.source_type,
          order_seq = excluded.order_seq,
          source_deleted = excluded.source_deleted,
          deleted_at = excluded.deleted_at,
          updated_at = datetime('now')`,
        [
          input.sourceUid,
          input.sourceHash,
          input.accountGroupSourceUid,
          input.accountGroupSourceUid,
          input.currencyUid,
          input.displayName,
          input.nickname,
          input.cardDayFin,
          input.cardDayPay,
          input.appPackage,
          input.appName,
          input.smsTel,
          input.smsString,
          input.isTransferExpense ? 1 : 0,
          input.isCardAutoPay ? 1 : 0,
          input.sourceType,
          input.orderSeq,
          input.sourceDeleted ? 1 : 0,
          input.sourceDeleted ? 1 : 0,
        ],
      );
    },
    async archiveMany(sourceUids: string[]) {
      if (sourceUids.length === 0) {
        return 0;
      }

      const placeholders = sourceUids.map(() => "?").join(", ");
      const result = await client.run(
        `UPDATE accounts
        SET is_archived = 1,
          archived_at = COALESCE(archived_at, datetime('now')),
          updated_at = datetime('now')
        WHERE source_uid IN (${placeholders})
          AND source_deleted = 0
          AND is_archived = 0`,
        sourceUids,
      );

      return result.changes;
    },
    async unarchiveMany(sourceUids: string[]) {
      if (sourceUids.length === 0) {
        return 0;
      }

      const placeholders = sourceUids.map(() => "?").join(", ");
      const result = await client.run(
        `UPDATE accounts
        SET is_archived = 0,
          archived_at = NULL,
          updated_at = datetime('now')
        WHERE source_uid IN (${placeholders})
          AND source_deleted = 0
          AND is_archived = 1`,
        sourceUids,
      );

      return result.changes;
    },
    async softDelete(sourceUid: string) {
      await client.run(
        `UPDATE accounts
        SET source_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE source_uid = ?`,
        [sourceUid],
      );
    },
  };
}
