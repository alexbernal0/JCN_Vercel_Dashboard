'use client';

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import useSWR from 'swr';

interface WeeklyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TrendsApiResponse {
  data: Record<string, WeeklyBar[]>;
  start_date: string;
  end_date: string;
  symbols: string[];
  timestamp: string;
}

const TRENDS_FETCHER = async (url: string, symbols: string[]) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json?.detail === 'string' ? json.detail : json?.detail?.[0] ?? 'Failed to load trends data');
  }
  return json;
};

const ETF_SYMBOLS = new Set(['SPMO', 'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'IVV', 'VTV', 'VUG', 'VB', 'VO']);

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * x[i];
    ssTot += (y[i] - yMean) ** 2;
    ssRes += (y[i] - pred) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

function computeDrawdown(close: number[]): number[] {
  const out: number[] = [];
  let cummax = close[0];
  for (let i = 0; i < close.length; i++) {
    if (close[i] > cummax) cummax = close[i];
    out.push(cummax > 0 ? ((close[i] - cummax) / cummax) * 100 : 0);
  }
  return out;
}

export interface PortfolioTrendsChartsProps {
  symbols: string[];
}

export default function PortfolioTrendsCharts({ symbols }: PortfolioTrendsChartsProps) {
  const validSymbols = useMemo(
    () => Array.from(new Set(symbols.map((s) => s.replace(/\.US$/i, '').toUpperCase()).filter(Boolean))).filter((s) => !ETF_SYMBOLS.has(s)),
    [symbols]
  );

  const key = validSymbols.length > 0 ? ['/api/portfolio/trends-data', validSymbols.sort().join(',')] : null;
  const { data, error, isLoading } = useSWR<TrendsApiResponse>(
    key,
    ([url, _]: [string, string]) => TRENDS_FETCHER(url, key![1].split(',')),
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const gridItems = useMemo(() => {
    if (!data?.data || typeof data.data !== 'object') return [];
    const items: Array<{
      symbol: string;
      dates: string[];
      candlestickData: [number, number, number, number][];
      regressionLine: (string | number | null)[][];
      drawdown: number[];
      drawdownRange: [number, number];
      metrics: { systemScore: number; r2: number; cagr: number; avgAnnualRangePct: number; currentDdPct: number };
    }> = [];
    const sortedSymbols = Object.keys(data.data).filter((s) => !ETF_SYMBOLS.has(s)).sort();
    const last5YearsWeeks = 52 * 5;

    for (const symbol of sortedSymbols) {
      const rawBars = data.data[symbol];
      if (!Array.isArray(rawBars) || rawBars.length < 10) continue;
      // Normalize bars: ensure open/high/low/close are numbers (fallback to close if missing)
      const bars = rawBars.map((b: WeeklyBar) => {
        const c = Number(b?.close);
        const o = b?.open != null && Number.isFinite(Number(b.open)) ? Number(b.open) : c;
        const h = b?.high != null && Number.isFinite(Number(b.high)) ? Number(b.high) : Math.max(o, c);
        const l = b?.low != null && Number.isFinite(Number(b.low)) ? Number(b.low) : Math.min(o, c);
        return { date: String(b?.date ?? ''), open: o, high: h, low: l, close: c };
      });
      const close = bars.map((b) => b.close);
      const dates = bars.map((b) => b.date);
      const last5 = bars.slice(-Math.min(last5YearsWeeks, bars.length));
      const n5 = last5.length;
      const years5 = n5 / 52;
      const x = Array.from({ length: n5 }, (_, i) => i);
      const y = last5.map((b) => b.close);
      const { slope, intercept, r2 } = linearRegression(x, y);
      const startP = last5[0]?.close ?? 0;
      const endP = last5[n5 - 1]?.close ?? 0;
      const cagr = startP > 0 && years5 > 0 ? (endP / startP) ** (1 / years5) - 1 : 0;
      const systemScore = Number.isFinite(r2 * cagr) ? r2 * cagr : 0;

      const byYear: Record<number, { high: number; low: number }> = {};
      bars.forEach((b) => {
        const yyyy = parseInt(b.date.slice(0, 4), 10);
        if (Number.isNaN(yyyy)) return;
        if (!byYear[yyyy]) byYear[yyyy] = { high: b.high, low: b.low };
        else {
          if (b.high > byYear[yyyy].high) byYear[yyyy].high = b.high;
          if (b.low < byYear[yyyy].low) byYear[yyyy].low = b.low;
        }
      });
      const ranges = Object.values(byYear)
        .filter((r) => r.low > 0)
        .map((r) => ((r.high - r.low) / r.low) * 100);
      const avgAnnualRangePct = ranges.length > 0 ? ranges.reduce((a, b) => a + b, 0) / ranges.length : 0;

      const drawdown = computeDrawdown(close);
      const currentDdPct = drawdown[drawdown.length - 1] ?? 0;

      const candlestickData: [number, number, number, number][] = bars.map((b) => [b.open, b.close, b.low, b.high]);
      const regStartIdx = bars.length - n5;
      const regressionLine: (string | number | null)[][] = dates.map((d, i) =>
        i >= regStartIdx ? [d, intercept + slope * (i - regStartIdx)] : [d, null]
      );

      const ddMin = drawdown.length > 0 ? Math.min(...drawdown) : 0;
      const ddMax = 5;
      items.push({
        symbol,
        dates,
        candlestickData,
        regressionLine,
        drawdown,
        drawdownRange: [ddMin * 1.1, ddMax] as [number, number],
        metrics: {
          systemScore,
          r2,
          cagr,
          avgAnnualRangePct,
          currentDdPct,
        },
      });
    }
    return items;
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Portfolio Trends</h3>
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading trend charts…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Portfolio Trends</h3>
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
        </div>
      </div>
    );
  }

  if (gridItems.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Portfolio Trends</h3>
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">No trend data. Add stocks to your portfolio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Portfolio Trends</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gridItems.map((item) => (
          <div
            key={item.symbol}
            className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              {item.symbol} — SystemScore: {item.metrics.systemScore.toFixed(4)} | R²: {item.metrics.r2.toFixed(4)} |
              CAGR: {(item.metrics.cagr * 100).toFixed(2)}% | Avg range: {item.metrics.avgAnnualRangePct.toFixed(1)}% |
              DD: {item.metrics.currentDdPct.toFixed(1)}%
            </div>
            <div className="h-[220px] w-full">
              <ReactECharts
                option={{
                  animation: false,
                  grid: [
                    { left: 8, right: 8, top: 8, bottom: 36, height: '55%' },
                    { left: 8, right: 8, top: '58%', height: '38%' },
                  ],
                  xAxis: [
                    { type: 'category', data: item.dates, gridIndex: 0, show: false },
                    { type: 'category', data: item.dates, gridIndex: 1, axisLabel: { fontSize: 9 } },
                  ],
                  yAxis: [
                    { type: 'value', gridIndex: 0, scale: true, splitLine: { show: false }, axisLabel: { fontSize: 9 } },
                    {
                      type: 'value',
                      gridIndex: 1,
                      scale: true,
                      min: item.drawdownRange[0],
                      max: item.drawdownRange[1],
                      axisLabel: { fontSize: 9 },
                      splitLine: { show: false },
                    },
                  ],
                  series: [
                    {
                      type: 'candlestick',
                      data: item.candlestickData,
                      xAxisIndex: 0,
                      yAxisIndex: 0,
                      itemStyle: {
                        color: '#22c55e',
                        color0: '#ef4444',
                        borderColor: '#22c55e',
                        borderColor0: '#ef4444',
                      },
                    },
                    {
                      type: 'line',
                      data: item.regressionLine,
                      xAxisIndex: 0,
                      yAxisIndex: 0,
                      symbol: 'none',
                      connectNulls: false,
                      lineStyle: { color: '#3b82f6', width: 1.5 },
                    },
                    {
                      type: 'line',
                      data: item.dates.map((d, i) => [d, item.drawdown[i]]),
                      xAxisIndex: 1,
                      yAxisIndex: 1,
                      symbol: 'none',
                      lineStyle: { color: 'rgba(185,28,28,0.9)', width: 1 },
                      areaStyle: { color: 'rgba(185,28,28,0.15)' },
                    },
                  ],
                  tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    borderColor: '#e5e7eb',
                    textStyle: { color: '#111827' },
                  },
                }}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
