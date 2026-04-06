import { AnalyticsFilters } from "./types";

interface AnalyticsWhereClauseOptions {
  dateExpression?: string;
  transactionTableAlias?: string;
}

export const NORMALIZED_TRANSACTION_DATE_SQL = `COALESCE(
  CASE
    WHEN booked_at LIKE '____-__-__%' THEN substr(booked_at, 1, 10)
    ELSE NULL
  END,
  CASE
    WHEN transaction_date LIKE '____-__-__%' THEN substr(transaction_date, 1, 10)
    WHEN length(transaction_date) = 13 AND transaction_date NOT GLOB '*[^0-9]*'
      THEN date(CAST(transaction_date AS INTEGER) / 1000, 'unixepoch')
    WHEN length(transaction_date) = 10 AND transaction_date NOT GLOB '*[^0-9]*'
      THEN date(CAST(transaction_date AS INTEGER), 'unixepoch')
    WHEN length(transaction_date) = 8 AND transaction_date NOT GLOB '*[^0-9]*'
      THEN substr(transaction_date, 1, 4) || '-' || substr(transaction_date, 5, 2) || '-' || substr(transaction_date, 7, 2)
    ELSE NULL
  END,
  CASE
    WHEN created_at LIKE '____-__-__%' THEN substr(created_at, 1, 10)
    ELSE NULL
  END
)`;

export const SIGNED_TRANSACTION_AMOUNT_SQL = `CASE
  WHEN transaction_type IN (1, 3, 8) THEN -COALESCE(amount_account, amount, 0)
  WHEN transaction_type IN (0, 4, 7) THEN COALESCE(amount_account, amount, 0)
  ELSE COALESCE(amount_account, amount, 0)
END`;

export function buildAnalyticsWhereClause(
  filters: AnalyticsFilters = {},
  options: AnalyticsWhereClauseOptions = {},
) {
  const dateExpression = options.dateExpression ?? NORMALIZED_TRANSACTION_DATE_SQL;
  const columnPrefix = options.transactionTableAlias ? `${options.transactionTableAlias}.` : "";
  const accountIdColumn = `${columnPrefix}account_id`;
  const categoryIdColumn = `${columnPrefix}category_id`;
  const sourceDeletedColumn = `${columnPrefix}source_deleted`;
  const clauses = [
    `${sourceDeletedColumn} = 0`,
    `${accountIdColumn} IN (
      SELECT id
      FROM accounts
      WHERE source_deleted = 0 AND is_archived = 0
    )`,
  ];
  const params: unknown[] = [];

  if (filters.dateRange?.startDate) {
    clauses.push(`${dateExpression} >= ?`);
    params.push(filters.dateRange.startDate);
  }

  if (filters.dateRange?.endDate) {
    clauses.push(`${dateExpression} <= ?`);
    params.push(filters.dateRange.endDate);
  }

  if (filters.accountIds && filters.accountIds.length > 0) {
    clauses.push(`${accountIdColumn} IN (${filters.accountIds.map(() => "?").join(", ")})`);
    params.push(...filters.accountIds);
  }

  if (filters.accountGroupIds && filters.accountGroupIds.length > 0) {
    clauses.push(
      `${accountIdColumn} IN (
        SELECT id
        FROM accounts
        WHERE source_deleted = 0
          AND is_archived = 0
          AND account_group_id IN (${filters.accountGroupIds.map(() => "?").join(", ")})
      )`,
    );
    params.push(...filters.accountGroupIds);
  }

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    clauses.push(`${categoryIdColumn} IN (${filters.categoryIds.map(() => "?").join(", ")})`);
    params.push(...filters.categoryIds);
  }

  return {
    whereClause: clauses.join(" AND "),
    params,
  };
}
