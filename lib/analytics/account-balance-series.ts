import { AnalyticsFilters, SeriesPointByAccount } from "./types";
import { SqliteClient } from "../db/types";
import {
  buildAnalyticsWhereClause,
  NORMALIZED_TRANSACTION_DATE_SQL,
  SIGNED_TRANSACTION_AMOUNT_SQL,
} from "./query-helpers";

export interface AccountBalanceQueryContext {
  client: SqliteClient;
}

export async function getAccountBalanceSeries(
  context: AccountBalanceQueryContext,
  filters: AnalyticsFilters = {},
): Promise<SeriesPointByAccount[]> {
  const { whereClause, params } = buildAnalyticsWhereClause(filters);

  return context.client.query<SeriesPointByAccount>(
    `WITH daily_totals AS (
      SELECT
        ${NORMALIZED_TRANSACTION_DATE_SQL} AS date,
        account_id,
        SUM(${SIGNED_TRANSACTION_AMOUNT_SQL}) AS daily_total
      FROM transactions
      WHERE ${whereClause} AND account_id IS NOT NULL AND ${NORMALIZED_TRANSACTION_DATE_SQL} IS NOT NULL
      GROUP BY ${NORMALIZED_TRANSACTION_DATE_SQL}, account_id
    )
    SELECT
      date,
      account_id AS accountId,
      SUM(daily_total) OVER (
        PARTITION BY account_id
        ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS value
    FROM daily_totals
    ORDER BY date, account_id`,
    params,
  );
}
