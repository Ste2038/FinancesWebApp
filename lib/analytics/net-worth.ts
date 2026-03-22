import { AnalyticsFilters, TimeSeriesPoint } from "./types";
import { SqliteClient } from "../db/types";
import {
  buildAnalyticsWhereClause,
  NORMALIZED_TRANSACTION_DATE_SQL,
  SIGNED_TRANSACTION_AMOUNT_SQL,
} from "./query-helpers";

export interface NetWorthQueryContext {
  client: SqliteClient;
}

export async function getNetWorthSeries(
  context: NetWorthQueryContext,
  filters: AnalyticsFilters = {},
): Promise<TimeSeriesPoint[]> {
  const { whereClause, params } = buildAnalyticsWhereClause(filters);

  return context.client.query<TimeSeriesPoint>(
    `WITH daily_totals AS (
      SELECT
        ${NORMALIZED_TRANSACTION_DATE_SQL} AS date,
        SUM(${SIGNED_TRANSACTION_AMOUNT_SQL}) AS daily_total
      FROM transactions
      WHERE ${whereClause} AND ${NORMALIZED_TRANSACTION_DATE_SQL} IS NOT NULL
      GROUP BY ${NORMALIZED_TRANSACTION_DATE_SQL}
    )
    SELECT
      date,
      SUM(daily_total) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS value
    FROM daily_totals
    ORDER BY date`,
    params,
  );
}
