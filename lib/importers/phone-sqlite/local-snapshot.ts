import { AccountGroupRow } from "../../db/repositories/account-groups-repository";
import { AccountRow } from "../../db/repositories/accounts-repository";
import { CategoryRow } from "../../db/repositories/categories-repository";
import { TransactionRow } from "../../db/repositories/transactions-repository";
import {
  AccountGroupInput,
  AccountInput,
  CategoryInput,
  TransactionInput,
} from "../../domain/models";

export function mapLocalAccountGroups(rows: AccountGroupRow[]): AccountGroupInput[] {
  return rows.map((row) => ({
    sourceUid: row.source_uid,
    sourceHash: row.source_hash,
    sourceDeleted: Boolean(row.source_deleted),
    displayName: row.display_name,
    sourceType: row.source_type,
    orderSeq: null,
    usedAt: null,
  }));
}

export function mapLocalAccounts(rows: AccountRow[]): AccountInput[] {
  return rows.map((row) => ({
    sourceUid: row.source_uid,
    sourceHash: row.source_hash,
    sourceDeleted: Boolean(row.source_deleted),
    displayName: row.display_name,
    nickname: row.nickname,
    accountGroupSourceUid: row.source_group_uid,
    currencyUid: row.currency_uid,
    cardDayFin: null,
    cardDayPay: null,
    appPackage: null,
    appName: null,
    smsTel: null,
    smsString: null,
    isTransferExpense: false,
    isCardAutoPay: false,
    sourceType: null,
    orderSeq: null,
    usedAt: null,
  }));
}

export function mapLocalCategories(rows: CategoryRow[]): CategoryInput[] {
  return rows.map((row) => ({
    sourceUid: row.source_uid,
    sourceHash: row.source_hash,
    sourceDeleted: Boolean(row.source_deleted),
    displayName: row.display_name,
    parentSourceUid: row.source_parent_uid,
    categoryType: row.category_type,
    status: row.status,
    orderSeq: null,
    usedAt: null,
  }));
}

export function mapLocalTransactions(rows: TransactionRow[]): TransactionInput[] {
  return rows.map((row) => ({
    sourceUid: row.source_uid,
    sourceHash: row.source_hash,
    sourceDeleted: Boolean(row.source_deleted),
    sourceRaw: row.source_raw_json ? JSON.parse(row.source_raw_json) : undefined,
    accountSourceUid: row.source_account_uid,
    targetAccountSourceUid: row.source_target_account_uid,
    categorySourceUid: row.source_category_uid,
    transactionType: row.transaction_type,
    transactionDate: row.transaction_date,
    bookedAt: row.booked_at,
    paidAt: row.paid_at,
    amount: row.amount,
    amountAccount: row.amount_account,
    memo: row.memo,
    content: row.content,
    payee: row.payee,
    smsOrigin: row.sms_origin,
    isPaid: Boolean(row.is_paid),
    origin: row.origin,
  }));
}
