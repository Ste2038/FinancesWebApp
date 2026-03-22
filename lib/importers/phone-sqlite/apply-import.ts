import { ImportApplySelection, ImportBatchSummary } from "../../domain/models";
import { AccountGroupsRepository } from "../../db/repositories/account-groups-repository";
import { AccountsRepository } from "../../db/repositories/accounts-repository";
import { CategoriesRepository } from "../../db/repositories/categories-repository";
import { TransactionsRepository } from "../../db/repositories/transactions-repository";
import { ImportCandidatesRepository } from "../../db/repositories/import-candidates-repository";

export interface ImportApplyContext {
  accountGroupsRepository: AccountGroupsRepository;
  accountsRepository: AccountsRepository;
  categoriesRepository: CategoriesRepository;
  transactionsRepository: TransactionsRepository;
  importCandidatesRepository: ImportCandidatesRepository;
}

export async function applyImportSelections(
  context: ImportApplyContext,
  importBatchId: number,
  selections: ImportApplySelection[],
): Promise<ImportBatchSummary> {
  const candidates = await context.importCandidatesRepository.listByBatch(importBatchId);
  const selectionMap = new Map(
    selections.map((selection) => [`${selection.entityType}:${selection.entityKey}`, selection.action]),
  );

  const summary: ImportBatchSummary = {
    created: 0,
    updated: 0,
    deleted: 0,
    kept: 0,
    ignored: 0,
  };

  for (const candidate of candidates) {
    const key = `${candidate.entity_type}:${candidate.entity_key}`;
    const action = selectionMap.get(key) ?? candidate.action;
    const incoming = candidate.incoming_payload_json
      ? JSON.parse(candidate.incoming_payload_json)
      : undefined;

    if (action === "ignore") {
      summary.ignored += 1;
    } else if (action === "keep") {
      summary.kept += 1;
    } else if (candidate.entity_type === "account_group") {
      if (action === "delete") {
        await context.accountGroupsRepository.softDelete(candidate.entity_key);
        summary.deleted += 1;
      } else if (incoming) {
        await context.accountGroupsRepository.upsert(incoming);
        summary[action === "add" ? "created" : "updated"] += 1;
      }
    } else if (candidate.entity_type === "account") {
      if (action === "delete") {
        await context.accountsRepository.softDelete(candidate.entity_key);
        summary.deleted += 1;
      } else if (incoming) {
        await context.accountsRepository.upsert(incoming);
        summary[action === "add" ? "created" : "updated"] += 1;
      }
    } else if (candidate.entity_type === "category") {
      if (action === "delete") {
        await context.categoriesRepository.softDelete(candidate.entity_key);
        summary.deleted += 1;
      } else if (incoming) {
        await context.categoriesRepository.upsert(incoming);
        summary[action === "add" ? "created" : "updated"] += 1;
      }
    } else if (candidate.entity_type === "transaction") {
      if (action === "delete") {
        await context.transactionsRepository.softDelete(candidate.entity_key);
        summary.deleted += 1;
      } else if (incoming) {
        await context.transactionsRepository.upsert(incoming);
        summary[action === "add" ? "created" : "updated"] += 1;
      }
    }

    await context.importCandidatesRepository.resolveCandidate(candidate.id, action);
  }

  return summary;
}
