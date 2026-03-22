import { SqliteClient } from "../types";

export interface ImportBatchRow {
  id: number;
  source_file_name: string;
  source_file_path: string;
  source_file_sha256: string;
  status: string;
  notes: string | null;
  imported_at: string | null;
  created_at?: string;
  updated_at?: string;
  total_candidates?: number;
  pending_candidates?: number;
}

export interface ImportBatchesRepository {
  create(input: {
    sourceFileName: string;
    sourceFilePath: string;
    sourceFileSha256: string;
    status?: string;
    notes?: string;
  }): Promise<number>;
  markImported(batchId: number): Promise<void>;
  getBySha256(sourceFileSha256: string): Promise<ImportBatchRow | undefined>;
  listRecent(limit?: number): Promise<ImportBatchRow[]>;
}

export function createImportBatchesRepository(
  client: SqliteClient,
): ImportBatchesRepository {
  return {
    async create(input) {
      const result = await client.run(
        `INSERT INTO import_batches (
          source_file_name,
          source_file_path,
          source_file_sha256,
          status,
          notes
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          input.sourceFileName,
          input.sourceFilePath,
          input.sourceFileSha256,
          input.status ?? "pending",
          input.notes ?? null,
        ],
      );
      return result.lastInsertRowId;
    },
    async markImported(batchId: number) {
      await client.run(
        `UPDATE import_batches
        SET status = 'imported', imported_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`,
        [batchId],
      );
    },
    async getBySha256(sourceFileSha256: string) {
      const rows = await client.query<ImportBatchRow>(
        `SELECT
          id,
          source_file_name,
          source_file_path,
          source_file_sha256,
          status,
          notes,
          imported_at
        FROM import_batches
        WHERE source_file_sha256 = ?
        LIMIT 1`,
        [sourceFileSha256],
      );
      return rows[0];
    },
    async listRecent(limit = 12) {
      return client.query<ImportBatchRow>(
        `SELECT
          b.id,
          b.source_file_name,
          b.source_file_path,
          b.source_file_sha256,
          b.status,
          b.notes,
          b.imported_at,
          b.created_at,
          b.updated_at,
          (
            SELECT COUNT(*)
            FROM import_candidates c
            WHERE c.import_batch_id = b.id
          ) AS total_candidates,
          (
            SELECT COUNT(*)
            FROM import_candidates c
            WHERE c.import_batch_id = b.id AND c.resolved_at IS NULL
          ) AS pending_candidates
        FROM import_batches b
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT ?`,
        [limit],
      );
    },
  };
}
