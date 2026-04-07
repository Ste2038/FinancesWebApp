export type EntityType =
  | "account_group"
  | "account"
  | "category"
  | "transaction";

export type ImportAction = "add" | "update" | "keep" | "delete" | "ignore";

export type ImportDiffKind = "new" | "changed" | "missing" | "unchanged";

export interface SourceRecord {
  sourceUid: string;
  sourceHash: string;
  sourceDeleted: boolean;
  sourceRaw?: Record<string, unknown>;
}

export interface AccountGroupInput extends SourceRecord {
  sourceType: number | null;
  displayName: string;
  orderSeq: number | null;
  usedAt: number | null;
}

export interface AccountInput extends SourceRecord {
  displayName: string;
  nickname: string | null;
  accountGroupSourceUid: string | null;
  currencyUid: string | null;
  cardDayFin: string | null;
  cardDayPay: string | null;
  appPackage: string | null;
  appName: string | null;
  smsTel: string | null;
  smsString: string | null;
  isTransferExpense: boolean;
  isCardAutoPay: boolean;
  sourceType: number | null;
  orderSeq: number | null;
  usedAt: number | null;
}

export interface CategoryInput extends SourceRecord {
  displayName: string;
  parentSourceUid: string | null;
  categoryType: number | null;
  status: number | null;
  orderSeq: number | null;
  usedAt: number | null;
}

export interface TransactionInput extends SourceRecord {
  accountSourceUid: string | null;
  targetAccountSourceUid: string | null;
  categorySourceUid: string | null;
  transactionType: number | null;
  transactionDate: string | null;
  bookedAt: string | null;
  paidAt: string | null;
  amount: number | null;
  amountAccount: number | null;
  memo: string | null;
  content: string | null;
  payee: string | null;
  smsOrigin: string | null;
  isPaid: boolean;
  origin: string;
}

export interface ImportCandidate<T = unknown> {
  entityType: EntityType;
  entityKey: string;
  diffKind: ImportDiffKind;
  action: ImportAction;
  local?: T;
  incoming?: T;
  diff?: Record<string, unknown>;
}

export interface TransactionReviewInput {
  accountSourceUid: string | null;
  categorySourceUid: string | null;
  isTransfer: boolean;
  targetAccountSourceUid: string | null;
}

export interface ImportApplySelection {
  entityType: EntityType;
  entityKey: string;
  action: ImportAction;
  transactionReview?: TransactionReviewInput;
}

export interface ImportBatchSummary {
  created: number;
  updated: number;
  deleted: number;
  kept: number;
  ignored: number;
}
