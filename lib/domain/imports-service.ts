import { ImportApplySelection, ImportBatchSummary, ImportCandidate } from "./models";
import { ImportBatchesRepository } from "../db/repositories/import-batches-repository";
import { ImportCandidatesRepository } from "../db/repositories/import-candidates-repository";
import { notImplemented } from "../db/repositories/base";

export interface ImportsService {
  createBatch(input: {
    sourceFileName: string;
    sourceFilePath: string;
    sourceFileSha256: string;
  }): Promise<number>;
  storeCandidates(importBatchId: number, candidates: ImportCandidate[]): Promise<void>;
  resolveCandidates(
    importBatchId: number,
    selections: ImportApplySelection[],
  ): Promise<ImportBatchSummary>;
}

export function createImportsService(
  batchesRepository: ImportBatchesRepository,
  candidatesRepository: ImportCandidatesRepository,
): ImportsService {
  return {
    async createBatch(input) {
      return batchesRepository.create({
        sourceFileName: input.sourceFileName,
        sourceFilePath: input.sourceFilePath,
        sourceFileSha256: input.sourceFileSha256,
      });
    },
    async storeCandidates(importBatchId, candidates) {
      await candidatesRepository.upsertMany(importBatchId, candidates);
    },
    async resolveCandidates() {
      return notImplemented("ImportsService.resolveCandidates");
    },
  };
}
