import { createSourceFingerprint } from "../phone-sqlite/fingerprint";
import { TransactionRow } from "../../db/repositories/transactions-repository";
import { StatementPdfSourceRaw, StatementPdfTransaction } from "./types";

const TRANSFER_SOURCE_SUFFIX = ":out";
const TRANSFER_TARGET_SUFFIX = ":in";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeStatementOperation(value: string): string {
  return collapseWhitespace(value).toLocaleLowerCase("it-IT");
}

export function buildStatementSignature(input: {
  conto: string;
  date: string;
  normalizedOperation: string;
  signedAmount: number;
}) {
  return [
    input.conto,
    input.date,
    input.normalizedOperation,
    input.signedAmount.toFixed(2),
  ].join("|");
}

export function buildStatementSourceUid(input: {
  conto: string;
  date: string;
  normalizedOperation: string;
  signedAmount: number;
  occurrenceIndex: number;
}) {
  return `statement_pdf:${createSourceFingerprint({
    conto: input.conto,
    date: input.date,
    normalizedOperation: input.normalizedOperation,
    signedAmount: Number(input.signedAmount.toFixed(2)),
    occurrenceIndex: input.occurrenceIndex,
  })}`;
}

export function buildStatementSourceHash(input: {
  conto: string;
  date: string;
  normalizedOperation: string;
  signedAmount: number;
  occurrenceIndex: number;
}) {
  return createSourceFingerprint({
    kind: "statement_pdf",
    conto: input.conto,
    date: input.date,
    normalizedOperation: input.normalizedOperation,
    signedAmount: Number(input.signedAmount.toFixed(2)),
    occurrenceIndex: input.occurrenceIndex,
  });
}

export function isStatementPdfSourceRaw(value: unknown): value is StatementPdfSourceRaw {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>).kind === "statement_pdf" &&
      typeof (value as Record<string, unknown>).operation === "string" &&
      typeof (value as Record<string, unknown>).conto === "string",
  );
}

export function getStatementBaseSourceUid(sourceUid: string) {
  if (sourceUid.endsWith(TRANSFER_SOURCE_SUFFIX)) {
    return sourceUid.slice(0, -TRANSFER_SOURCE_SUFFIX.length);
  }

  if (sourceUid.endsWith(TRANSFER_TARGET_SUFFIX)) {
    return sourceUid.slice(0, -TRANSFER_TARGET_SUFFIX.length);
  }

  return sourceUid;
}

export function getTransferSourceUid(sourceUid: string) {
  return `${sourceUid}${TRANSFER_SOURCE_SUFFIX}`;
}

export function getTransferTargetUid(sourceUid: string) {
  return `${sourceUid}${TRANSFER_TARGET_SUFFIX}`;
}

export function getSignedTransactionAmount(row: Pick<TransactionRow, "amount" | "amount_account" | "transaction_type">) {
  const unsignedAmount = row.amount_account ?? row.amount ?? 0;

  if (row.transaction_type === 1 || row.transaction_type === 3 || row.transaction_type === 8) {
    return -Math.abs(unsignedAmount);
  }

  return Math.abs(unsignedAmount);
}

export function getLocalStatementSignature(
  row: Pick<
    TransactionRow,
    "transaction_date" | "booked_at" | "amount" | "amount_account" | "transaction_type" | "memo" | "content" | "payee" | "source_raw_json"
  >,
) {
  const sourceRaw = row.source_raw_json ? JSON.parse(row.source_raw_json) : undefined;
  const statementSourceRaw = isStatementPdfSourceRaw(sourceRaw) ? sourceRaw : undefined;
  const operation = statementSourceRaw?.normalizedOperation
    ?? normalizeStatementOperation(
      collapseWhitespace(row.content ?? row.memo ?? row.payee ?? ""),
    );
  const date = normalizeTransactionDate(row.transaction_date ?? row.booked_at);

  if (!date || !operation) {
    return undefined;
  }

  return `${date}|${operation}|${getSignedTransactionAmount(row).toFixed(2)}`;
}

export function normalizeTransactionDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{13}$/.test(value)) {
    return new Date(Number(value)).toISOString().slice(0, 10);
  }

  if (/^\d{10}$/.test(value)) {
    return new Date(Number(value) * 1000).toISOString().slice(0, 10);
  }

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function createStatementTransaction(input: {
  conto: string;
  date: string;
  operation: string;
  bankCategory: string | null;
  bookedFlag: string | null;
  signedAmount: number;
  occurrenceIndex: number;
}) {
  const normalizedOperation = normalizeStatementOperation(input.operation);
  const sourceUid = buildStatementSourceUid({
    conto: input.conto,
    date: input.date,
    normalizedOperation,
    signedAmount: input.signedAmount,
    occurrenceIndex: input.occurrenceIndex,
  });
  const sourceHash = buildStatementSourceHash({
    conto: input.conto,
    date: input.date,
    normalizedOperation,
    signedAmount: input.signedAmount,
    occurrenceIndex: input.occurrenceIndex,
  });
  const sourceRaw: StatementPdfSourceRaw = {
    kind: "statement_pdf",
    conto: input.conto,
    operation: collapseWhitespace(input.operation),
    normalizedOperation,
    bankCategory: input.bankCategory ? collapseWhitespace(input.bankCategory) : null,
    bookedFlag: input.bookedFlag,
    signedAmount: Number(input.signedAmount.toFixed(2)),
    occurrenceIndex: input.occurrenceIndex,
  };

  return {
    sourceUid,
    sourceHash,
    sourceDeleted: false,
    sourceRaw,
    accountSourceUid: null,
    targetAccountSourceUid: null,
    categorySourceUid: null,
    transactionType: input.signedAmount < 0 ? 1 : 0,
    transactionDate: input.date,
    bookedAt: input.date,
    paidAt: null,
    amount: Math.abs(input.signedAmount),
    amountAccount: Math.abs(input.signedAmount),
    memo: sourceRaw.operation,
    content: sourceRaw.operation,
    payee: null,
    smsOrigin: null,
    isPaid: true,
    origin: "statement_pdf",
  } satisfies StatementPdfTransaction;
}
