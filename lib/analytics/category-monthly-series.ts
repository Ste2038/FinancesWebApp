import { AnalyticsFilters, SeriesPointByCategory } from "./types";
import { SqliteClient } from "../db/types";
import {
  buildAnalyticsWhereClause,
  NORMALIZED_TRANSACTION_DATE_SQL,
  SIGNED_TRANSACTION_AMOUNT_SQL,
} from "./query-helpers";

export interface CategoryMonthlyQueryContext {
  client: SqliteClient;
}

export async function getCategoryMonthlySeries(
  context: CategoryMonthlyQueryContext,
  filters: AnalyticsFilters = {},
): Promise<SeriesPointByCategory[]> {
  const aliasedDateSql = NORMALIZED_TRANSACTION_DATE_SQL
    .replaceAll("booked_at", "t.booked_at")
    .replaceAll("transaction_date", "t.transaction_date")
    .replaceAll("created_at", "t.created_at");
  const aliasedSignedAmountSql = `CASE
    WHEN t.transaction_type IN (1, 3, 8) THEN -ABS(COALESCE(t.amount_account, t.amount, 0))
    WHEN t.transaction_type IN (0, 4, 7) THEN ABS(COALESCE(t.amount_account, t.amount, 0))
    ELSE COALESCE(t.amount_account, t.amount, 0)
  END`;
  const { whereClause, params } = buildAnalyticsWhereClause(filters, {
    dateExpression: aliasedDateSql,
    transactionTableAlias: "t",
  });

  return context.client.query<SeriesPointByCategory>(
    `SELECT
      substr(${aliasedDateSql}, 1, 7) || '-01' AS date,
      t.category_id AS categoryId,
      ABS(SUM(CASE WHEN ${aliasedSignedAmountSql} < 0 THEN ${aliasedSignedAmountSql} ELSE 0 END)) AS value
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE ${whereClause}
      AND t.category_id IS NOT NULL
      AND ${aliasedDateSql} IS NOT NULL
      AND c.category_type = 1
    GROUP BY substr(${aliasedDateSql}, 1, 7), t.category_id
    ORDER BY date, category_id`,
    params,
  );
}
