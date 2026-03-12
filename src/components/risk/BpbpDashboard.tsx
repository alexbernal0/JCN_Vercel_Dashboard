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
    spx_close: number | null
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
// Constants & Helpers
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
  return pct ? (v >= 0 ? "+" : "") + v.toFixed(dec) + "%" : v.toFixed(dec)
}

function fmtDollar(v: number | null | undefined): string {
  if (v == null) return "—"
  return "$" + v.toFixed(2)
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return "text-gray-400"
  return v >= 0 ? "text-green-600" : "text-red-600"
}

// ---------------------------------------------------------------------------
// Shared white-theme chart pieces
// ---------------------------------------------------------------------------

const WHITE_TOOLTIP = {
  trigger: "axis" as const,
  backgroundColor: "#ffffff",
  borderColor: "#e5e7eb",
  borderWidth: 1,
  textStyle: { color: "#374151", fontSize: 11, fontFamily: "monospace" },
  axisPointer: { lineStyle: { color: "#9ca3af" } },
}

function whiteXAxis(dates: string[]) {
  return {
    type: "category" as const,
    data: dates,
    axisLine: { lineStyle: { color: "#9ca3af" } },
    axisTick: { lineStyle: { color: "#9ca3af" } },
    axisLabel: { color: "#374151", fontSize: 10 },
    splitLine: { show: false },
  }
}

const WHITE_SPLITLINE = {
  lineStyle: { color: "#e5e7eb", type: "dashed" as const },
}

// ---------------------------------------------------------------------------
// Chart option builders
// ---------------------------------------------------------------------------

function spxCandlestickOption(spy: BpbpData["spy"]) {
  // ECharts candlestick format per point: [open, close, low, high]
  const candleData = spy.dates.map((_, i) => [
    spy.open[i] ?? 0,
    spy.close[i] ?? 0,
    spy.low[i] ?? 0,
    spy.high[i] ?? 0,
  ])
  return {
    backgroundColor: "#ffffff",
    tooltip: WHITE_TOOLTIP,
    grid: { left: 72, right: 20, top: 12, bottom: 36 },
    xAxis: whiteXAxis(spy.dates),
    yAxis: {
      type: "value" as const,
      axisLabel: {
        color: "#374151",
        fontSize: 10,
        formatter: (v: number) => `$${v.toLocaleString()}`,
      },
      axisLine: { lineStyle: { color: "#9ca3af" } },
      splitLine: WHITE_SPLITLINE,
    },
    series: [
      {
        type: "candlestick",
        data: candleData,
        itemStyle: {
          color: "#16a34a",
          color0: "#dc2626",
          borderColor: "#16a34a",
          borderColor0: "#dc2626",
        },
        barMaxWidth: 8,
      },
    ],
  }
}

function indicatorChartOption(ind: BpbpData["indicator"]) {
  const bp = ind.buying_power
  const sp = ind.selling_pressure
  const n = ind.dates.length

  // Fill-between: base fills 0→min(BP,SP) in white; green fills Δ when BP≥SP; red fills Δ when SP>BP
  const baseData: (number | null)[] = []
  const greenBand: (number | null)[] = []
  const redBand: (number | null)[] = []

  for (let i = 0; i < n; i++) {
    const bv = bp[i]
    const sv = sp[i]
    if (bv == null || sv == null) {
      baseData.push(null)
      greenBand.push(null)
      redBand.push(null)
    } else {
      baseData.push(Math.min(bv, sv))
      greenBand.push(bv >= sv ? bv - sv : 0)
      redBand.push(bv < sv ? sv - bv : 0)
    }
  }

  return {
    backgroundColor: "#ffffff",
    tooltip: WHITE_TOOLTIP,
    legend: {
      data: ["Buying Power (21-wk MA)", "Selling Pressure (21-wk MA)"],
      top: 4,
      left: "left" as const,
      textStyle: { color: "#374151", fontSize: 10 },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: { left: 60, right: 20, top: 36, bottom: 36 },
    xAxis: whiteXAxis(ind.dates),
    yAxis: {
      type: "value" as const,
      min: 0.35,
      max: 0.65,
      axisLabel: {
        color: "#374151",
        fontSize: 10,
        formatter: (v: number) => v.toFixed(3),
      },
      axisLine: { lineStyle: { color: "#9ca3af" } },
      splitLine: WHITE_SPLITLINE,
    },
    series: [
      // Invisible base — pushes green/red fills up from min(BP,SP)
      {
        type: "line" as const,
        data: baseData,
        stack: "fillBand",
        symbol: "none",
        lineStyle: { width: 0, opacity: 0 },
        areaStyle: { color: "#ffffff" },
        silent: true,
        tooltip: { show: false },
      },
      // Green fill where BP ≥ SP
      {
        type: "line" as const,
        data: greenBand,
        stack: "fillBand",
        symbol: "none",
        lineStyle: { width: 0, opacity: 0 },
        areaStyle: { color: "rgba(22,163,74,0.25)" },
        silent: true,
        tooltip: { show: false },
      },
      // Red fill where SP > BP
      {
        type: "line" as const,
        data: redBand,
        stack: "fillBand",
        symbol: "none",
        lineStyle: { width: 0, opacity: 0 },
        areaStyle: { color: "rgba(220,38,38,0.25)" },
        silent: true,
        tooltip: { show: false },
      },
      // Buying Power line (visible)
      {
        name: "Buying Power (21-wk MA)",
        type: "line" as const,
        data: bp,
        lineStyle: { color: "#16a34a", width: 2.5 },
        itemStyle: { color: "#16a34a" },
        symbol: "none",
      },
      // Selling Pressure line (visible)
      {
        name: "Selling Pressure (21-wk MA)",
        type: "line" as const,
        data: sp,
        lineStyle: { color: "#dc2626", width: 2.5 },
        itemStyle: { color: "#dc2626" },
        symbol: "none",
      },
      // Neutral 0.5 dashed line
      {
        type: "line" as const,
        data: ind.dates.map(() => 0.5),
        lineStyle: { color: "#9ca3af", width: 1.2, type: "dashed" as const },
        symbol: "none",
        silent: true,
        tooltip: { show: false },
      },
    ],
  }
}

function equityChartOption(bt: BpbpData["backtest"]) {
  return {
    backgroundColor: "#ffffff",
    tooltip: WHITE_TOOLTIP,
    legend: {
      data: ["SPX Benchmark", "BPSP Strategy"],
      top: 4,
      right: 20,
      textStyle: { color: "#374151", fontSize: 10 },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: { left: 72, right: 20, top: 36, bottom: 36 },
    xAxis: whiteXAxis(bt.dates),
    yAxis: {
      type: "log" as const,
      axisLabel: {
        color: "#374151",
        fontSize: 10,
        formatter: (v: number) => `$${v}`,
      },
      axisLine: { lineStyle: { color: "#9ca3af" } },
      splitLine: WHITE_SPLITLINE,
    },
    series: [
      {
        name: "SPX Benchmark",
        type: "line" as const,
        data: bt.spy_equity,
        lineStyle: { color: "#2563eb", width: 2 },
        itemStyle: { color: "#2563eb" },
        symbol: "none",
      },
      {
        name: "BPSP Strategy",
        type: "line" as const,
        data: bt.strat_equity,
        lineStyle: { color: "#16a34a", width: 2.5 },
        itemStyle: { color: "#16a34a" },
        symbol: "none",
      },
    ],
  }
}

function drawdownChartOption(bt: BpbpData["backtest"]) {
  return {
    backgroundColor: "#ffffff",
    tooltip: WHITE_TOOLTIP,
    legend: {
      data: ["SPX Drawdown", "Strategy Drawdown"],
      top: 4,
      left: "left" as const,
      textStyle: { color: "#374151", fontSize: 10 },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: { left: 60, right: 20, top: 36, bottom: 36 },
    xAxis: whiteXAxis(bt.dates),
    yAxis: {
      type: "value" as const,
      axisLabel: {
        color: "#374151",
        fontSize: 10,
        formatter: (v: number) => `${v}%`,
      },
      axisLine: { lineStyle: { color: "#9ca3af" } },
      splitLine: WHITE_SPLITLINE,
    },
    series: [
      {
        name: "SPX Drawdown",
        type: "line" as const,
        data: bt.spy_drawdown,
        lineStyle: { color: "#2563eb", width: 1.5 },
        itemStyle: { color: "#2563eb" },
        symbol: "none",
        areaStyle: { color: "rgba(37,99,235,0.3)" },
        markLine: {
          silent: true,
          symbol: ["none", "none"] as [string, string],
          lineStyle: { color: "#9ca3af", width: 1, type: "solid" as const },
          label: { show: false },
          data: [{ yAxis: 0 }],
        },
      },
      {
        name: "Strategy Drawdown",
        type: "line" as const,
        data: bt.strat_drawdown,
        lineStyle: { color: "#16a34a", width: 1.5 },
        itemStyle: { color: "#16a34a" },
        symbol: "none",
        areaStyle: { color: "rgba(22,163,74,0.5)" },
      },
    ],
  }
}

function signalChartOption(bt: BpbpData["backtest"]) {
  return {
    backgroundColor: "#ffffff",
    tooltip: WHITE_TOOLTIP,
    grid: { left: 60, right: 20, top: 16, bottom: 36 },
    xAxis: whiteXAxis(bt.dates),
    yAxis: {
      type: "value" as const,
      min: 0,
      max: 1,
      interval: 1,
      axisLabel: {
        color: "#374151",
        fontSize: 10,
        formatter: (v: number) => (v === 0 ? "Cash" : v === 1 ? "SPX" : ""),
      },
      axisLine: { lineStyle: { color: "#9ca3af" } },
      splitLine: { show: false },
    },
    series: [
      {
        type: "bar" as const,
        barWidth: "100%",
        barCategoryGap: "0%",
        data: bt.signal.map((s) => ({
          value: 1,
          itemStyle: {
            color: s === 1 ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.3)",
          },
        })),
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

  const spxOpt = useMemo(
    () => (data ? spxCandlestickOption(data.spy) : null),
    [data],
  )
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

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-green-500" />
          <p className="text-sm text-gray-600">Computing BPBP indicator...</p>
          <p className="mt-1 text-xs text-gray-400">
            Aggregating ~3,000 stocks weekly
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-600">BPBP Error</p>
        <p className="mt-1 text-xs text-red-500">{error}</p>
        <button
          onClick={() => fetchData(period)}
          className="mt-3 rounded bg-red-100 px-3 py-1 text-xs text-red-600 hover:bg-red-200"
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
      {/* ── Signal Banner ── */}
      <div
        className={`rounded-lg border p-4 ${
          isBull ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-bold ${
                isBull ? "text-green-700" : "text-red-700"
              }`}
            >
              {isBull ? "▲ BULL POWER" : "▼ BEAR PRESSURE"}
            </span>
            <span
              className={`text-sm font-medium ${
                isBull ? "text-green-600" : "text-red-600"
              }`}
            >
              {isBull ? "BULLISH SIGNAL" : "BEARISH SIGNAL"}
            </span>
          </div>
          <div className="flex gap-4 font-mono text-xs">
            <span className="text-gray-600">
              BP:{" "}
              <span className="font-semibold text-green-700">
                {latest.buying_power?.toFixed(4) ?? "—"}
              </span>
            </span>
            <span className="text-gray-600">
              SP:{" "}
              <span className="font-semibold text-red-700">
                {latest.selling_pressure?.toFixed(4) ?? "—"}
              </span>
            </span>
            <span className="text-gray-600">
              Ratio:{" "}
              <span className="font-semibold text-blue-700">
                {latest.bpsp_ratio?.toFixed(4) ?? "—"}
              </span>
            </span>
            <span className="text-gray-600">
              SPX:{" "}
              <span className="font-semibold text-gray-900">
                ${latest.spx_close?.toLocaleString() ?? "—"}
              </span>
            </span>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          {latest.date} · {data.compute_ms}ms
        </p>
      </div>

      {/* ── Period Selector ── */}
      <div className="flex items-center gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              period === p.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Plot 1: SPX + Indicator ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {/* Top chart: SPX Candlestick */}
        <h3 className="mb-1 text-sm font-bold text-gray-900">
          S&amp;P 500 Index (Weekly OHLC)
        </h3>
        <div className="relative mb-4">
          {spxOpt && (
            <ReactECharts option={spxOpt} style={{ height: 350 }} notMerge />
          )}
          {/* Stats overlay — top-left of plot area */}
          <div
            className="pointer-events-none absolute rounded border border-amber-400/70 bg-amber-50/95 px-2 py-1.5 font-mono text-xs leading-5 text-gray-700 shadow-sm"
            style={{ left: 76, top: 16 }}
          >
            <div>
              <span className="text-gray-500">Date: </span>
              {latest.date}
            </div>
            <div>
              <span className="text-gray-500">SPX: </span>
              <span className="font-semibold">
                ${latest.spx_close?.toLocaleString() ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">BP: </span>
              <span className="text-green-700">
                {latest.buying_power?.toFixed(4) ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">SP: </span>
              <span className="text-red-700">
                {latest.selling_pressure?.toFixed(4) ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Ratio:</span>
              <span className="text-blue-700">
                {" "}
                {latest.bpsp_ratio?.toFixed(4) ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom chart: BP/SP Indicator */}
        <h3 className="mb-1 text-sm font-bold text-gray-900">
          Buying Power / Selling Pressure Index (Volume-Based, 21-Week MA)
        </h3>
        {indOpt && (
          <ReactECharts option={indOpt} style={{ height: 200 }} notMerge />
        )}
      </div>

      {/* ── Plot 2: Backtest ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {/* Top chart: Equity Curves */}
        <h3 className="mb-0.5 text-sm font-bold text-gray-900">
          BPSP Timing Strategy vs SPX Benchmark
        </h3>
        <p className="mb-2 text-xs text-gray-500">
          Buy SPX when BP &gt; SP, Hold Cash when SP &gt; BP
        </p>
        <div className="relative mb-4">
          {eqOpt && (
            <ReactECharts option={eqOpt} style={{ height: 350 }} notMerge />
          )}
          {/* Performance stats overlay */}
          <div
            className="pointer-events-none absolute rounded border border-amber-400/70 bg-amber-50/95 px-2 py-1.5 font-mono text-xs leading-5 text-gray-700 shadow-sm"
            style={{ left: 76, top: 40 }}
          >
            <div>
              <span className="text-gray-500">Strategy CAGR: </span>
              <span className={pctColor(s.cagr)}>{fmt(s.cagr)}</span>
            </div>
            <div>
              <span className="text-gray-500">SPX CAGR: </span>
              <span className={pctColor(b.cagr)}>{fmt(b.cagr)}</span>
            </div>
            <div>
              <span className="text-gray-500">Strategy Max DD:</span>
              <span className="text-red-600"> {fmt(s.max_drawdown)}</span>
            </div>
            <div>
              <span className="text-gray-500">SPX Max DD: </span>
              <span className="text-red-600"> {fmt(b.max_drawdown)}</span>
            </div>
            <div>
              <span className="text-gray-500">Strategy Sharpe:</span>
              <span className="text-blue-700"> {fmt(s.sharpe, false)}</span>
            </div>
            <div>
              <span className="text-gray-500">Time in Market: </span>
              <span className="text-green-700">
                {fmt(metrics.time_in_market)}
              </span>
            </div>
          </div>
        </div>

        {/* Middle chart: Drawdowns */}
        <h3 className="mb-1 text-sm font-bold text-gray-900">
          Drawdown Comparison
        </h3>
        <div className="mb-4">
          {ddOpt && (
            <ReactECharts option={ddOpt} style={{ height: 200 }} notMerge />
          )}
        </div>

        {/* Bottom chart: Signal / Market Exposure */}
        <h3 className="mb-1 text-sm font-bold text-gray-900">
          Market Exposure
        </h3>
        {sigOpt && (
          <ReactECharts option={sigOpt} style={{ height: 120 }} notMerge />
        )}
      </div>

      {/* ── Performance Table ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-900">
          Performance Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Metric
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-green-700">
                  BPSP Strategy
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                  SPX Benchmark
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">Total Return</td>
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
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">CAGR</td>
                <td className={`px-3 py-1.5 text-right ${pctColor(s.cagr)}`}>
                  {fmt(s.cagr)}
                </td>
                <td className={`px-3 py-1.5 text-right ${pctColor(b.cagr)}`}>
                  {fmt(b.cagr)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">Volatility</td>
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {fmt(s.volatility)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {fmt(b.volatility)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">Sharpe Ratio</td>
                <td className="px-3 py-1.5 text-right text-blue-700">
                  {fmt(s.sharpe, false)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {fmt(b.sharpe, false)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">Max Drawdown</td>
                <td className="px-3 py-1.5 text-right text-red-600">
                  {fmt(s.max_drawdown)}
                </td>
                <td className="px-3 py-1.5 text-right text-red-600">
                  {fmt(b.max_drawdown)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">Win Rate (weeks)</td>
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {fmt(s.win_rate)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {fmt(b.win_rate)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">
                  Final Equity ($100)
                </td>
                <td className="px-3 py-1.5 text-right font-semibold text-gray-900">
                  {fmtDollar(s.final_equity)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {fmtDollar(b.final_equity)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-1.5 text-gray-600">Time in Market</td>
                <td className="px-3 py-1.5 text-right text-green-700">
                  {fmt(metrics.time_in_market)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 text-gray-600">Backtest Period</td>
                <td className="px-3 py-1.5 text-right text-gray-600">
                  {metrics.start_date} → {metrics.end_date}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-500">
                  {metrics.years}yr / {metrics.weeks}wk
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Methodology Note ── */}
      <div className="px-1 text-[10px] text-gray-500">
        <p>
          BPBP = Buying Power / Selling Pressure. Volume-weighted breadth
          indicator computed from the full survivorship-bias-free universe
          (~3,000 stocks). 21-week SMA applied. Strategy: hold SPX when BP {`>`}{" "}
          SP, cash otherwise. Signal lagged 1 week (no look-ahead).
        </p>
      </div>
    </div>
  )
}
