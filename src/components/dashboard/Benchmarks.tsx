"use client";

import { Card } from "@tremor/react";
import { useState, useEffect } from "react";

interface BenchmarksData {
  portfolio_daily_change: number;
  benchmark_daily_change: number;
  daily_alpha: number;
  last_updated: string;
  benchmark_symbol: string;
  benchmark_date: string;
}

interface BenchmarksProps {
  holdings: Array<{
    symbol: string;
    cost_basis: number;
    shares: number;
  }>;
}

export default function Benchmarks({ holdings }: BenchmarksProps) {
  const [data, setData] = useState<BenchmarksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchBenchmarks = async () => {
    if (!holdings || holdings.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/benchmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ holdings }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      
      // Format last updated timestamp
      const date = new Date(result.last_updated);
      setLastUpdated(date.toLocaleString());
    } catch (err) {
      console.error("Error fetching benchmarks:", err);
      setError(err instanceof Error ? err.message : "Failed to load benchmarks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBenchmarks();
  }, [holdings]);

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const getPercentageColor = (value: number) => {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-600";
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
        </div>
        <div className="text-center py-8 text-gray-500">Loading benchmarks...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
        </div>
        <div className="text-center py-8 text-red-600">Error: {error}</div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
        </div>
        <div className="text-center py-8 text-gray-500">No benchmark data available</div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header with title */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
      </div>

      {/* Three metrics in a grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Portfolio Est. Daily % Change */}
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-2">
            Portfolio Est. Daily % Change
          </div>
          <div className={`text-3xl font-bold ${getPercentageColor(data.portfolio_daily_change)}`}>
            {formatPercentage(data.portfolio_daily_change)}
          </div>
        </div>

        {/* Benchmark Est. Daily % Change */}
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-2">
            Benchmark Est. Daily % Change
          </div>
          <div className={`text-3xl font-bold ${getPercentageColor(data.benchmark_daily_change)}`}>
            {formatPercentage(data.benchmark_daily_change)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.benchmark_symbol} ({data.benchmark_date})
          </div>
        </div>

        {/* Est. Daily Alpha */}
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-2">
            Est. Daily Alpha
          </div>
          <div className={`text-3xl font-bold ${getPercentageColor(data.daily_alpha)}`}>
            {formatPercentage(data.daily_alpha)}
          </div>
        </div>
      </div>

      {/* Last updated timestamp */}
      {lastUpdated && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Last updated: {lastUpdated}
        </div>
      )}
    </Card>
  );
}
