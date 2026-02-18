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

const SCORE_COLUMNS = [
  { key: "value", label: "Value" },
  { key: "growth", label: "Growth" },
  { key: "financial_strength", label: "Financial Strength" },
  { key: "quality", label: "Quality" },
  { key: "momentum", label: "Momentum" },
] as const;

function formatScore(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "number" && Number.isFinite(val)) return val.toFixed(2);
  if (typeof val === "string") return val;
  return String(val);
}

interface PortfolioFundamentalsTableProps {
  symbols: string[];
}

export default function PortfolioFundamentalsTable({ symbols }: PortfolioFundamentalsTableProps) {
  const symbolsStr = symbols.length > 0 ? [...symbols].sort().join(",") : null;
  const key = symbolsStr ? ["/api/portfolio/fundamentals", symbolsStr] : null;

  const { data, error, isLoading } = useSWR(
    key,
    ([url, _]: [string, string]) => FUNDAMENTALS_FETCHER(url, symbolsStr!.split(",")),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const rows = data?.data ?? [];
  const apiError = data?.error ?? error?.message;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Portfolio Fundamentals
        </h3>
      </div>

      <div className="overflow-x-auto">
        <Table className="compact-table">
          <TableHead>
            <TableRow className="text-xs">
              <TableHeaderCell className="py-1.5 px-2 text-left">
                <span className="text-xs">Ticker</span>
              </TableHeaderCell>
              {SCORE_COLUMNS.map(({ key: colKey, label }) => (
                <TableHeaderCell
                  key={colKey}
                  className="text-right py-1.5 px-2"
                >
                  <span className="text-xs">{label}</span>
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6">
                  <span className="text-gray-500 text-sm">Loading fundamentals…</span>
                </TableCell>
              </TableRow>
            ) : apiError ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-red-600 dark:text-red-400 text-sm">
                  {apiError}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-500 text-sm">
                  No symbols or no score data. Add holdings and save.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: Record<string, unknown>) => (
                <TableRow key={String(row.symbol)} className="text-xs">
                  <TableCell className="font-medium py-1.5 px-2 bg-white text-gray-900">
                    {String(row.symbol ?? "—")}
                  </TableCell>
                  {SCORE_COLUMNS.map(({ key: colKey }) => (
                    <TableCell
                      key={colKey}
                      className="text-right py-1.5 px-2 bg-white text-gray-900"
                    >
                      {formatScore(row[colKey])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && !apiError && rows.length > 0 && (
        <div className="text-xs text-gray-500 text-right dark:text-gray-400">
          Showing {rows.length} positions · Value, Growth, Financial Strength, Quality, Momentum
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
