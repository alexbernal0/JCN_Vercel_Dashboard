"use client"

import { Card } from "@tremor/react"
import useSWR from "swr"

interface BenchmarksData {
  portfolio_daily_change: number
  benchmark_daily_change: number
  daily_alpha: number
  last_updated: string
  benchmark_symbol: string
  benchmark_date: string
}

interface BenchmarksProps {
  holdings: Array<{
    symbol: string
    cost_basis: number
    shares: number
  }>
}

// Custom fetcher for POST requests with body
const benchmarksFetcher = async ([url, holdings]: [string, any[]]) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ holdings }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

// Stable key so SWR doesn't refetch on every parent re-render (holdings array ref changes)
function benchmarksKey(holdings: BenchmarksProps["holdings"]) {
  if (!holdings?.length) return null
  const symbols = holdings
    .map((h) => h.symbol)
    .sort()
    .join(",")
  return ["/api/benchmarks?force_refresh=false", symbols] as const
}

export default function Benchmarks({ holdings }: BenchmarksProps) {
  const key = benchmarksKey(holdings)
  const { data, error, isLoading } = useSWR<BenchmarksData>(
    key,
    key ? ([url]) => benchmarksFetcher([url, holdings!]) : null,
    {
      revalidateOnMount: true,
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  const lastUpdated = data?.last_updated
    ? new Date(data.last_updated).toLocaleString()
    : ""

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}%`
  }

  const getPercentageColor = (value: number) => {
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return "text-gray-600"
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
        </div>
        <div className="py-8 text-center text-gray-500">
          Loading benchmarks...
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
        </div>
        <div className="py-8 text-center text-gray-600">
          {!holdings || holdings.length === 0 ? (
            <div>
              <p className="mb-2">No portfolio holdings available.</p>
              <p className="text-sm">
                Please add holdings in the Portfolio Input section below.
              </p>
            </div>
          ) : (
            <div className="text-red-600">Error: {error.message}</div>
          )}
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
        </div>
        <div className="py-8 text-center text-gray-500">
          No benchmark data available
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      {/* Header with title */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">📊 Benchmarks</h2>
      </div>

      {/* Three metrics in a grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {/* Portfolio Est. Daily % Change */}
        <div className="text-center">
          <div className="mb-2 text-sm text-gray-600">
            Portfolio Est. Daily % Change
          </div>
          <div
            className={`text-3xl font-bold ${getPercentageColor(data.portfolio_daily_change)}`}
          >
            {formatPercentage(data.portfolio_daily_change)}
          </div>
        </div>

        {/* Benchmark Est. Daily % Change */}
        <div className="text-center">
          <div className="mb-2 text-sm text-gray-600">
            Benchmark Est. Daily % Change
          </div>
          <div
            className={`text-3xl font-bold ${getPercentageColor(data.benchmark_daily_change)}`}
          >
            {formatPercentage(data.benchmark_daily_change)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {data.benchmark_symbol} ({data.benchmark_date})
          </div>
        </div>

        {/* Est. Daily Alpha */}
        <div className="text-center">
          <div className="mb-2 text-sm text-gray-600">Est. Daily Alpha</div>
          <div
            className={`text-3xl font-bold ${getPercentageColor(data.daily_alpha)}`}
          >
            {formatPercentage(data.daily_alpha)}
          </div>
        </div>
      </div>

      {/* Last updated timestamp */}
      {lastUpdated && (
        <div className="mt-4 text-center text-xs text-gray-500">
          Last updated: {lastUpdated}
        </div>
      )}
    </Card>
  )
}
