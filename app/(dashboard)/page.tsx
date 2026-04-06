import { GroupedBars } from "@/components/charts/grouped-bars";
import { LineChart } from "@/components/charts/line-chart";
import { SectionCard } from "@/components/dashboard/section-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { formatEuroCurrency, formatSignedEuroCurrency } from "@/lib/format/currency";
import { getOverviewState } from "@/lib/server/finance-data";

const netWorthSeries = [
  { label: "Oct", value: 24800 },
  { label: "Nov", value: 25940 },
  { label: "Dec", value: 27120 },
  { label: "Jan", value: 26890 },
  { label: "Feb", value: 28210 },
  { label: "Mar", value: 29180 }
];

const monthlyFood = [
  { month: "Jan", previousYear: 610, currentYear: 640 },
  { month: "Feb", previousYear: 560, currentYear: 590 },
  { month: "Mar", previousYear: 620, currentYear: 675 },
  { month: "Apr", previousYear: 580, currentYear: 0 },
  { month: "May", previousYear: 640, currentYear: 0 },
  { month: "Jun", previousYear: 610, currentYear: 0 },
  { month: "Jul", previousYear: 690, currentYear: 0 },
  { month: "Aug", previousYear: 670, currentYear: 0 },
  { month: "Sep", previousYear: 600, currentYear: 0 },
  { month: "Oct", previousYear: 575, currentYear: 0 },
  { month: "Nov", previousYear: 590, currentYear: 0 },
  { month: "Dec", previousYear: 730, currentYear: 0 }
];

export const dynamic = "force-dynamic";

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toShortDateLabel(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function toMonthlyLineSeries(series: Array<{ date: string; value: number }>, fallback: typeof netWorthSeries) {
  if (series.length === 0) {
    return fallback;
  }

  const grouped = new Map<string, { label: string; value: number }>();

  for (const point of series) {
    const parsed = parseIsoDate(point.date);
    if (!parsed) {
      continue;
    }

    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    grouped.set(key, {
      label: toShortDateLabel(`${key}-01`),
      value: point.value,
    });
  }

  const values = Array.from(grouped.values());
  return values.length > 0 ? values.slice(-12) : fallback;
}

function toMonthlyBars(series: Array<{ date: string; value: number }>) {
  if (series.length === 0) {
    return monthlyFood;
  }

  const grouped = new Map<string, { month: string; currentYear: number; previousYear: number }>();
  const years = series
    .map((point) => parseIsoDate(point.date)?.getFullYear() ?? null)
    .filter((year): year is number => year !== null);
  const latestYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
  const previousYear = latestYear - 1;

  for (const point of series) {
    const date = parseIsoDate(point.date);
    if (!date) {
      continue;
    }

    const month = date.toLocaleString("en-US", { month: "short" });
    const existing = grouped.get(month) ?? { month, currentYear: 0, previousYear: 0 };
    if (date.getFullYear() === latestYear) {
      existing.currentYear += point.value;
    } else if (date.getFullYear() === previousYear) {
      existing.previousYear += point.value;
    }
    grouped.set(month, existing);
  }

  const values = Array.from(grouped.values());
  return values.length > 0 ? values : monthlyFood;
}

export default async function OverviewPage() {
  const { snapshot, accounts, netWorthSeries: liveNetWorthSeries, categorySeries } = await getOverviewState();
  const displayedNetWorthSeries =
    liveNetWorthSeries.length > 0 ? toMonthlyLineSeries(liveNetWorthSeries, netWorthSeries) : netWorthSeries;
  const displayedCategorySeries = toMonthlyBars(categorySeries);

  return (
    <>
      <section className="hero">
        <div className="summary-grid">
          <SummaryCard
            delta={`${snapshot.totals.transactions} transactions recorded`}
            label="Net flow"
            tone="accent"
            value={formatSignedEuroCurrency(snapshot.balances.netFlow)}
          />
          <SummaryCard
            delta={`${snapshot.totals.accounts} active accounts`}
            label="Tracked accounts"
            value={String(snapshot.totals.accounts)}
          />
          <SummaryCard
            delta={`${snapshot.totals.pendingImportCandidates} candidates waiting`}
            label="Import queue"
            value={String(snapshot.totals.pendingImportCandidates)}
          />
          <SummaryCard
            delta={`${snapshot.totals.categories} categories mapped`}
            label="Expenses"
            tone="warning"
            value={formatEuroCurrency(snapshot.balances.expenses)}
          />
        </div>
      </section>

      <div className="card-grid">
        <SectionCard
          description="This module will read from the normalized local ledger and show the full portfolio trend."
          title="Total money over time"
        >
          <LineChart series={displayedNetWorthSeries} />
        </SectionCard>

        <SectionCard
          description="The category comparison view shows month-by-month expense rhythm across multiple years."
          title="Food category comparison"
        >
          <GroupedBars groups={displayedCategorySeries} />
        </SectionCard>
      </div>

      <section className="table-card">
        <h2>Tracked account balances</h2>
        <p>Only active accounts are shown here. Archived ones are excluded from totals and charts.</p>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Group</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length > 0 ? (
              accounts.slice(0, 6).map((account) => (
                <tr key={account.source_uid}>
                  <td>{account.display_name}</td>
                  <td>{account.group_name ?? "Ungrouped"}</td>
                  <td>{formatEuroCurrency(account.balance)}</td>
                  <td>
                    <span className="badge badge--good">Active</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="muted">
                  No active accounts imported yet. Use the Imports page to load the phone export.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
