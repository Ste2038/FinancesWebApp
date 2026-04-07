import { ImportCandidateRow } from "../db/repositories/import-candidates-repository";
import { ImportAction, TransactionInput, TransactionReviewInput } from "../domain/models";
import { StatementPdfSourceRaw } from "./statement-pdf/types";
import { isStatementPdfSourceRaw } from "./statement-pdf/utils";

export interface SerializedImportCandidate {
  entityType: string;
  entityKey: string;
  action: ImportAction;
  suggestedAction?: ImportAction;
  diffKind?: string;
  local?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  diff?: Record<string, unknown>;
  allowedActions?: ImportAction[];
  transactionReview?: TransactionReviewInput;
  statementDetails?: {
    conto: string;
    operation: string;
    bankCategory: string | null;
    bookedFlag: string | null;
    signedAmount: number;
    transactionDate: string | null;
  };
}

function getCandidateDiffKind(input: {
  diff: Record<string, unknown> | undefined;
  incoming: Record<string, unknown> | undefined;
  local: Record<string, unknown> | undefined;
}) {
  const matchType = typeof input.diff?.matchType === "string" ? input.diff.matchType : undefined;
  if (matchType === "new") {
    return "new";
  }

  if (matchType === "exact_statement" || matchType === "semantic_duplicate") {
    return "unchanged";
  }

  if (!input.local) {
    return "new";
  }

  if (!input.incoming) {
    return "missing";
  }

  return input.local.sourceHash === input.incoming.sourceHash ? "unchanged" : "changed";
}

function getStatementSourceRaw(
  incoming: Record<string, unknown> | undefined,
  local: Record<string, unknown> | undefined,
): StatementPdfSourceRaw | undefined {
  if (isStatementPdfSourceRaw(incoming?.sourceRaw)) {
    return incoming.sourceRaw;
  }

  if (isStatementPdfSourceRaw(local?.sourceRaw)) {
    return local.sourceRaw;
  }

  return undefined;
}

function getStatementAllowedActions(matchType: string | undefined): ImportAction[] | undefined {
  if (matchType === "new") {
    return ["add", "ignore"];
  }

  if (matchType === "exact_statement") {
    return ["keep", "update", "ignore"];
  }

  if (matchType === "semantic_duplicate") {
    return ["keep", "add", "ignore"];
  }

  return undefined;
}

function getStatementTransactionReview(input: {
  matchType: string | undefined;
  incoming: Record<string, unknown> | undefined;
  local: Record<string, unknown> | undefined;
}): TransactionReviewInput | undefined {
  const incomingTransaction = input.incoming as TransactionInput | undefined;
  const localTransaction = input.local as TransactionInput | undefined;

  if (input.matchType === "exact_statement" && localTransaction) {
    return {
      accountSourceUid: localTransaction.accountSourceUid ?? null,
      categorySourceUid: localTransaction.categorySourceUid ?? null,
      isTransfer: Boolean(localTransaction.targetAccountSourceUid),
      targetAccountSourceUid: localTransaction.targetAccountSourceUid ?? null,
    };
  }

  if (incomingTransaction) {
    return {
      accountSourceUid: incomingTransaction.accountSourceUid ?? null,
      categorySourceUid: incomingTransaction.categorySourceUid ?? null,
      isTransfer: Boolean(incomingTransaction.targetAccountSourceUid),
      targetAccountSourceUid: incomingTransaction.targetAccountSourceUid ?? null,
    };
  }

  return undefined;
}

function serializeCandidate(input: {
  action: string;
  diff?: Record<string, unknown>;
  entityKey: string;
  entityType: string;
  incoming?: Record<string, unknown>;
  local?: Record<string, unknown>;
}): SerializedImportCandidate {
  const matchType = typeof input.diff?.matchType === "string" ? input.diff.matchType : undefined;
  const statementSourceRaw = getStatementSourceRaw(input.incoming, input.local);

  return {
    entityType: input.entityType,
    entityKey: input.entityKey,
    action: input.action as ImportAction,
    suggestedAction: input.action as ImportAction,
    diffKind: getCandidateDiffKind({
      diff: input.diff,
      incoming: input.incoming,
      local: input.local,
    }),
    local: input.local,
    incoming: input.incoming,
    diff: input.diff,
    allowedActions: getStatementAllowedActions(matchType),
    transactionReview: statementSourceRaw
      ? getStatementTransactionReview({
          matchType,
          incoming: input.incoming,
          local: input.local,
        })
      : undefined,
    statementDetails: statementSourceRaw
      ? {
          conto: statementSourceRaw.conto,
          operation: statementSourceRaw.operation,
          bankCategory: statementSourceRaw.bankCategory,
          bookedFlag: statementSourceRaw.bookedFlag,
          signedAmount: statementSourceRaw.signedAmount,
          transactionDate:
            (input.incoming as TransactionInput | undefined)?.transactionDate
            ?? (input.local as TransactionInput | undefined)?.transactionDate
            ?? null,
        }
      : undefined,
  };
}

export function serializeImportCandidate(candidate: {
  action: string;
  diff?: Record<string, unknown>;
  entityKey: string;
  entityType: string;
  incoming?: Record<string, unknown>;
  local?: Record<string, unknown>;
}): SerializedImportCandidate {
  return serializeCandidate(candidate);
}

export function serializeStoredImportCandidate(row: ImportCandidateRow): SerializedImportCandidate {
  return serializeCandidate({
    entityType: row.entity_type,
    entityKey: row.entity_key,
    action: row.action,
    local: row.local_payload_json ? JSON.parse(row.local_payload_json) : undefined,
    incoming: row.incoming_payload_json ? JSON.parse(row.incoming_payload_json) : undefined,
    diff: row.diff_payload_json ? JSON.parse(row.diff_payload_json) : undefined,
  });
}
