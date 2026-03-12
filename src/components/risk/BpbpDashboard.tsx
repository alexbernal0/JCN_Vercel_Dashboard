"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import ReactECharts from "echarts-for-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BpbpData {
  indicator: {
    dates: string[]
    buying_power: (number | null)[]
    selling_pressure: (number | null)[]
    bpsp_ratio: (number | null)[]
    signal: number[]
    n_stocks: number[]
  }
  spy: {
    dates: string[]
    open: (number | null)[]
    high: (number | null)[]
    low: (number | null)[]
    close: (number | null)[]
  }
  backtest: {
    dates: string[]
    strat_equity: (number | null)[]
    spy_equity: (number | null)[]
    strat_drawdown: (number | null)[]
    spy_drawdown: (number | null)[]
    signal: number[]
  }
  metrics: {
    strategy: MetricsBlock
    benchmark: MetricsBlock
    time_in_market: number | null
    years: number
    weeks: number
    start_date: string
    end_date: string
  }
  latest: {
    date: string
    buying_power: number | null
    selling_pressure: number | null
    bpsp_ratio: number | null
    signal: number
    n_stocks: number
    spy_close: number | null
  }
  period: string
  compute_ms: number
}

interface MetricsBlock {
  total_return: number | null
  cagr: number | null
  volatility: number | null
  sharpe: number | null
  max_drawdown: number | null
  win_rate: number | null
  final_equity: number | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIODS = [
  { key: "1y", label: "1Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
  { key: "10y", label: "10Y" },
  { key: "all", label: "ALL" },
]

function fmt(v: number | null | undefined, pct = true, dec = 2): string {
  if (v == null) return "—"
  const s = pct ? (v >= 0 ? "+" : "") + v.toFixed(dec) + "%" : v.toFixed(dec)
  return s
}

function fmtDollar(v: number | null | undefined): string {
  if (v == null) return "—"
  return "$" + v.toFixed(2)
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return "text-gray-400"
  return v >= 0 ? "text-green-500" : "text-red-500"
}

// ---------------------------------------------------------------------------
// Chart option builders
// ---------------------------------------------------------------------------

const CHART_COMMON = {
  backgroundColor: "transparent",
  textStyle: { color: "#94a3b8", fontFamily: "monospace", fontSize: 11 },
  grid: { left: 60, right: 16, top: 32, bottom: 32, containLabel: false },
  tooltip: {
    trigger: "axis" as const,
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    textStyle: { color: "#e2e8f0", fontSize: 11 },
  },
}

function spyChartOption(data: BpbpData["spy"]) {
  return {
    ...CHART_COMMON,
    grid: { left: 64, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b", fontSize: 10, formatter: "${value}" },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: [
      {
        type: "line",
        data: data.close,
        lineStyle: { color: "#64748b", width: 1.5 },
        itemStyle: { color: "#64748b" },
        symbol: "none",
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(100,116,139,0.15)" },
              { offset: 1, color: "rgba(100,116,139,0)" },
            ],
          },
        },
      },
    ],
  }
}

function indicatorChartOption(data: BpbpData["indicator"]) {
  const bp = data.buying_power
  const sp = data.selling_pressure
  return {
    ...CHART_COMMON,
    grid: { left: 56, right: 16, top: 32, bottom: 32 },
    legend: {
      data: ["Bull Power (21-wk MA)", "Bear Pressure (21-wk MA)"],
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 10 },
    },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      min: 0.35,
      max: 0.65,
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (v: number) => v.toFixed(3),
      },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: [
      {
        name: "Bull Power (21-wk MA)",
        type: "line",
        data: bp,
        lineStyle: { color: "#22c55e", width: 2 },
        itemStyle: { color: "#22c55e" },
        symbol: "none",
        areaStyle: { color: "rgba(34,197,94,0.08)" },
      },
      {
        name: "Bear Pressure (21-wk MA)",
        type: "line",
        data: sp,
        lineStyle: { color: "#ef4444", width: 2 },
        itemStyle: { color: "#ef4444" },
        symbol: "none",
        areaStyle: { color: "rgba(239,68,68,0.08)" },
      },
      {
        name: "Neutral",
        type: "line",
        data: data.dates.map(() => 0.5),
        lineStyle: { color: "#475569", width: 1, type: "dashed" },
        symbol: "none",
        silent: true,
      },
    ],
    visualMap: {
      show: false,
      dimension: 0,
      pieces: bp.map((bpVal, i) => {
        const spVal = sp[i]
        if (bpVal == null || spVal == null)
          return { gte: i, lt: i + 1, color: "#475569" }
        return {
          gte: i,
          lt: i + 1,
          color: bpVal >= spVal ? "#22c55e" : "#ef4444",
        }
      }),
    },
  }
}

function equityChartOption(data: BpbpData["backtest"]) {
  return {
    ...CHART_COMMON,
    grid: { left: 64, right: 16, top: 32, bottom: 32 },
    legend: {
      data: ["BPBP Strategy", "SPY Benchmark"],
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 10 },
    },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: {
      type: "log",
      axisLabel: { color: "#64748b", fontSize: 10, formatter: "${value}" },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: [
      {
        name: "BPBP Strategy",
        type: "line",
        data: data.strat_equity,
        lineStyle: { color: "#22c55e", width: 2 },
        itemStyle: { color: "#22c55e" },
        symbol: "none",
      },
      {
        name: "SPY Benchmark",
        type: "line",
        data: data.spy_equity,
        lineStyle: { color: "#64748b", width: 1.5, type: "dotted" },
        itemStyle: { color: "#64748b" },
        symbol: "none",
      },
    ],
  }
}

function drawdownChartOption(data: BpbpData["backtest"]) {
  return {
    ...CHART_COMMON,
    grid: { left: 56, right: 16, top: 32, bottom: 32 },
    legend: {
      data: ["Strategy DD", "SPY DD"],
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 10 },
    },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b", fontSize: 10, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: [
      {
        name: "Strategy DD",
        type: "line",
        data: data.strat_drawdown,
        lineStyle: { color: "#22c55e", width: 1.5 },
        areaStyle: { color: "rgba(34,197,94,0.10)" },
        symbol: "none",
      },
      {
        name: "SPY DD",
        type: "line",
        data: data.spy_drawdown,
        lineStyle: { color: "#64748b", width: 1, type: "dotted" },
        areaStyle: { color: "rgba(100,116,139,0.08)" },
        symbol: "none",
      },
    ],
  }
}

function signalChartOption(data: BpbpData["backtest"]) {
  const inMarket = data.signal.map((s) => (s === 1 ? 1 : null))
  const inCash = data.signal.map((s) => (s === 0 ? 1 : null))
  return {
    ...CHART_COMMON,
    grid: { left: 40, right: 16, top: 28, bottom: 28 },
    legend: {
      data: ["In Market (BP > SP)", "In Cash (SP ≥ BP)"],
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 9 },
    },
    xAxis: {
      type: "category",
      data: data.dates,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: { type: "value", max: 1.05, show: false },
    series: [
      {
        name: "In Market (BP > SP)",
        type: "bar",
        stack: "signal",
        data: inMarket,
        itemStyle: { color: "rgba(34,197,94,0.5)" },
        barWidth: "90%",
      },
      {
        name: "In Cash (SP ≥ BP)",
        type: "bar",
        stack: "signal",
        data: inCash,
        itemStyle: { color: "rgba(239,68,68,0.35)" },
        barWidth: "90%",
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BpbpDashboard() {
  const [data, setData] = useState<BpbpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState("5y")

  const fetchData = useCallback(async (p: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bpbp?period=${p}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load BPBP data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [period, fetchData])

  // Memoize chart options
  const spyOpt = useMemo(() => (data ? spyChartOption(data.spy) : null), [data])
  const indOpt = useMemo(
    () => (data ? indicatorChartOption(data.indicator) : null),
    [data],
  )
  const eqOpt = useMemo(
    () => (data ? equityChartOption(data.backtest) : null),
    [data],
  )
  const ddOpt = useMemo(
    () => (data ? drawdownChartOption(data.backtest) : null),
    [data],
  )
  const sigOpt = useMemo(
    () => (data ? signalChartOption(data.backtest) : null),
    [data],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-green-500" />
          <p className="text-sm text-gray-400">Computing BPBP indicator...</p>
          <p className="mt-1 text-xs text-gray-500">
            Aggregating ~3,000 stocks weekly
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-sm font-medium text-red-400">BPBP Error</p>
        <p className="mt-1 text-xs text-red-300/70">{error}</p>
        <button
          onClick={() => fetchData(period)}
          className="mt-3 rounded bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const { latest, metrics } = data
  const isBull = latest.signal === 1
  const s = metrics.strategy
  const b = metrics.benchmark

  return (
    <div className="space-y-4">
      {/* Signal Banner */}
      <div
        className={`rounded-lg border p-4 ${isBull ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-bold ${isBull ? "text-green-500" : "text-red-500"}`}
            >
              {isBull ? "▲ BULL POWER" : "▼ BEAR PRESSURE"}
            </span>
            <span
              className={`text-sm font-medium ${isBull ? "text-green-400" : "text-red-400"}`}
            >
              {isBull ? "BULLISH SIGNAL" : "BEARISH SIGNAL"}
            </span>
          </div>
          <div className="flex gap-4 font-mono text-xs">
            <span className="text-gray-400">
              BP:{" "}
              <span className="text-green-400">
                {latest.buying_power?.toFixed(4) ?? "—"}
              </span>
            </span>
            <span className="text-gray-400">
              SP:{" "}
              <span className="text-red-400">
                {latest.selling_pressure?.toFixed(4) ?? "—"}
              </span>
            </span>
            <span className="text-gray-400">
              Ratio:{" "}
              <span className="text-blue-400">
                {latest.bpsp_ratio?.toFixed(4) ?? "—"}
              </span>
            </span>
            <span className="text-gray-400">
              SPY:{" "}
              <span className="text-white">
                ${latest.spy_close?.toLocaleString() ?? "—"}
              </span>
            </span>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          {latest.date} · {latest.n_stocks.toLocaleString()} stocks ·{" "}
          {data.compute_ms}ms
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              period === p.key
                ? "border border-blue-500/30 bg-blue-500/20 text-blue-400"
                : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* SPY Weekly */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <h3 className="mb-2 text-xs font-medium text-gray-400">
            SPY Weekly Close
          </h3>
          {spyOpt && (
            <ReactECharts option={spyOpt} style={{ height: 220 }} notMerge />
          )}
        </div>

        {/* BPBP Indicator */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <h3 className="mb-2 text-xs font-medium text-gray-400">
            Bull Power / Bear Pressure Indicator
          </h3>
          {indOpt && (
            <ReactECharts option={indOpt} style={{ height: 220 }} notMerge />
          )}
        </div>

        {/* Equity Curve */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <h3 className="mb-2 text-xs font-medium text-gray-400">
            Equity Curve ($100 start)
          </h3>
          {eqOpt && (
            <ReactECharts option={eqOpt} style={{ height: 220 }} notMerge />
          )}
        </div>

        {/* Drawdown */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <h3 className="mb-2 text-xs font-medium text-gray-400">Drawdown</h3>
          {ddOpt && (
            <ReactECharts option={ddOpt} style={{ height: 220 }} notMerge />
          )}
        </div>
      </div>

      {/* Signal Timeline */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
        <h3 className="mb-2 text-xs font-medium text-gray-400">
          Signal Timeline
        </h3>
        {sigOpt && (
          <ReactECharts option={sigOpt} style={{ height: 100 }} notMerge />
        )}
      </div>

      {/* Performance Table */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="mb-3 text-xs font-medium text-gray-400">
          Performance Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  Metric
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-green-500">
                  BPBP Strategy
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500">
                  SPY Benchmark
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">Total Return</td>
                <td
                  className={`px-3 py-1.5 text-right ${pctColor(s.total_return)}`}
                >
                  {fmt(s.total_return)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right ${pctColor(b.total_return)}`}
                >
                  {fmt(b.total_return)}
                </td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">CAGR</td>
                <td className={`px-3 py-1.5 text-right ${pctColor(s.cagr)}`}>
                  {fmt(s.cagr)}
                </td>
                <td className={`px-3 py-1.5 text-right ${pctColor(b.cagr)}`}>
                  {fmt(b.cagr)}
                </td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">Volatility</td>
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {fmt(s.volatility)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {fmt(b.volatility)}
                </td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">Sharpe Ratio</td>
                <td className="px-3 py-1.5 text-right text-blue-400">
                  {fmt(s.sharpe, false)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {fmt(b.sharpe, false)}
                </td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">Max Drawdown</td>
                <td className="px-3 py-1.5 text-right text-red-400">
                  {fmt(s.max_drawdown)}
                </td>
                <td className="px-3 py-1.5 text-right text-red-400">
                  {fmt(b.max_drawdown)}
                </td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">Win Rate (weeks)</td>
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {fmt(s.win_rate)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {fmt(b.win_rate)}
                </td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">
                  Final Equity ($100)
                </td>
                <td className="px-3 py-1.5 text-right text-white">
                  {fmtDollar(s.final_equity)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {fmtDollar(b.final_equity)}
                </td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="px-3 py-1.5 text-gray-400">Time in Market</td>
                <td className="px-3 py-1.5 text-right text-cyan-400">
                  {fmt(metrics.time_in_market)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-500">—</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 text-gray-400">Backtest Period</td>
                <td className="px-3 py-1.5 text-right text-gray-500">
                  {metrics.start_date} → {metrics.end_date}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-600">
                  {metrics.years}yr / {metrics.weeks}wk
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology Note */}
      <div className="px-1 text-[10px] text-gray-600">
        <p>
          BPBP = Bull Power / Bear Pressure. Volume-weighted breadth indicator
          computed from the full survivorship-bias-free universe (~3,000
          stocks). 21-week SMA applied. Strategy: hold SPY when BP {`>`} SP,
          cash otherwise. Signal lagged 1 week (no look-ahead).
        </p>
      </div>
    </div>
  )
}
