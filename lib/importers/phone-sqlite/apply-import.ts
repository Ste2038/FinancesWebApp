import {
  ImportAction,
  ImportApplySelection,
  ImportBatchSummary,
  TransactionInput,
  TransactionReviewInput,
} from "../../domain/models";
import { AccountGroupsRepository } from "../../db/repositories/account-groups-repository";
import { AccountsRepository } from "../../db/repositories/accounts-repository";
import { CategoriesRepository } from "../../db/repositories/categories-repository";
import { TransactionsRepository } from "../../db/repositories/transactions-repository";
import { ImportCandidatesRepository } from "../../db/repositories/import-candidates-repository";
import {
  createStatementTransferSourceUid,
  createStatementTransferTargetUid,
} from "../import-source-file";
import { isStatementPdfSourceRaw } from "../statement-pdf/utils";

export interface ImportApplyContext {
  accountGroupsRepository: AccountGroupsRepository;
  accountsRepository: AccountsRepository;
  categoriesRepository: CategoriesRepository;
  transactionsRepository: TransactionsRepository;
  importCandidatesRepository: ImportCandidatesRepository;
}

interface ParsedCandidateSelection {
  action: ImportAction;
  transactionReview?: TransactionReviewInput;
}

function createSummary(): ImportBatchSummary {
  return {
    created: 0,
    updated: 0,
    deleted: 0,
    kept: 0,
    ignored: 0,
  };
}

function isStatementPdfTransactionPayload(value: unknown): value is TransactionInput {
  return Boolean(
    value &&
      typeof value === "object" &&
      isStatementPdfSourceRaw((value as TransactionInput).sourceRaw),
  );
}

function getMatchType(diff: unknown) {
  if (!diff || typeof diff !== "object") {
    return undefined;
  }

  const matchType = (diff as Record<string, unknown>).matchType;
  return typeof matchType === "string" ? matchType : undefined;
}

function getAllowedStatementActions(matchType: string | undefined): ImportAction[] {
  if (matchType === "new") {
    return ["add", "ignore"];
  }

  if (matchType === "exact_statement") {
    return ["keep", "update", "ignore"];
  }

  if (matchType === "semantic_duplicate") {
    return ["keep", "add", "ignore"];
  }

  return ["keep", "ignore"];
}

async function assertStatementReviewIsValid(
  context: ImportApplyContext,
  review: TransactionReviewInput | undefined,
) {
  if (!review) {
    throw new Error("A transaction review is required for statement PDF rows.");
  }

  if (!review.accountSourceUid) {
    throw new Error("Select an account before applying this statement transaction.");
  }

  const account = await context.accountsRepository.findBySourceUid(review.accountSourceUid);
  if (!account || account.source_deleted !== 0) {
    throw new Error("The selected source account does not exist.");
  }

  if (review.isTransfer) {
    if (!review.targetAccountSourceUid) {
      throw new Error("Select a target account for statement transfers.");
    }

    if (review.targetAccountSourceUid === review.accountSourceUid) {
      throw new Error("A transfer must use two different accounts.");
    }

    const targetAccount = await context.accountsRepository.findBySourceUid(review.targetAccountSourceUid);
    if (!targetAccount || targetAccount.source_deleted !== 0) {
      throw new Error("The selected target account does not exist.");
    }

    return;
  }

  if (!review.categorySourceUid) {
    throw new Error("Select a category before applying this statement transaction.");
  }

  const category = await context.categoriesRepository.findBySourceUid(review.categorySourceUid);
  if (!category || category.source_deleted !== 0) {
    throw new Error("The selected category does not exist.");
  }
}

function createStatementNormalTransaction(
  incoming: TransactionInput,
  review: TransactionReviewInput,
): TransactionInput {
  const sourceRaw = isStatementPdfSourceRaw(incoming.sourceRaw) ? incoming.sourceRaw : undefined;
  const signedAmount = sourceRaw?.signedAmount ?? (incoming.transactionType === 1 ? -Math.abs(incoming.amount ?? 0) : Math.abs(incoming.amount ?? 0));
  const absoluteAmount = Math.abs(signedAmount);

  return {
    ...incoming,
    sourceUid: incoming.sourceUid,
    accountSourceUid: review.accountSourceUid,
    targetAccountSourceUid: null,
    categorySourceUid: review.categorySourceUid,
    transactionType: signedAmount < 0 ? 1 : 0,
    amount: absoluteAmount,
    amountAccount: absoluteAmount,
    origin: "statement_pdf",
  };
}

function createStatementTransferTransactions(
  incoming: TransactionInput,
  review: TransactionReviewInput,
): TransactionInput[] {
  const sourceRaw = isStatementPdfSourceRaw(incoming.sourceRaw) ? incoming.sourceRaw : undefined;
  const signedAmount = sourceRaw?.signedAmount ?? (incoming.transactionType === 1 ? -Math.abs(incoming.amount ?? 0) : Math.abs(incoming.amount ?? 0));
  const absoluteAmount = Math.abs(signedAmount);
  const baseSourceUid = incoming.sourceUid;

  return [
    {
      ...incoming,
      sourceUid: createStatementTransferSourceUid(baseSourceUid),
      accountSourceUid: review.accountSourceUid,
      targetAccountSourceUid: review.targetAccountSourceUid,
      categorySourceUid: null,
      transactionType: 3,
      amount: absoluteAmount,
      amountAccount: absoluteAmount,
      origin: "statement_pdf",
    },
    {
      ...incoming,
      sourceUid: createStatementTransferTargetUid(baseSourceUid),
      accountSourceUid: review.targetAccountSourceUid,
      targetAccountSourceUid: review.accountSourceUid,
      categorySourceUid: null,
      transactionType: 4,
      amount: absoluteAmount,
      amountAccount: absoluteAmount,
      origin: "statement_pdf",
    },
  ];
}

async function applyStatementCandidate(
  context: ImportApplyContext,
  candidate: {
    action: string;
    diff: unknown;
    entity_key: string;
    incoming_payload_json: string | null;
  },
  selection: ParsedCandidateSelection | undefined,
  summary: ImportBatchSummary,
) {
  const action = selection?.action ?? (candidate.action as ImportAction);
  const matchType = getMatchType(candidate.diff);
  const allowedActions = getAllowedStatementActions(matchType);

  if (!allowedActions.includes(action)) {
    throw new Error(`Action ${action} is not allowed for this statement candidate.`);
  }

  if (action === "ignore") {
    summary.ignored += 1;
    return action;
  }

  if (action === "keep") {
    summary.kept += 1;
    return action;
  }

  const incoming = candidate.incoming_payload_json
    ? JSON.parse(candidate.incoming_payload_json) as TransactionInput
    : undefined;

  if (!incoming || !isStatementPdfTransactionPayload(incoming)) {
    throw new Error("Statement import candidates must include an incoming transaction payload.");
  }

  await assertStatementReviewIsValid(context, selection?.transactionReview);

  const review = selection?.transactionReview as TransactionReviewInput;
  const desiredTransactions = review.isTransfer
    ? createStatementTransferTransactions(incoming, review)
    : [createStatementNormalTransaction(incoming, review)];
  const desiredSourceUids = new Set(desiredTransactions.map((transaction) => transaction.sourceUid));
  const possibleStatementSourceUids = [
    incoming.sourceUid,
    createStatementTransferSourceUid(incoming.sourceUid),
    createStatementTransferTargetUid(incoming.sourceUid),
  ];

  for (const sourceUid of possibleStatementSourceUids) {
    if (!desiredSourceUids.has(sourceUid)) {
      await context.transactionsRepository.softDelete(sourceUid);
    }
  }

  for (const transaction of desiredTransactions) {
    await context.transactionsRepository.upsert(transaction);
  }

  if (action === "add") {
    summary.created += 1;
  } else {
    summary.updated += 1;
  }

  return action;
}

export async function applyImportSelections(
  context: ImportApplyContext,
  importBatchId: number,
  selections: ImportApplySelection[],
): Promise<ImportBatchSummary> {
  const candidates = await context.importCandidatesRepository.listByBatch(importBatchId);
  const selectionMap = new Map<string, ParsedCandidateSelection>(
    selections.map((selection) => [
      `${selection.entityType}:${selection.entityKey}`,
      {
        action: selection.action,
        transactionReview: selection.transactionReview,
      },
    ]),
  );
  const summary = createSummary();

  for (const candidate of candidates) {
    const key = `${candidate.entity_type}:${candidate.entity_key}`;
    const selection = selectionMap.get(key);
    const incoming = candidate.incoming_payload_json
      ? JSON.parse(candidate.incoming_payload_json)
      : undefined;

    let resolvedAction: ImportAction;

    if (candidate.entity_type === "transaction" && isStatementPdfTransactionPayload(incoming)) {
      resolvedAction = await applyStatementCandidate(
        context,
        {
          action: candidate.action,
          diff: candidate.diff_payload_json ? JSON.parse(candidate.diff_payload_json) : undefined,
          entity_key: candidate.entity_key,
          incoming_payload_json: candidate.incoming_payload_json,
        },
        selection,
        summary,
      );
      await context.importCandidatesRepository.resolveCandidate(candidate.id, resolvedAction);
      continue;
    }

    const action = selection?.action ?? (candidate.action as ImportAction);
    resolvedAction = action;

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

    await context.importCandidatesRepository.resolveCandidate(candidate.id, resolvedAction);
  }

  return summary;
}
