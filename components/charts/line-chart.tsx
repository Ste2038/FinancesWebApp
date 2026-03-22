type Point = {
  label: string;
  value: number;
};

type LineChartProps = {
  series: Point[];
  currency?: string;
};

function getPath(series: Point[], width: number, height: number, padding: number) {
  if (series.length === 0) {
    return "";
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return series
    .map((point, index) => {
      const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function getAreaPath(series: Point[], width: number, height: number, padding: number) {
  const linePath = getPath(series, width, height, padding);
  if (!linePath) {
    return "";
  }

  const lastX = padding + (Math.max(series.length - 1, 0) / Math.max(series.length - 1, 1)) * (width - padding * 2);
  return `${linePath} L ${lastX.toFixed(1)} ${(height - padding).toFixed(1)} L ${padding} ${(height - padding).toFixed(1)} Z`;
}

function getPoints(series: Point[], width: number, height: number, padding: number) {
  if (series.length === 0) {
    return [];
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return series.map((point, index) => ({
    key: `${point.label}-${index}`,
    x: padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2),
    y: height - padding - ((point.value - min) / span) * (height - padding * 2),
  }));
}

export function LineChart({ series, currency = "EUR" }: LineChartProps) {
  const width = 620;
  const height = 280;
  const padding = 22;
  const path = getPath(series, width, height, padding);
  const areaPath = getAreaPath(series, width, height, padding);
  const points = getPoints(series, width, height, padding);

  return (
    <div className="chart">
      <svg
        aria-label={`Line chart in ${currency}`}
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
      >
        <defs>
          <linearGradient id="line-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(224, 160, 74, 0.32)" />
            <stop offset="100%" stopColor="rgba(224, 160, 74, 0.02)" />
          </linearGradient>
        </defs>
        <path className="chart__grid" d={`M ${padding} ${height - padding} H ${width - padding}`} />
        <path className="chart__grid chart__grid--soft" d={`M ${padding} ${padding} H ${width - padding}`} />
        <path className="chart__area" d={areaPath} />
        <path className="chart__line" d={path} />
        {points.map((point) => (
          <circle className="chart__point" cx={point.x} cy={point.y} key={point.key} r="4.5" />
        ))}
      </svg>
      <div className="chart__labels">
        {series.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}
