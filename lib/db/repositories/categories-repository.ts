import { SqliteClient } from "../types";
import { CategoryInput } from "../../domain/models";

export interface CategoryRow {
  id: number;
  source_uid: string;
  source_hash: string;
  display_name: string;
  source_parent_uid: string | null;
  category_type: number | null;
  status: number | null;
  source_deleted: number;
  deleted_at: string | null;
}

export interface CategoriesRepository {
  list(): Promise<CategoryRow[]>;
  findBySourceUid(sourceUid: string): Promise<CategoryRow | undefined>;
  upsert(input: CategoryInput): Promise<void>;
  softDelete(sourceUid: string): Promise<void>;
}

export function createCategoriesRepository(client: SqliteClient): CategoriesRepository {
  return {
    async list() {
      return client.query<CategoryRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          name AS display_name,
          source_parent_uid,
          category_type,
          status,
          source_deleted,
          deleted_at
        FROM categories
        ORDER BY COALESCE(order_seq, 999999), name`,
      );
    },
    async findBySourceUid(sourceUid: string) {
      const rows = await client.query<CategoryRow>(
        `SELECT
          id,
          source_uid,
          source_hash,
          name AS display_name,
          source_parent_uid,
          category_type,
          status,
          source_deleted,
          deleted_at
        FROM categories
        WHERE source_uid = ?
        LIMIT 1`,
        [sourceUid],
      );
      return rows[0];
    },
    async upsert(input: CategoryInput) {
      await client.run(
        `INSERT INTO categories (
          source_uid,
          source_hash,
          parent_category_id,
          source_parent_uid,
          name,
          category_type,
          status,
          order_seq,
          source_deleted,
          deleted_at,
          updated_at
        ) VALUES (
          ?, ?,
          (SELECT id FROM categories WHERE source_uid = ? LIMIT 1),
          ?, ?, ?, ?, ?, ?,
          CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
          datetime('now')
        )
        ON CONFLICT(source_uid) DO UPDATE SET
          source_hash = excluded.source_hash,
          parent_category_id = excluded.parent_category_id,
          source_parent_uid = excluded.source_parent_uid,
          name = excluded.name,
          category_type = excluded.category_type,
          status = excluded.status,
          order_seq = excluded.order_seq,
          source_deleted = excluded.source_deleted,
          deleted_at = excluded.deleted_at,
          updated_at = datetime('now')`,
        [
          input.sourceUid,
          input.sourceHash,
          input.parentSourceUid,
          input.parentSourceUid,
          input.displayName,
          input.categoryType,
          input.status,
          input.orderSeq,
          input.sourceDeleted ? 1 : 0,
          input.sourceDeleted ? 1 : 0,
        ],
      );
    },
    async softDelete(sourceUid: string) {
      await client.run(
        `UPDATE categories
        SET source_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE source_uid = ?`,
        [sourceUid],
      );
    },
  };
}
