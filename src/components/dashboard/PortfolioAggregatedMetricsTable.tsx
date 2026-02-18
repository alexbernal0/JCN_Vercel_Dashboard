"use client";

import useSWR from "swr";
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@tremor/react";

const FUNDAMENTALS_FETCHER = async (url: string, symbols: string[]) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) throw new Error("Failed to load fundamentals");
  return res.json();
};

const SCORE_KEYS = [
  "value",
  "growth",
  "financial_strength",
  "quality",
  "momentum",
] as const;

const SCORE_LABELS: Record<(typeof SCORE_KEYS)[number], string> = {
  value: "Value",
  growth: "Growth",
  financial_strength: "Financial Strength",
  quality: "Quality",
  momentum: "Momentum",
};

const AGG_ROWS = [
  { key: "Max", label: "Max" },
  { key: "Median", label: "Median" },
  { key: "Average", label: "Average" },
  { key: "Min", label: "Min" },
] as const;

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function median(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeAggregates(
  rows: Record<string, unknown>[]
): Record<(typeof SCORE_KEYS)[number], { Max: number; Median: number; Average: number; Min: number }> {
  const out = {} as Record<
    (typeof SCORE_KEYS)[number],
    { Max: number; Median: number; Average: number; Min: number }
  >;
  for (const key of SCORE_KEYS) {
    const values = rows.map((r) => toNum(r[key])).filter((n): n is number => n !== null);
    if (values.length === 0) {
      out[key] = { Max: NaN, Median: NaN, Average: NaN, Min: NaN };
      continue;
    }
    const sum = values.reduce((a, b) => a + b, 0);
    out[key] = {
      Max: Math.max(...values),
      Median: median(values),
      Average: sum / values.length,
      Min: Math.min(...values),
    };
  }
  return out;
}

function formatCell(val: number): string {
  return Number.isFinite(val) ? val.toFixed(2) : "—";
}

interface PortfolioAggregatedMetricsTableProps {
  symbols: string[];
}

export default function PortfolioAggregatedMetricsTable({
  symbols,
}: PortfolioAggregatedMetricsTableProps) {
  const symbolsStr = symbols.length > 0 ? [...symbols].sort().join(",") : null;
  const key = symbolsStr ? ["/api/portfolio/fundamentals", symbolsStr] : null;

  const { data, error, isLoading } = useSWR(
    key,
    ([url, _]: [string, string]) => FUNDAMENTALS_FETCHER(url, symbolsStr!.split(",")),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const rows = data?.data ?? [];
  const apiError = data?.error ?? error?.message;
  const aggregates = rows.length > 0 ? computeAggregates(rows) : null;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Portfolio Aggregated Metrics
        </h3>
      </div>

      <div className="overflow-x-auto">
        <Table className="compact-table">
          <TableHead>
            <TableRow className="text-xs">
              <TableHeaderCell className="py-1.5 px-2 text-left w-24">
                <span className="text-xs">Stat</span>
              </TableHeaderCell>
              {SCORE_KEYS.map((colKey) => (
                <TableHeaderCell
                  key={colKey}
                  className="text-right py-1.5 px-2"
                >
                  <span className="text-xs">{SCORE_LABELS[colKey]}</span>
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6">
                  <span className="text-gray-500 text-sm">Loading…</span>
                </TableCell>
              </TableRow>
            ) : apiError ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-red-600 dark:text-red-400 text-sm">
                  {apiError}
                </TableCell>
              </TableRow>
            ) : !aggregates ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-500 text-sm">
                  No score data. Add holdings and save.
                </TableCell>
              </TableRow>
            ) : (
              AGG_ROWS.map(({ key: rowKey, label }) => (
                <TableRow key={rowKey} className="text-xs">
                  <TableCell className="font-medium py-1.5 px-2 bg-white text-gray-900">
                    {label}
                  </TableCell>
                  {SCORE_KEYS.map((colKey) => (
                    <TableCell
                      key={colKey}
                      className="text-right py-1.5 px-2 bg-white text-gray-900"
                    >
                      {formatCell(aggregates[colKey][rowKey])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && !apiError && aggregates && (
        <div className="text-xs text-gray-500 text-right dark:text-gray-400">
          Max, Median, Average, Min across {rows.length} positions
        </div>
      )}

      <style jsx global>{`
        .compact-table table {
          font-size: 0.75rem;
          line-height: 1rem;
        }
        .compact-table th,
        .compact-table td {
          padding-top: 0.25rem !important;
          padding-bottom: 0.25rem !important;
        }
      `}</style>
    </div>
  );
}
