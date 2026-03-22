import { SqliteClient } from "../types";
import { ImportCandidate } from "../../domain/models";

export interface ImportCandidateRow {
  id: number;
  import_batch_id: number;
  entity_type: string;
  entity_key: string;
  action: string;
  local_payload_json: string | null;
  incoming_payload_json: string | null;
  diff_payload_json: string | null;
  resolved_at: string | null;
}

export interface ImportCandidatesRepository {
  listByBatch(importBatchId: number): Promise<ImportCandidateRow[]>;
  upsertMany(importBatchId: number, candidates: ImportCandidate[]): Promise<void>;
  resolveCandidate(candidateId: number, action: string): Promise<void>;
}

export function createImportCandidatesRepository(
  client: SqliteClient,
): ImportCandidatesRepository {
  return {
    async listByBatch(importBatchId: number) {
      return client.query<ImportCandidateRow>(
        `SELECT
          id,
          import_batch_id,
          entity_type,
          entity_key,
          action,
          local_payload_json,
          incoming_payload_json,
          diff_payload_json,
          resolved_at
        FROM import_candidates
        WHERE import_batch_id = ?
        ORDER BY id`,
        [importBatchId],
      );
    },
    async upsertMany(importBatchId: number, candidates: ImportCandidate[]) {
      await client.run("DELETE FROM import_candidates WHERE import_batch_id = ?", [importBatchId]);

      for (const candidate of candidates) {
        await client.run(
          `INSERT INTO import_candidates (
            import_batch_id,
            entity_type,
            entity_key,
            action,
            local_payload_json,
            incoming_payload_json,
            diff_payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            importBatchId,
            candidate.entityType,
            candidate.entityKey,
            candidate.action,
            candidate.local ? JSON.stringify(candidate.local) : null,
            candidate.incoming ? JSON.stringify(candidate.incoming) : null,
            candidate.diff ? JSON.stringify(candidate.diff) : null,
          ],
        );
      }
    },
    async resolveCandidate(candidateId: number, action: string) {
      await client.run(
        `UPDATE import_candidates
        SET action = ?, resolved_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`,
        [action, candidateId],
      );
    },
  };
}
