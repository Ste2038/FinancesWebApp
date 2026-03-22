import {
  AccountGroupInput,
  AccountInput,
  CategoryInput,
  TransactionInput,
} from "../../domain/models";
import {
  PhoneAssetGroupRow,
  PhoneAssetRow,
  PhoneCategoryRow,
  PhoneIncomeOutcomeRow,
  PhoneDatabaseSnapshot,
  NormalizedPhoneSnapshot,
} from "./types";
import { createSourceFingerprint } from "./fingerprint";

function toBoolean(value: unknown): boolean {
  return value === 1 || value === "1" || value === true;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : null;
}

function normalizePhoneDate(value: unknown): string | null {
  const text = toNullableString(value);
  if (!text) {
    return null;
  }

  if (/^\d{13}$/.test(text)) {
    const date = new Date(Number(text));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  if (/^\d{10}$/.test(text)) {
    const date = new Date(Number(text) * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  if (/^\d+$/.test(text)) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function normalizeAssetGroupRow(row: PhoneAssetGroupRow): AccountGroupInput {
  const sourceUid = toNullableString(row.uid) ?? `assetgroup:${row.DEVICE_ID ?? "unknown"}`;
  const payload = {
    sourceUid,
    name: toNullableString(row.ACC_GROUP_NAME),
    sourceType: toNullableNumber(row.TYPE),
    orderSeq: toNullableNumber(row.ORDERSEQ),
  };

  return {
    sourceUid,
    sourceHash: createSourceFingerprint(row),
    sourceDeleted: toBoolean(row.IS_DEL),
    sourceRaw: row,
    sourceType: payload.sourceType,
    displayName: payload.name ?? "Unnamed account group",
    orderSeq: payload.orderSeq,
    usedAt: toNullableNumber(row.USETIME),
  };
}

export function normalizeAssetRow(row: PhoneAssetRow): AccountInput {
  const sourceUid = toNullableString(row.uid) ?? `asset:${row.ID ?? "unknown"}`;

  return {
    sourceUid,
    sourceHash: createSourceFingerprint(row),
    sourceDeleted: false,
    sourceRaw: row,
    displayName: toNullableString(row.NIC_NAME) ?? "Unnamed account",
    nickname: toNullableString(row.NIC_NAME),
    accountGroupSourceUid: toNullableString(row.groupUid),
    currencyUid: toNullableString(row.currencyUid),
    cardDayFin: toNullableString(row.CARD_DAY_FIN),
    cardDayPay: toNullableString(row.CARD_DAY_PAY),
    appPackage: toNullableString(row.APP_PACKAGE),
    appName: toNullableString(row.APP_NAME),
    smsTel: toNullableString(row.SMS_TEL),
    smsString: toNullableString(row.SMS_STRING),
    isTransferExpense: toBoolean(row.IS_TRANS_EXPENSE),
    isCardAutoPay: toBoolean(row.IS_CARD_AUTO_PAY),
    sourceType: toNullableNumber(row.CARD_USAGE_HURDLE_TYPE),
    orderSeq: toNullableNumber(row.ORDERSEQ),
    usedAt: toNullableNumber(row.syncTime),
  };
}

export function normalizeCategoryRow(row: PhoneCategoryRow): CategoryInput {
  const sourceUid = toNullableString(row.uid) ?? `category:${row.ID ?? "unknown"}`;

  return {
    sourceUid,
    sourceHash: createSourceFingerprint(row),
    sourceDeleted: toBoolean(row.C_IS_DEL),
    sourceRaw: row,
    displayName: toNullableString(row.NAME) ?? "Unnamed category",
    parentSourceUid: toNullableString(row.pUid),
    categoryType: toNullableNumber(row.TYPE),
    status: toNullableNumber(row.STATUS),
    orderSeq: toNullableNumber(row.ORDERSEQ),
    usedAt: toNullableNumber(row.C_UTIME),
  };
}

export function normalizeTransactionRow(row: PhoneIncomeOutcomeRow): TransactionInput {
  const sourceUid = toNullableString(row.uid) ?? `transaction:${row.AID ?? "unknown"}`;

  return {
    sourceUid,
    sourceHash: createSourceFingerprint(row),
    sourceDeleted: toBoolean(row.IS_DEL),
    sourceRaw: row,
    accountSourceUid: toNullableString(row.assetUid),
    targetAccountSourceUid: toNullableString(row.toAssetUid),
    categorySourceUid: toNullableString(row.ctgUid),
    transactionType: toNullableNumber(row.DO_TYPE),
    transactionDate: normalizePhoneDate(row.ZDATE),
    bookedAt: normalizePhoneDate(row.WDATE),
    paidAt: normalizePhoneDate(row.paid),
    amount: toNullableNumber(row.ZMONEY ?? row.IN_ZMONEY),
    amountAccount: toNullableNumber(row.AMOUNT_ACCOUNT),
    memo: toNullableString(row.ZCONTENT),
    content: toNullableString(row.ZDATA),
    payee: toNullableString(row.ASSET_NIC ?? row.SMS_PARSE_CONTENT),
    smsOrigin: toNullableString(row.SMS_ORIGIN),
    isPaid: toBoolean(row.paid),
    origin: "import",
  };
}

export function normalizePhoneDatabaseSnapshot(
  snapshot: PhoneDatabaseSnapshot,
): NormalizedPhoneSnapshot {
  return {
    accountGroups: snapshot.assetGroups.map(normalizeAssetGroupRow),
    accounts: snapshot.assets.map(normalizeAssetRow),
    categories: snapshot.categories.map(normalizeCategoryRow),
    transactions: snapshot.transactions.map(normalizeTransactionRow),
  };
}
