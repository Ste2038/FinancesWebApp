import { GroupedBars } from "@/components/charts/grouped-bars";
import { LineChart } from "@/components/charts/line-chart";
import { SectionCard } from "@/components/dashboard/section-card";
import { getAnalyticsState } from "@/lib/server/finance-data";

const totalSeries = [
  { label: "Oct", value: 24800 },
  { label: "Nov", value: 25940 },
  { label: "Dec", value: 27120 },
  { label: "Jan", value: 26890 },
  { label: "Feb", value: 28210 },
  { label: "Mar", value: 29180 }
];

const accountSeries = [
  { label: "Oct", value: 9800 },
  { label: "Nov", value: 10120 },
  { label: "Dec", value: 10400 },
  { label: "Jan", value: 10320 },
  { label: "Feb", value: 10980 },
  { label: "Mar", value: 11780 }
];

const groupedSpending = [
  { month: "Jan", previousYear: 310, currentYear: 360 },
  { month: "Feb", previousYear: 280, currentYear: 330 },
  { month: "Mar", previousYear: 290, currentYear: 390 },
  { month: "Apr", previousYear: 340, currentYear: 0 },
  { month: "May", previousYear: 400, currentYear: 0 },
  { month: "Jun", previousYear: 365, currentYear: 0 },
  { month: "Jul", previousYear: 425, currentYear: 0 },
  { month: "Aug", previousYear: 410, currentYear: 0 },
  { month: "Sep", previousYear: 355, currentYear: 0 },
  { month: "Oct", previousYear: 332, currentYear: 0 },
  { month: "Nov", previousYear: 341, currentYear: 0 },
  { month: "Dec", previousYear: 390, currentYear: 0 }
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

function toMonthlyLineSeries(
  series: Array<{ date: string; value: number }>,
  fallback: typeof totalSeries,
) {
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
  return values.length > 0 ? values.slice(-18) : fallback;
}

function mapTimeSeries(series: Array<{ date: string; value: number }>, fallback: typeof totalSeries) {
  if (series.length === 0) {
    return fallback;
  }

  return toMonthlyLineSeries(series, fallback);
}

function mapAccountSeries(
  series: Array<{ date: string; accountId: number; value: number }>,
  fallback: typeof accountSeries,
) {
  if (series.length === 0) {
    return fallback;
  }

  return toMonthlyLineSeries(
    series.filter((point) => point.accountId === series[0]?.accountId),
    fallback,
  );
}

function mapCategoryBars(
  series: Array<{ date: string; categoryId: number; value: number }>,
  fallback: typeof groupedSpending,
) {
  if (series.length === 0) {
    return fallback;
  }

  const years = series
    .map((point) => parseIsoDate(point.date)?.getFullYear() ?? null)
    .filter((year): year is number => year !== null);
  const latestYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
  const previousYear = latestYear - 1;
  const groups = new Map<string, { month: string; currentYear: number; previousYear: number }>();

  for (const point of series) {
    const date = parseIsoDate(point.date);
    if (!date) {
      continue;
    }

    const month = date.toLocaleString("en-US", { month: "short" });
    const current = groups.get(month) ?? { month, currentYear: 0, previousYear: 0 };

    if (date.getFullYear() === latestYear) {
      current.currentYear += point.value;
    } else if (date.getFullYear() === previousYear) {
      current.previousYear += point.value;
    }

    groups.set(month, current);
  }

  const values = Array.from(groups.values());
  return values.length > 0 ? values : fallback;
}

export default async function AnalyticsPage() {
  const analytics = await getAnalyticsState();

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <span className="topbar__eyebrow">Analytics</span>
          <h2>Modules stay composable so new charts can be added without changing the ledger model.</h2>
          <p>
            The initial analytics suite focuses on total net worth, per-account history, and monthly
            category comparisons across years.
          </p>
        </div>
      </section>

      <div className="card-grid">
        <SectionCard title="Net worth timeline" description="Total money across all active accounts.">
          <LineChart series={mapTimeSeries(analytics.netWorthSeries, totalSeries)} />
        </SectionCard>
        <SectionCard title="Main bank timeline" description="Per-account line chart variant for the selected conto.">
          <LineChart series={mapAccountSeries(analytics.accountSeries, accountSeries)} />
        </SectionCard>
      </div>

      <SectionCard
        title="Expense seasonality by category"
        description="Selecting one category will show month-by-month comparison across years."
      >
        <GroupedBars groups={mapCategoryBars(analytics.categorySeries, groupedSpending)} />
      </SectionCard>
    </>
  );
}
