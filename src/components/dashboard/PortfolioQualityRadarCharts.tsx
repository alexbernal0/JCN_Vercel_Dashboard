"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import useSWR from "swr";

const FUNDAMENTALS_FETCHER = async (url: string, symbols: string[]) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) throw new Error("Failed to load fundamentals");
  return res.json();
};

/** Symbols to omit from radar charts (ETFs). Add more as needed. */
const ETF_SYMBOLS = new Set([
  "SPMO", "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "IVV", "VTV", "VUG", "VB", "VO",
]);

const RADAR_INDICATORS = [
  { name: "Value", max: 100 },
  { name: "Growth", max: 100 },
  { name: "Financial\nStrength", max: 100 },
  { name: "Quality", max: 100 },
  { name: "Momentum", max: 100 },
] as const;

function toNum(v: unknown): number {
  if (v != null && typeof v === "number" && Number.isFinite(v)) return v;
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface PortfolioQualityRadarChartsProps {
  symbols: string[];
}

export default function PortfolioQualityRadarCharts({
  symbols,
}: PortfolioQualityRadarChartsProps) {
  const symbolsStr = symbols.length > 0 ? [...symbols].sort().join(",") : null;
  const key = symbolsStr ? ["/api/portfolio/fundamentals", symbolsStr] : null;

  const { data, error, isLoading } = useSWR(
    key,
    ([url, _]: [string, string]) => FUNDAMENTALS_FETCHER(url, symbolsStr!.split(",")),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const rows = (data?.data ?? []) as Record<string, unknown>[];
  const apiError = data?.error ?? error?.message;

  const charts = useMemo(() => {
    return rows
      .filter((r) => r && String(r.symbol))
      .map((row) => {
        const symbol = String(row.symbol).toUpperCase();
        const value = toNum(row.value);
        const growth = toNum(row.growth);
        const financial_strength = toNum(row.financial_strength);
        const quality = toNum(row.quality);
        const momentum = toNum(row.momentum);
        const values = [value, growth, financial_strength, quality, momentum];
        return { symbol, values };
      })
      .filter(({ symbol }) => !ETF_SYMBOLS.has(symbol));
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Portfolio Quality Radar Charts
        </h3>
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Portfolio Quality Radar Charts
        </h3>
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{apiError}</p>
        </div>
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Portfolio Quality Radar Charts
        </h3>
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No score data. Add holdings and save.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
        Portfolio Quality Radar Charts
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Five scores per stock: Value, Growth, Financial Strength, Quality, Momentum (0–100).
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {charts.map(({ symbol, values }) => {
          const indicatorNames = RADAR_INDICATORS.map((i) => i.name.replace(/\n/g, " "));
          const tooltipFormatter = (params: unknown) => {
            const p = params as { value?: number[]; seriesName?: string };
            const v = p?.value ?? values;
            const count = v.filter((x) => x != null && Number.isFinite(x)).length || 1;
            const sum = v.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0);
            const composite = sum / count;
            const lines = [
              `<strong>Composite Score: ${composite.toFixed(1)}</strong>`,
              ...indicatorNames.map((n, i) => `${n}: ${(v[i] ?? 0).toFixed(1)}`),
            ];
            return lines.join("<br/>");
          };
          return (
            <div
              key={symbol}
              className="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-50">
                {symbol}
              </div>
              <div className="h-[220px] w-full min-w-0">
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: "item",
                      formatter: tooltipFormatter as (params: unknown) => string,
                      confine: true,
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      borderWidth: 1,
                      textStyle: {
                        color: "#111827",
                        fontSize: 12,
                      },
                    },
                    radar: {
                      indicator: RADAR_INDICATORS.map((i) => ({ name: i.name, max: i.max })),
                      shape: "polygon",
                      splitNumber: 4,
                      axisName: {
                        fontSize: 9,
                      },
                      splitArea: {
                        show: true,
                        areaStyle: {
                          opacity: 0.05,
                        },
                      },
                    },
                    series: [
                      {
                        type: "radar",
                        symbolSize: 3,
                        data: [
                          {
                            value: values,
                            name: symbol,
                            areaStyle: {
                              color: {
                                type: "radial",
                                x: 0.5,
                                y: 0.5,
                                r: 0.5,
                                colorStops: [
                                  { offset: 0, color: "rgba(45, 120, 110, 0.7)" },
                                  { offset: 1, color: "rgba(0, 200, 81, 0.5)" },
                                ],
                              },
                            },
                            lineStyle: {
                              color: "#4DB8A8",
                              width: 1.5,
                            },
                            itemStyle: {
                              color: "#4DB8A8",
                              borderWidth: 0,
                            },
                          },
                        ],
                      },
                    ],
                    grid: { containLabel: true },
                  }}
                  opts={{ renderer: "canvas" }}
                  style={{ height: "100%", width: "100%" }}
                  notMerge
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
