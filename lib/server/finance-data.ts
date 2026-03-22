import { SIGNED_TRANSACTION_AMOUNT_SQL } from "../analytics/query-helpers";
import { getAccountBalanceSeries } from "../analytics/account-balance-series";
import { getCategoryMonthlySeries } from "../analytics/category-monthly-series";
import { getNetWorthSeries } from "../analytics/net-worth";
import { SqliteClient } from "../db/types";
import { createAppContext } from "./app-context";
import { getDashboardSnapshot } from "./dashboard";

export interface AccountListItem {
  id: number;
  source_uid: string;
  source_hash: string;
  display_name: string;
  nickname: string | null;
  source_group_uid: string | null;
  group_name: string | null;
  currency_uid: string | null;
  balance: number;
  source_deleted: number;
  is_archived: number;
  archived_at: string | null;
  deleted_at: string | null;
}

export interface TransactionListItem {
  id: number;
  source_uid: string;
  transaction_date: string | null;
  booked_at: string | null;
  category_name: string | null;
  amount: number | null;
  amount_account: number | null;
  transaction_type: number | null;
}

async function listAccountsForDisplay(
  client: SqliteClient,
  options: { includeArchived?: boolean } = {},
): Promise<AccountListItem[]> {
  const includeArchived = options.includeArchived ?? true;

  return client.query<AccountListItem>(
    `SELECT
      a.id,
      a.source_uid,
      a.source_hash,
      a.display_name,
      a.nickname,
      a.source_group_uid,
      ag.name AS group_name,
      a.currency_uid,
      ROUND(COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN ${SIGNED_TRANSACTION_AMOUNT_SQL} ELSE 0 END), 0), 2) AS balance,
      a.source_deleted,
      a.is_archived,
      a.archived_at,
      a.deleted_at
    FROM accounts a
    LEFT JOIN account_groups ag
      ON ag.id = a.account_group_id
      OR (a.account_group_id IS NULL AND ag.source_uid = a.source_group_uid)
    LEFT JOIN transactions t
      ON t.account_id = a.id
      AND t.source_deleted = 0
    ${includeArchived ? "" : "WHERE a.source_deleted = 0 AND a.is_archived = 0"}
    GROUP BY
      a.id,
      a.source_uid,
      a.source_hash,
      a.display_name,
      a.nickname,
      a.source_group_uid,
      ag.name,
      a.currency_uid,
      a.source_deleted,
      a.is_archived,
      a.archived_at,
      a.deleted_at
    ORDER BY
      CASE WHEN a.source_deleted = 0 AND a.is_archived = 0 THEN 0 ELSE 1 END,
      COALESCE(a.order_seq, 999999),
      a.display_name`,
  );
}

async function listTransactionsForDisplay(client: SqliteClient): Promise<TransactionListItem[]> {
  return client.query<TransactionListItem>(
    `SELECT
      t.id,
      t.source_uid,
      t.transaction_date,
      t.booked_at,
      c.name AS category_name,
      t.amount,
      t.amount_account,
      t.transaction_type
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    ORDER BY COALESCE(t.transaction_date, t.booked_at, t.created_at) DESC, t.id DESC`,
  );
}

export async function getOverviewState() {
  const context = await createAppContext();

  try {
    const [snapshot, accounts, netWorthSeries, categorySeries] = await Promise.all([
      getDashboardSnapshot(),
      listAccountsForDisplay(context.client, { includeArchived: false }),
      getNetWorthSeries({ client: context.client }),
      getCategoryMonthlySeries({ client: context.client }),
    ]);

    return {
      snapshot,
      accounts,
      netWorthSeries,
      categorySeries,
    };
  } finally {
    await context.client.close();
  }
}

export async function getAccountsList() {
  const context = await createAppContext();

  try {
    return listAccountsForDisplay(context.client);
  } finally {
    await context.client.close();
  }
}

export async function getCategoriesList() {
  const context = await createAppContext();

  try {
    return context.repositories.categories.list();
  } finally {
    await context.client.close();
  }
}

export async function getTransactionsList() {
  const context = await createAppContext();

  try {
    return listTransactionsForDisplay(context.client);
  } finally {
    await context.client.close();
  }
}

export async function getAnalyticsState() {
  const context = await createAppContext();

  try {
    const [netWorthSeries, accountSeries, categorySeries] = await Promise.all([
      getNetWorthSeries({ client: context.client }),
      getAccountBalanceSeries({ client: context.client }),
      getCategoryMonthlySeries({ client: context.client }),
    ]);

    return {
      netWorthSeries,
      accountSeries,
      categorySeries,
    };
  } finally {
    await context.client.close();
  }
}

export async function getImportQueue() {
  const context = await createAppContext();

  try {
    return context.repositories.importBatches.listRecent();
  } finally {
    await context.client.close();
  }
}
