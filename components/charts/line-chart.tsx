import { useId } from "react";
import type { CSSProperties } from "react";
import { formatEuroCurrency } from "@/lib/format/currency";

type Point = {
  label: string;
  value: number;
};

type LineChartProps = {
  series: Point[];
  currency?: string;
};

interface ChartMetrics {
  domainMin: number;
  domainMax: number;
  plotBottom: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  ticks: number[];
}

function getNiceStep(range: number, targetTickCount: number) {
  if (range <= 0) {
    return 1;
  }

  const roughStep = range / Math.max(targetTickCount - 1, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }

  if (normalized <= 2) {
    return 2 * magnitude;
  }

  if (normalized <= 2.5) {
    return 2.5 * magnitude;
  }

  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

function getChartMetrics(series: Point[], width: number, height: number): ChartMetrics {
  const plotLeft = 92;
  const plotRight = width - 18;
  const plotTop = 18;
  const plotBottom = height - 22;

  if (series.length === 0) {
    return {
      domainMin: 0,
      domainMax: 1,
      plotBottom,
      plotLeft,
      plotRight,
      plotTop,
      ticks: [1, 0],
    };
  }

  const values = series.map((point) => point.value);
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);

  if (minValue === maxValue) {
    const fallbackPadding = Math.max(Math.abs(minValue) * 0.1, 1);
    minValue -= fallbackPadding;
    maxValue += fallbackPadding;
  }

  const step = getNiceStep(maxValue - minValue, 4);
  const domainMin = Math.floor(minValue / step) * step;
  const domainMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];

  for (let current = domainMax; current >= domainMin; current -= step) {
    ticks.push(Number(current.toFixed(6)));
  }

  if (ticks[ticks.length - 1] !== domainMin) {
    ticks.push(domainMin);
  }

  return {
    domainMin,
    domainMax,
    plotBottom,
    plotLeft,
    plotRight,
    plotTop,
    ticks,
  };
}

function getX(index: number, seriesLength: number, metrics: ChartMetrics) {
  return (
    metrics.plotLeft +
    (index / Math.max(seriesLength - 1, 1)) * (metrics.plotRight - metrics.plotLeft)
  );
}

function getY(value: number, metrics: ChartMetrics) {
  const span = metrics.domainMax - metrics.domainMin || 1;

  return (
    metrics.plotBottom -
    ((value - metrics.domainMin) / span) * (metrics.plotBottom - metrics.plotTop)
  );
}

function getPath(series: Point[], metrics: ChartMetrics) {
  if (series.length === 0) {
    return "";
  }

  return series
    .map((point, index) => {
      const x = getX(index, series.length, metrics);
      const y = getY(point.value, metrics);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function getAreaPath(series: Point[], metrics: ChartMetrics) {
  const linePath = getPath(series, metrics);
  if (!linePath) {
    return "";
  }

  const lastX = getX(Math.max(series.length - 1, 0), series.length, metrics);
  return `${linePath} L ${lastX.toFixed(1)} ${metrics.plotBottom.toFixed(1)} L ${metrics.plotLeft.toFixed(1)} ${metrics.plotBottom.toFixed(1)} Z`;
}

function getPoints(series: Point[], metrics: ChartMetrics) {
  if (series.length === 0) {
    return [];
  }

  return series.map((point, index) => ({
    key: `${point.label}-${index}`,
    x: getX(index, series.length, metrics),
    y: getY(point.value, metrics),
  }));
}

export function LineChart({ series, currency = "EUR" }: LineChartProps) {
  const gradientId = `chart-gradient-${useId().replace(/:/g, "")}`;
  const width = 620;
  const height = 280;
  const metrics = getChartMetrics(series, width, height);
  const path = getPath(series, metrics);
  const areaPath = getAreaPath(series, metrics);
  const points = getPoints(series, metrics);
  const chartStyle = {
    "--chart-label-padding-left": `${(metrics.plotLeft / width) * 100}%`,
    "--chart-label-padding-right": `${((width - metrics.plotRight) / width) * 100}%`,
  } as CSSProperties;

  return (
    <div className="chart" style={chartStyle}>
      <svg
        aria-label={`Line chart in ${currency}`}
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(224, 160, 74, 0.32)" />
            <stop offset="100%" stopColor="rgba(224, 160, 74, 0.02)" />
          </linearGradient>
        </defs>
        <line
          className="chart__axis-line"
          x1={metrics.plotLeft}
          x2={metrics.plotLeft}
          y1={metrics.plotTop}
          y2={metrics.plotBottom}
        />
        {metrics.ticks.map((tick) => {
          const y = getY(tick, metrics);
          const isBottomTick = Math.abs(tick - metrics.domainMin) < 0.000001;

          return (
            <g key={tick}>
              <line
                className={`chart__grid${isBottomTick ? "" : " chart__grid--soft"}`}
                x1={metrics.plotLeft}
                x2={metrics.plotRight}
                y1={y}
                y2={y}
              />
              <text
                className="chart__axis-label chart__axis-label--y"
                textAnchor="end"
                x={metrics.plotLeft - 10}
                y={y}
              >
                {formatEuroCurrency(tick)}
              </text>
            </g>
          );
        })}
        <path className="chart__area" d={areaPath} fill={`url(#${gradientId})`} />
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
