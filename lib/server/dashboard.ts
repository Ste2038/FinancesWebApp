import { createAppContext } from "./app-context";
import { SIGNED_TRANSACTION_AMOUNT_SQL } from "../analytics/query-helpers";

export interface DashboardSnapshot {
  totals: {
    accounts: number;
    categories: number;
    transactions: number;
    pendingImportCandidates: number;
  };
  balances: {
    netFlow: number;
    expenses: number;
    income: number;
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const context = await createAppContext();

  try {
    const counts = await context.client.query<{
      accounts: number;
      categories: number;
      transactions: number;
      pending_import_candidates: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM accounts WHERE source_deleted = 0 AND is_archived = 0) AS accounts,
        (SELECT COUNT(*) FROM categories WHERE source_deleted = 0) AS categories,
        (SELECT COUNT(*) FROM transactions WHERE source_deleted = 0) AS transactions,
        (SELECT COUNT(*) FROM import_candidates WHERE resolved_at IS NULL) AS pending_import_candidates`,
    );

    const money = await context.client.query<{
      net_flow: number | null;
      expenses: number | null;
      income: number | null;
    }>(
      `SELECT
        COALESCE(SUM(${SIGNED_TRANSACTION_AMOUNT_SQL}), 0) AS net_flow,
        COALESCE(SUM(CASE WHEN ${SIGNED_TRANSACTION_AMOUNT_SQL} < 0 THEN ABS(${SIGNED_TRANSACTION_AMOUNT_SQL}) ELSE 0 END), 0) AS expenses,
        COALESCE(SUM(CASE WHEN ${SIGNED_TRANSACTION_AMOUNT_SQL} >= 0 THEN ${SIGNED_TRANSACTION_AMOUNT_SQL} ELSE 0 END), 0) AS income
      FROM transactions
      WHERE source_deleted = 0
        AND account_id IN (
          SELECT id
          FROM accounts
          WHERE source_deleted = 0 AND is_archived = 0
        )`,
    );

    return {
      totals: {
        accounts: counts[0]?.accounts ?? 0,
        categories: counts[0]?.categories ?? 0,
        transactions: counts[0]?.transactions ?? 0,
        pendingImportCandidates: counts[0]?.pending_import_candidates ?? 0,
      },
      balances: {
        netFlow: money[0]?.net_flow ?? 0,
        expenses: money[0]?.expenses ?? 0,
        income: money[0]?.income ?? 0,
      },
    };
  } finally {
    await context.client.close();
  }
}
