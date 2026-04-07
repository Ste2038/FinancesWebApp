import { SqliteClient } from "../types";
import { TransactionInput } from "../../domain/models";

export interface TransactionRow {
  id: number;
  source_uid: string;
  source_hash: string;
  source_account_uid: string | null;
  source_target_account_uid: string | null;
  source_category_uid: string | null;
  transaction_type: number | null;
  transaction_date: string | null;
  booked_at: string | null;
  paid_at: string | null;
  amount: number | null;
  amount_account: number | null;
  memo: string | null;
  content: string | null;
  payee: string | null;
  sms_origin: string | null;
  source_deleted: number;
  is_paid: number;
  origin: string;
  source_raw_json: string | null;
}

export interface TransactionsRepository {
  list(): Promise<TransactionRow[]>;
  findBySourceUid(sourceUid: string): Promise<TransactionRow | undefined>;
  upsert(input: TransactionInput): Promise<void>;
  softDelete(sourceUid: string): Promise<void>;
}

export function createTransactionsRepository(
  client: SqliteClient,
): TransactionsRepository {
  return {
    async list() {
      return client.query<TransactionRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          source_account_uid,
          source_target_account_uid,
          source_category_uid,
          transaction_type,
          transaction_date,
          booked_at,
          paid_at,
          amount,
          amount_account,
          memo,
          content,
          payee,
          sms_origin,
          source_deleted,
          is_paid,
          origin,
          source_raw_json
        FROM transactions
        ORDER BY COALESCE(transaction_date, booked_at) DESC, id DESC`,
      );
    },
    async findBySourceUid(sourceUid: string) {
      const rows = await client.query<TransactionRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          source_account_uid,
          source_target_account_uid,
          source_category_uid,
          transaction_type,
          transaction_date,
          booked_at,
          paid_at,
          amount,
          amount_account,
          memo,
          content,
          payee,
          sms_origin,
          source_deleted,
          is_paid,
          origin,
          source_raw_json
        FROM transactions
        WHERE source_uid = ?
        LIMIT 1`,
        [sourceUid],
      );
      return rows[0];
    },
    async upsert(input: TransactionInput) {
      await client.run(
        `INSERT INTO transactions (
          source_uid,
          account_id,
          source_account_uid,
          target_account_id,
          source_target_account_uid,
          category_id,
          source_category_uid,
          transaction_type,
          transaction_date,
          booked_at,
          paid_at,
          amount,
          amount_account,
          memo,
          content,
          payee,
          sms_origin,
          source_raw_json,
          source_hash,
          source_deleted,
          is_paid,
          deleted_at,
          origin,
          updated_at
        ) VALUES (
          ?,
          (SELECT id FROM accounts WHERE source_uid = ? LIMIT 1),
          ?,
          (SELECT id FROM accounts WHERE source_uid = ? LIMIT 1),
          ?,
          (SELECT id FROM categories WHERE source_uid = ? LIMIT 1),
          ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
          ?,
          datetime('now')
        )
        ON CONFLICT(source_uid) DO UPDATE SET
          account_id = excluded.account_id,
          source_account_uid = excluded.source_account_uid,
          target_account_id = excluded.target_account_id,
          source_target_account_uid = excluded.source_target_account_uid,
          category_id = excluded.category_id,
          source_category_uid = excluded.source_category_uid,
          transaction_type = excluded.transaction_type,
          transaction_date = excluded.transaction_date,
          booked_at = excluded.booked_at,
          paid_at = excluded.paid_at,
          amount = excluded.amount,
          amount_account = excluded.amount_account,
          memo = excluded.memo,
          content = excluded.content,
          payee = excluded.payee,
          sms_origin = excluded.sms_origin,
          source_raw_json = excluded.source_raw_json,
          source_hash = excluded.source_hash,
          source_deleted = excluded.source_deleted,
          is_paid = excluded.is_paid,
          deleted_at = excluded.deleted_at,
          origin = excluded.origin,
          updated_at = datetime('now')`,
        [
          input.sourceUid,
          input.accountSourceUid,
          input.accountSourceUid,
          input.targetAccountSourceUid,
          input.targetAccountSourceUid,
          input.categorySourceUid,
          input.categorySourceUid,
          input.transactionType,
          input.transactionDate,
          input.bookedAt,
          input.paidAt,
          input.amount,
          input.amountAccount,
          input.memo,
          input.content,
          input.payee,
          input.smsOrigin,
          input.sourceRaw ? JSON.stringify(input.sourceRaw) : null,
          input.sourceHash,
          input.sourceDeleted ? 1 : 0,
          input.isPaid ? 1 : 0,
          input.sourceDeleted ? 1 : 0,
          input.origin,
        ],
      );
    },
    async softDelete(sourceUid: string) {
      await client.run(
        `UPDATE transactions
        SET source_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE source_uid = ?`,
        [sourceUid],
      );
    },
  };
}
