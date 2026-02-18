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
    const msg = typeof json?.detail === 'string' ? json.detail : 'Failed to load trends data';
    throw new Error(msg);
  }
  return json;
};

const ETF_SYMBOLS = new Set([
  'SPMO', 'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'IVV', 'VTV', 'VUG', 'VB', 'VO',
]);

function linearRegression(x: number[], y: number[]) {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxy += x[i] * y[i]; sx2 += x[i] * x[i]; }
  const denom = n * sx2 - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  const yMean = sy / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) { ssTot += (y[i] - yMean) ** 2; ssRes += (y[i] - (intercept + slope * x[i])) ** 2; }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

function computeDrawdown(close: number[]): number[] {
  const out: number[] = [];
  let peak = close[0] ?? 0;
  for (const c of close) {
    if (c > peak) peak = c;
    out.push(peak > 0 ? ((c - peak) / peak) * 100 : 0);
  }
  return out;
}

interface GridItem {
  symbol: string;
  dates: string[];
  candlestick: [number, number, number, number][];
  regLine: (number | null)[];
  drawdown: number[];
  ddRange: [number, number];
  metrics: { sys: number; r2: number; cagr: number; avgRange: number; curDD: number };
}

export interface PortfolioTrendsChartsProps {
  symbols: string[];
}

export default function PortfolioTrendsCharts({ symbols }: PortfolioTrendsChartsProps) {
  const validSymbols = useMemo(
    () => Array.from(new Set(symbols.map((s) => s.replace(/\.US$/i, '').toUpperCase()).filter(Boolean))).filter((s) => !ETF_SYMBOLS.has(s)),
    [symbols],
  );

  const keyStr = validSymbols.length > 0 ? validSymbols.sort().join(',') : null;
  const { data, error, isLoading } = useSWR<TrendsApiResponse>(
    keyStr ? ['/api/portfolio/trends-data', keyStr] : null,
    ([url, syms]: [string, string]) => TRENDS_FETCHER(url, syms.split(',')),
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const gridItems: GridItem[] = useMemo(() => {
    try {
      if (!data?.data || typeof data.data !== 'object') return [];
      const items: GridItem[] = [];
      const sorted = Object.keys(data.data).filter((s) => !ETF_SYMBOLS.has(s)).sort();
      const WEEKS_5Y = 52 * 5;

      for (const symbol of sorted) {
        const raw = data.data[symbol];
        if (!Array.isArray(raw) || raw.length < 10) continue;

        const bars = raw.map((b) => {
          const c = Number(b?.close) || 0;
          const o = Number.isFinite(Number(b?.open)) ? Number(b.open) : c;
          const h = Number.isFinite(Number(b?.high)) ? Number(b.high) : Math.max(o, c);
          const l = Number.isFinite(Number(b?.low)) ? Number(b.low) : Math.min(o, c);
          return { date: String(b?.date ?? ''), open: o, high: h, low: l, close: c };
        });

        const close = bars.map((b) => b.close);
        const dates = bars.map((b) => b.date);
        const tail = bars.slice(-Math.min(WEEKS_5Y, bars.length));
        const n5 = tail.length;
        const yrs = n5 / 52;
        const x = Array.from({ length: n5 }, (_, i) => i);
        const y = tail.map((b) => b.close);
        const { slope, intercept, r2 } = linearRegression(x, y);
        const sp = tail[0]?.close ?? 0;
        const ep = tail[n5 - 1]?.close ?? 0;
        const cagr = sp > 0 && yrs > 0 ? (ep / sp) ** (1 / yrs) - 1 : 0;
        const sys = Number.isFinite(r2 * cagr) ? r2 * cagr : 0;

        const byYear: Record<number, { h: number; l: number }> = {};
        for (const b of bars) {
          const yr = parseInt(b.date.slice(0, 4), 10);
          if (Number.isNaN(yr)) continue;
          if (!byYear[yr]) byYear[yr] = { h: b.high, l: b.low };
          else { if (b.high > byYear[yr].h) byYear[yr].h = b.high; if (b.low < byYear[yr].l) byYear[yr].l = b.low; }
        }
        const ranges = Object.values(byYear).filter((r) => r.l > 0).map((r) => ((r.h - r.l) / r.l) * 100);
        const avgRange = ranges.length > 0 ? ranges.reduce((a, b) => a + b, 0) / ranges.length : 0;

        const drawdown = computeDrawdown(close);
        const curDD = drawdown[drawdown.length - 1] ?? 0;

        const candlestick: [number, number, number, number][] = bars.map((b) => [b.open, b.close, b.low, b.high]);
        const regStartIdx = bars.length - n5;
        const regLine: (number | null)[] = dates.map((_, i) =>
          i >= regStartIdx ? intercept + slope * (i - regStartIdx) : null,
        );

        const ddMin = drawdown.length > 0 ? Math.min(...drawdown) : 0;
        items.push({
          symbol, dates, candlestick, regLine, drawdown,
          ddRange: [ddMin * 1.1, 5] as [number, number],
          metrics: { sys, r2, cagr, avgRange, curDD },
        });
      }
      return items;
    } catch {
      return [];
    }
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
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-900/20">
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
          <p className="text-sm text-gray-500 dark:text-gray-400">No trend data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Portfolio Trends</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gridItems.map((item) => (
          <div key={item.symbol} className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              {item.symbol} — Sys: {item.metrics.sys.toFixed(4)} | R²: {item.metrics.r2.toFixed(4)} |
              CAGR: {(item.metrics.cagr * 100).toFixed(2)}% | Range: {item.metrics.avgRange.toFixed(1)}% |
              DD: {item.metrics.curDD.toFixed(1)}%
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
                    { type: 'value', gridIndex: 1, min: item.ddRange[0], max: item.ddRange[1], splitLine: { show: false }, axisLabel: { fontSize: 9 } },
                  ],
                  series: [
                    {
                      type: 'candlestick', data: item.candlestick, xAxisIndex: 0, yAxisIndex: 0,
                      itemStyle: { color: '#22c55e', color0: '#ef4444', borderColor: '#22c55e', borderColor0: '#ef4444' },
                    },
                    {
                      type: 'line', data: item.regLine, xAxisIndex: 0, yAxisIndex: 0,
                      symbol: 'none', connectNulls: false, lineStyle: { color: '#3b82f6', width: 1.5 },
                    },
                    {
                      type: 'line', data: item.drawdown, xAxisIndex: 1, yAxisIndex: 1,
                      symbol: 'none', lineStyle: { color: 'rgba(185,28,28,0.9)', width: 1 },
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
