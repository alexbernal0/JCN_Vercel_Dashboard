'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import ReactECharts from 'echarts-for-react';

interface PriceData {
  date: string;
  close: number;
}

interface StockPricesData {
  data: Record<string, PriceData[]>;
  start_date: string;
  end_date: string;
  symbols: string[];
  timestamp: string;
}

interface StockPriceComparisonProps {
  symbols: string[];
}

const fetcher = async (url: string, symbols: string[]) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch stock prices');
  }
  
  return response.json();
};

// One canonical symbol per stock (strip .US if present) so we never duplicate series
function canonicalSymbol(s: string) {
  return s.replace(/\.US$/i, '').toUpperCase() || s;
}

export default function StockPriceComparison({ symbols }: StockPriceComparisonProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('6 Months');

  // One line per stock: request each symbol only once
  const uniqueSymbols = useMemo(
    () => Array.from(new Set(symbols.map(canonicalSymbol).filter(Boolean))),
    [symbols]
  );
  
  const { data, error, isLoading} = useSWR<StockPricesData>(
    uniqueSymbols.length > 0 ? ['/api/stock/prices', uniqueSymbols] : null,
    ([url, syms]: [string, string[]]) => fetcher(url, syms),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3600000, // 1 hour
    }
  );

  // Time period options
  const timePeriods = [
    { label: '1 Month', months: 1 },
    { label: '3 Months', months: 3 },
    { label: '6 Months', months: 6 },
    { label: '1 Year', months: 12 },
    { label: '5 Years', months: 60 },
    { label: '10 Years', months: 120 },
    { label: '20 Years', months: 240 },
  ];

  // One line per stock: canonicalize keys and keep only one series per symbol
  const chartData = useMemo(() => {
    if (!data || !data.data) return null;

    const period = timePeriods.find(p => p.label === selectedPeriod);
    if (!period) return null;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - period.months);

    const normalized: Record<string, { date: string; value: number }[]> = {};
    
    for (const [symbol, prices] of Object.entries(data.data)) {
      const key = canonicalSymbol(symbol);
      if (!key || normalized[key]) continue; // one series per stock: first wins

      const arr = Array.isArray(prices) ? prices : [];
      const filteredPrices = arr.filter(p => p && new Date(p.date) >= cutoffDate);
      if (filteredPrices.length === 0) continue;

      const firstPrice = filteredPrices[0].close;
      if (firstPrice == null || firstPrice === 0) continue;

      normalized[key] = filteredPrices.map(p => ({
        date: p.date,
        value: (p.close / firstPrice - 1) * 100,
      }));
    }

    return normalized;
  }, [data, selectedPeriod]);

  // Prepare ECharts option — exactly one series per stock
  const chartOption = useMemo(() => {
    if (!chartData) return null;

    const seriesSymbols = Array.from(new Set(Object.keys(chartData)));
    if (seriesSymbols.length === 0) return null;

    // One line per stock
    const series = seriesSymbols.map(symbol => ({
      name: symbol,
      type: 'line',
      smooth: false,
      symbol: 'none',
      lineStyle: {
        width: 2,
      },
      emphasis: {
        focus: 'series',
      },
      data: chartData[symbol].map(p => [p.date, Math.round(p.value * 100) / 100]),
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params : [];
          if (p.length === 0) return '';
          const first = p[0] as { axisValue: string; value?: number | [string, number] };
          const lines = [first.axisValue ?? ''];
          const seen = new Set<string>();
          (p as { seriesName: string; value?: number | [string, number] }[]).forEach((item) => {
            if (seen.has(item.seriesName)) return; // one line per series to avoid duplicate text
            seen.add(item.seriesName);
            const raw = item.value;
            const v = Array.isArray(raw) ? raw[1] : Number(raw);
            const str = Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : String(raw);
            lines.push(`${item.seriesName}: ${str}`);
          });
          return lines.join('<br/>');
        },
      },
      legend: {
        data: seriesSymbols,
        right: 10,
        top: 10,
        orient: 'vertical',
        textStyle: {
          fontSize: 12,
        },
      },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '10%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          formatter: '{MMM} {yyyy}',
        },
      },
      yAxis: {
        type: 'value',
        name: 'Return %',
        axisLabel: {
          formatter: (value: number) => (value >= 0 ? '+' : '') + value.toFixed(2) + '%',
        },
      },
      series,
      animation: true,
      animationDuration: 1000,
    };
  }, [chartData]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">Failed to load stock price data. Please try refreshing.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading historical price data...</p>
            <p className="text-sm text-gray-500 mt-2">Fetching up to 20 years of data</p>
          </div>
        </div>
      </div>
    );
  }

  if (!chartOption) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">No price data available for the selected period.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Chart Title */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          📊 Normalized Stock Price Comparison - {selectedPeriod}
        </h3>
        {data && (
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="mb-6">
        <ReactECharts
          option={chartOption}
          style={{ height: '600px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Time Horizon Buttons: clicking isolates the chart to that period only */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Time horizon</h4>
        <p className="text-xs text-gray-500 mb-3">Click a button to show only that period; Y-axis is return vs. period start (00.00%).</p>
        <div className="grid grid-cols-7 gap-2">
          {timePeriods.map(period => (
            <button
              key={period.label}
              onClick={() => setSelectedPeriod(period.label)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPeriod === period.label
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
