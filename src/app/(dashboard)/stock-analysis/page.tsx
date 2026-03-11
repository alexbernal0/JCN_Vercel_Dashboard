"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import dynamic from "next/dynamic"

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false })
const CompanyProfile = dynamic(
  () => import("@/components/dashboard/CompanyProfile"),
  { ssr: false },
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SearchResult {
  symbol: string
  company_name: string
  sector: string
  industry: string
  market_cap: number
  market_cap_display: string
}

interface RecentSearch {
  symbol: string
  company_name: string
  change_pct: number | null
}

interface AnalysisData {
  symbol: string
  company_name: string
  header: Record<string, any>
  price_history: any[]
  per_share_annual: any[]
  quality_metrics: any[]
  income_statement: any[]
  balance_sheet: any[]
  cash_flows: any[]
  growth_rates: any[]
  valuation: Record<string, any>
  quality_scores: Record<string, any>
}

interface StatementItem {
  label: string
  value: number | null
  is_parent: boolean
  children: StatementItem[]
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const LS_HISTORY_KEY = "jcn_stock_history"
const LS_ANALYSIS_PREFIX = "jcn_analysis_"
const ANALYSIS_TTL = 30 * 60 * 1000 // 30 min

function lsGet<T>(key: string, ttl?: number): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (ttl && Date.now() - (parsed._ts ?? 0) > ttl) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.payload as T
  } catch {
    return null
  }
}

function lsSet(key: string, payload: any): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify({ payload, _ts: Date.now() }))
  } catch {
    /* full */
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmtPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "--"
  return `${(val * 100).toFixed(1)}%`
}

function fmtRatio(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "--"
  return val.toFixed(2)
}

function fmtM(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "--"
  if (val < 0) return `($${Math.abs(val).toFixed(1)}M)`
  return `$${val.toFixed(1)}M`
}

function fmtDollar(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "--"
  if (val < 0) return `-$${Math.abs(val).toFixed(2)}`
  return `$${val.toFixed(2)}`
}

function fmtNum(val: number | null | undefined, decimals = 1): string {
  if (val == null || isNaN(val)) return "--"
  return val.toFixed(decimals)
}

function fmtCap(mc: number | null | undefined): string {
  if (!mc) return "--"
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`
  return `$${mc.toLocaleString()}`
}

function fmtGrowth(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "--"
  const prefix = val >= 0 ? "+" : ""
  return `${prefix}${val.toFixed(1)}%`
}

function growthColor(val: number | null | undefined): string {
  if (val == null || isNaN(val))
    return "bg-gray-50 dark:bg-gray-800 text-gray-400"
  if (val >= 20)
    return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
  if (val >= 5)
    return "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
  if (val >= -5)
    return "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
  if (val >= -20)
    return "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
  return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
}

function scoreColor(val: number): string {
  if (val >= 70) return "text-green-600 dark:text-green-400"
  if (val >= 40) return "text-yellow-600 dark:text-yellow-400"
  return "text-red-600 dark:text-red-400"
}

// ---------------------------------------------------------------------------
// ExpandableRow sub-component for financial statements
// ---------------------------------------------------------------------------
function ExpandableRow({
  item,
  years,
  yearData,
  depth = 0,
  expandedSet,
  toggleExpand,
}: {
  item: StatementItem
  years: number[]
  yearData: Record<number, StatementItem[]>
  depth?: number
  expandedSet: Set<string>
  toggleExpand: (key: string) => void
}) {
  const key = `${depth}-${item.label}`
  const isExpanded = expandedSet.has(key)
  const hasChildren = item.is_parent && item.children.length > 0
  const indent = depth * 24

  return (
    <>
      <tr
        className={`${hasChildren ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""} ${depth === 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}
        onClick={hasChildren ? () => toggleExpand(key) : undefined}
      >
        <td
          className={`sticky left-0 z-10 whitespace-nowrap bg-white py-2 pr-4 dark:bg-gray-900 ${item.is_parent ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}`}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <span className="flex items-center gap-1">
            {hasChildren && (
              <span className="inline-block w-4 text-xs text-gray-400">
                {isExpanded ? "▼" : "▶"}
              </span>
            )}
            {!hasChildren && depth > 0 && <span className="inline-block w-4" />}
            {item.label}
          </span>
        </td>
        {years.map((yr) => {
          const yrItems = yearData[yr] || []
          const found = findItem(yrItems, item.label, depth)
          const v = found?.value
          return (
            <td
              key={yr}
              className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums"
            >
              <span
                className={
                  v != null && v < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-700 dark:text-gray-300"
                }
              >
                {fmtM(v)}
              </span>
            </td>
          )
        })}
      </tr>
      {hasChildren &&
        isExpanded &&
        item.children.map((child) => (
          <ExpandableRow
            key={`${depth + 1}-${child.label}`}
            item={child}
            years={years}
            yearData={yearData}
            depth={depth + 1}
            expandedSet={expandedSet}
            toggleExpand={toggleExpand}
          />
        ))}
    </>
  )
}

// Find a matching item in the items tree at a given depth
function findItem(
  items: StatementItem[],
  label: string,
  depth: number,
): StatementItem | undefined {
  if (depth === 0) return items.find((i) => i.label === label)
  for (const item of items) {
    if (item.children) {
      const found = findItem(item.children, label, depth - 1)
      if (found) return found
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// FinancialStatementTable — reusable for IS, BS, CF
// ---------------------------------------------------------------------------
function FinancialStatementTable({
  title,
  data,
}: {
  title: string
  data: Array<{ year: number; items: StatementItem[] }>
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (!data || data.length === 0) return null

  const years = data.map((d) => d.year)
  const yearData: Record<number, StatementItem[]> = {}
  data.forEach((d) => {
    yearData[d.year] = d.items
  })
  const topItems = data[0].items

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        {title}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {years.length} years · Values in $M
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="sticky left-0 z-10 bg-white py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                Line Item
              </th>
              {years.map((yr) => (
                <th
                  key={yr}
                  className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  {yr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topItems.map((item) => (
              <ExpandableRow
                key={`0-${item.label}`}
                item={item}
                years={years}
                yearData={yearData}
                depth={0}
                expandedSet={expanded}
                toggleExpand={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function StockAnalysisPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outsideUniverse, setOutsideUniverse] = useState(false)
  const [totalUniverse, setTotalUniverse] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = lsGet<RecentSearch[]>(LS_HISTORY_KEY)
    if (saved) setRecentSearches(saved)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Debounced search
  const handleSearchInput = useCallback((value: string) => {
    setQuery(value)
    setOutsideUniverse(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/stock/search?q=${encodeURIComponent(value)}`,
        )
        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
          setTotalUniverse(data.total_universe || 0)
          setShowDropdown(true)
          if (data.results.length === 0 && value.trim().length >= 2) {
            setOutsideUniverse(true)
          }
        }
      } catch {
        /* network error */
      }
    }, 200)
  }, [])

  // Animated progress bar
  const startProgress = useCallback(() => {
    setProgress(0)
    let p = 0
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = setInterval(() => {
      p += Math.random() * 8 + 2
      if (p > 90) p = 90
      setProgress(p)
    }, 150)
  }, [])

  const finishProgress = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current)
    setProgress(100)
    setTimeout(() => setProgress(0), 500)
  }, [])

  // Load stock analysis
  const loadAnalysis = useCallback(
    async (symbol: string, _companyName?: string) => {
      setShowDropdown(false)
      setOutsideUniverse(false)
      setQuery(symbol)

      // Check localStorage cache first
      const cached = lsGet<AnalysisData>(
        LS_ANALYSIS_PREFIX + symbol,
        ANALYSIS_TTL,
      )
      if (cached) {
        setAnalysisData(cached)
        updateRecentSearches(symbol, cached.company_name)
        return
      }

      setLoading(true)
      startProgress()
      try {
        const res = await fetch(
          `/api/stock/analysis?symbol=${encodeURIComponent(symbol)}`,
        )
        if (res.ok) {
          const data: AnalysisData = await res.json()
          setAnalysisData(data)
          lsSet(LS_ANALYSIS_PREFIX + symbol, data)
          updateRecentSearches(symbol, data.company_name)
        } else if (res.status === 404) {
          setOutsideUniverse(true)
          setAnalysisData(null)
        }
      } catch {
        // network error
      } finally {
        setLoading(false)
        finishProgress()
      }
    },
    [startProgress, finishProgress],
  )

  // Update recent searches list
  const updateRecentSearches = (symbol: string, name: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.symbol !== symbol)
      const updated = [
        { symbol, company_name: name, change_pct: null },
        ...filtered,
      ].slice(0, 10)
      lsSet(LS_HISTORY_KEY, updated)
      return updated
    })
  }

  // Handle Enter key in search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length > 0) {
      loadAnalysis(results[0].symbol, results[0].company_name)
    } else if (e.key === "Enter" && query.trim().length >= 1) {
      loadAnalysis(query.trim().toUpperCase())
    }
  }

  // Auto-load NVDA on mount (default symbol)
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      loadAnalysis("NVDA")
    }
  }, [loadAnalysis])

  // --------------- Chart options (memoized) ---------------

  // Module 2: Price vs SPY chart options
  const priceChartOption = useMemo(() => {
    if (!analysisData?.price_history?.length) return null
    const ph = analysisData.price_history
    return {
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "rgba(17,24,39,0.9)",
        borderColor: "rgba(55,65,81,0.5)",
        textStyle: { color: "#f9fafb", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ""
          const date = params[0].axisValue
          const idx = params[0].dataIndex
          const row = ph[idx]
          if (!row) return date
          return (
            `<div style="font-weight:600">${date}</div>` +
            `<div>${analysisData.symbol}: $${row.price?.toFixed(2) ?? "--"} (${row.price_indexed?.toFixed(1) ?? "--"})</div>` +
            `<div style="color:#9ca3af">SPY: $${row.spy_price?.toFixed(2) ?? "--"} (${row.spy_indexed?.toFixed(1) ?? "--"})</div>`
          )
        },
      },
      legend: {
        data: [analysisData.symbol, "SPY"],
        textStyle: { color: "#9ca3af" },
        top: 0,
      },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: "category" as const,
        data: ph.map((d: any) => d.date),
        axisLabel: {
          color: "#9ca3af",
          fontSize: 10,
          interval: Math.floor(ph.length / 6),
        },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { color: "#9ca3af", fontSize: 10 },
        splitLine: { lineStyle: { color: "#1f2937" } },
      },
      series: [
        {
          name: analysisData.symbol,
          type: "line" as const,
          data: ph.map((d: any) => d.price_indexed),
          showSymbol: false,
          lineStyle: { color: "#3b82f6", width: 2 },
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "SPY",
          type: "line" as const,
          data: ph.map((d: any) => d.spy_indexed),
          showSymbol: false,
          lineStyle: { color: "#9ca3af", width: 1.5 },
          itemStyle: { color: "#9ca3af" },
        },
      ],
    }
  }, [analysisData])

  // Module 10: Radar chart options
  const radarChartOption = useMemo(() => {
    if (!analysisData?.quality_scores) return null
    const qs = analysisData.quality_scores
    const dims = [
      "value",
      "quality",
      "financial_strength",
      "growth",
      "momentum",
    ]
    const labels = [
      "Value",
      "Quality",
      "Financial Strength",
      "Growth",
      "Momentum",
    ]
    return {
      radar: {
        indicator: labels.map((name) => ({ name, max: 100 })),
        shape: "polygon" as const,
        axisName: { color: "#9ca3af", fontSize: 11 },
        splitArea: {
          areaStyle: { color: ["rgba(31,41,55,0.1)", "rgba(31,41,55,0.2)"] },
        },
        splitLine: { lineStyle: { color: "#374151" } },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      series: [
        {
          type: "radar" as const,
          data: [
            {
              value: dims.map((d) => Number(qs[d]) || 0),
              name: analysisData.symbol,
              areaStyle: { color: "rgba(59,130,246,0.2)" },
              lineStyle: { color: "#3b82f6", width: 2 },
              itemStyle: { color: "#3b82f6" },
            },
          ],
        },
      ],
    }
  }, [analysisData])

  // Per share row definitions
  const perShareRows = [
    { label: "Revenue/Share", key: "revenue_per_share", fmt: fmtDollar },
    { label: "EPS", key: "eps", fmt: fmtDollar },
    { label: "FCF/Share", key: "fcf_per_share", fmt: fmtDollar },
    { label: "EBITDA/Share", key: "ebitda_per_share", fmt: fmtDollar },
    { label: "Book Value/Share", key: "book_value_per_share", fmt: fmtDollar },
    {
      label: "Operating CF/Share",
      key: "operating_cf_per_share",
      fmt: fmtDollar,
    },
    { label: "Dividend/Share", key: "dividend_per_share", fmt: fmtDollar },
    { label: "Buyback Yield", key: "buyback_yield", fmt: fmtPct },
    { label: "Dividend Yield", key: "dividend_yield", fmt: fmtPct },
    { label: "Total Return Yield", key: "total_return_yield", fmt: fmtPct },
    {
      label: "Shares Outstanding (M)",
      key: "shares_outstanding",
      fmt: (v: any) => fmtNum(v, 1),
    },
    { label: "Revenue ($M)", key: "revenue", fmt: (v: any) => fmtM(v) },
    { label: "Net Income ($M)", key: "net_income", fmt: (v: any) => fmtM(v) },
    {
      label: "Free Cash Flow ($M)",
      key: "free_cash_flow",
      fmt: (v: any) => fmtM(v),
    },
  ]

  // Quality metrics row definitions
  const qualityRows: Array<{
    label: string
    key: string
    fmt: (v: any) => string
  }> = [
    { label: "Gross Margin", key: "gross_margin", fmt: fmtPct },
    { label: "Operating Margin", key: "operating_margin", fmt: fmtPct },
    { label: "Net Margin", key: "net_margin", fmt: fmtPct },
    { label: "EBITDA Margin", key: "ebitda_margin", fmt: fmtPct },
    { label: "FCF Margin", key: "fcf_margin", fmt: fmtPct },
    { label: "ROIC", key: "roic", fmt: fmtPct },
    { label: "ROE", key: "roe", fmt: fmtPct },
    { label: "ROA", key: "roa", fmt: fmtPct },
    { label: "ROCE", key: "roce", fmt: fmtPct },
    { label: "Debt/Equity", key: "debt_to_equity", fmt: fmtRatio },
    { label: "LT Debt/Equity", key: "long_term_debt_to_equity", fmt: fmtRatio },
    { label: "Current Ratio", key: "current_ratio", fmt: fmtRatio },
    { label: "Interest Coverage", key: "interest_coverage", fmt: fmtRatio },
    { label: "Asset Turnover", key: "asset_turnover", fmt: fmtRatio },
    { label: "CapEx/Revenue", key: "capex_to_revenue", fmt: fmtPct },
    { label: "FCF Conversion", key: "fcf_conversion", fmt: fmtRatio },
    { label: "Cash Conversion", key: "cash_conversion", fmt: fmtRatio },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Sticky search header */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto max-w-7xl px-6 py-4">
          {/* Title row */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                Stock Analysis
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {totalUniverse > 0
                  ? `Top ${totalUniverse.toLocaleString()} stocks by market cap`
                  : "Deep fundamental analysis screener"}
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div ref={searchRef} className="relative">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                &#128269;
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                placeholder="Search by ticker or company name..."
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-base text-gray-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400"
              />
            </div>

            {/* Dropdown results */}
            {showDropdown && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                {results.map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => loadAnalysis(r.symbol, r.company_name)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-blue-50 dark:hover:bg-gray-800"
                  >
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {r.symbol}
                      </span>
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        {r.company_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {r.sector}
                      </span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {r.market_cap_display}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Outside universe message */}
            {outsideUniverse && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Outside our investable universe
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This stock is not in the top {totalUniverse.toLocaleString()}{" "}
                  by market cap
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {progress > 0 && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Recent search history pills */}
          {recentSearches.length > 0 && (
            <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">
              {recentSearches.map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => loadAnalysis(s.symbol, s.company_name)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:shadow-md ${
                    analysisData?.symbol === s.symbol
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span className="font-semibold">{s.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Loading skeleton */}
        {loading && !analysisData && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Loading fundamental data...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !analysisData && !outsideUniverse && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-6xl">&#128200;</p>
            <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Search for a stock
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Type a ticker or company name to see full fundamental analysis
            </p>
          </div>
        )}

        {/* ============ Analysis modules ============ */}
        {analysisData && (
          <div className="space-y-6">
            {/* ===== Module 1: Company Profile (TradingView) ===== */}
            <section className="h-[480px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <CompanyProfile symbol={analysisData.symbol} />
            </section>

            {/* ===== Module 2: Price vs SPY (5yr) ===== */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Price vs SPY (5yr)
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {analysisData.price_history.length} daily data points · Indexed
                to 100 at start
              </p>
              {priceChartOption && (
                <div className="mt-4">
                  <ReactECharts
                    option={priceChartOption}
                    style={{ height: 400 }}
                    notMerge
                    lazyUpdate
                  />
                </div>
              )}
            </section>

            {/* ===== Module 3: Per Share Data ===== */}
            {analysisData.per_share_annual.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  Per Share Data
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {analysisData.per_share_annual.length} years
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="sticky left-0 z-10 bg-white py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                          Metric
                        </th>
                        {analysisData.per_share_annual.map((d: any) => (
                          <th
                            key={d.year}
                            className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                          >
                            {d.year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perShareRows.map((row, idx) => (
                        <tr
                          key={row.key}
                          className={
                            idx % 2 === 0
                              ? "bg-gray-50/50 dark:bg-gray-800/30"
                              : ""
                          }
                        >
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-2 pr-4 text-sm font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            <span
                              className={
                                idx % 2 === 0
                                  ? "rounded bg-gray-50/50 dark:bg-gray-800/30"
                                  : ""
                              }
                            >
                              {row.label}
                            </span>
                          </td>
                          {analysisData.per_share_annual.map((d: any) => {
                            const v = d[row.key]
                            return (
                              <td
                                key={d.year}
                                className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300"
                              >
                                {row.fmt(v)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ===== Module 4: Quality Metrics ===== */}
            {analysisData.quality_metrics.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  Quality Metrics
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {analysisData.quality_metrics.length} years
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="sticky left-0 z-10 bg-white py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                          Metric
                        </th>
                        {analysisData.quality_metrics.map((d: any) => (
                          <th
                            key={d.year}
                            className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                          >
                            {d.year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {qualityRows.map((row, idx) => (
                        <tr
                          key={row.key}
                          className={
                            idx % 2 === 0
                              ? "bg-gray-50/50 dark:bg-gray-800/30"
                              : ""
                          }
                        >
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-2 pr-4 text-sm font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            {row.label}
                          </td>
                          {analysisData.quality_metrics.map((d: any) => {
                            const v = d[row.key]
                            const isNeg = v != null && v < 0
                            return (
                              <td
                                key={d.year}
                                className={`whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums ${isNeg ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}
                              >
                                {row.fmt(v)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ===== Module 5: Income Statement ===== */}
            <FinancialStatementTable
              title="Income Statement"
              data={analysisData.income_statement}
            />

            {/* ===== Module 6: Balance Sheet ===== */}
            <FinancialStatementTable
              title="Balance Sheet"
              data={analysisData.balance_sheet}
            />

            {/* ===== Module 7: Cash Flows ===== */}
            <FinancialStatementTable
              title="Cash Flows"
              data={analysisData.cash_flows}
            />

            {/* ===== Module 8: Growth Rates ===== */}
            {analysisData.growth_rates.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  Growth Rates
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Year-over-year growth
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="sticky left-0 z-10 bg-white py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                          Metric
                        </th>
                        {(() => {
                          const allYears = new Set<string>()
                          analysisData.growth_rates.forEach((g: any) => {
                            Object.keys(g.values).forEach((y) =>
                              allYears.add(y),
                            )
                          })
                          return Array.from(allYears)
                            .sort((a, b) => Number(b) - Number(a))
                            .map((yr) => (
                              <th
                                key={yr}
                                className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                              >
                                {yr}
                              </th>
                            ))
                        })()}
                      </tr>
                    </thead>
                    <tbody>
                      {analysisData.growth_rates.map((g: any) => {
                        const allYears = new Set<string>()
                        analysisData.growth_rates.forEach((gr: any) => {
                          Object.keys(gr.values).forEach((y) => allYears.add(y))
                        })
                        const sortedYears = Array.from(allYears).sort(
                          (a, b) => Number(b) - Number(a),
                        )
                        return (
                          <tr key={g.metric}>
                            <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-2 pr-4 text-sm font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                              {g.metric}
                            </td>
                            {sortedYears.map((yr) => {
                              const v = g.values[yr]
                              return (
                                <td
                                  key={yr}
                                  className={`whitespace-nowrap px-3 py-1.5 text-center text-sm tabular-nums ${growthColor(v)}`}
                                >
                                  {fmtGrowth(v)}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ===== Module 9: Valuation Ratios ===== */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Valuation Ratios
              </h3>
              <div className="mt-2 flex gap-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Market Cap:{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmtCap(analysisData.valuation.market_cap)}
                  </span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enterprise Value:{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmtCap(analysisData.valuation.enterprise_value)}
                  </span>
                </p>
              </div>

              {/* Valuation grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ["P/E Ratio", analysisData.valuation.pe_ratio],
                  ["Forward P/E", analysisData.valuation.forward_pe],
                  ["PEG Ratio", analysisData.valuation.peg_ratio],
                  ["Price/Book", analysisData.valuation.price_to_book],
                  ["Price/Sales", analysisData.valuation.price_to_sales],
                  ["EV/EBITDA", analysisData.valuation.ev_to_ebitda],
                  ["EV/Revenue", analysisData.valuation.ev_to_revenue],
                  ["Trailing P/E", analysisData.valuation.trailing_pe],
                  [
                    "Dividend Yield",
                    analysisData.valuation.dividend_yield != null
                      ? `${(analysisData.valuation.dividend_yield * 100).toFixed(2)}%`
                      : null,
                  ],
                ].map(([label, val]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {val != null ? String(val) : "--"}
                    </p>
                  </div>
                ))}
              </div>

              {/* Analyst consensus */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Analyst Consensus
                </h4>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Target:{" "}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {analysisData.valuation.analyst_target_price
                        ? `$${analysisData.valuation.analyst_target_price}`
                        : "--"}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Rating:{" "}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {analysisData.valuation.analyst_rating ?? "--"}
                    </span>
                    /5
                  </p>
                </div>
                {(() => {
                  const v = analysisData.valuation
                  const sb = Number(v.analyst_strong_buy) || 0
                  const b = Number(v.analyst_buy) || 0
                  const h = Number(v.analyst_hold) || 0
                  const s = Number(v.analyst_sell) || 0
                  const ss = Number(v.analyst_strong_sell) || 0
                  const total = sb + b + h + s + ss
                  if (total === 0) return null
                  const segments = [
                    { label: "Strong Buy", count: sb, color: "bg-green-600" },
                    { label: "Buy", count: b, color: "bg-green-400" },
                    { label: "Hold", count: h, color: "bg-yellow-400" },
                    { label: "Sell", count: s, color: "bg-red-400" },
                    { label: "Strong Sell", count: ss, color: "bg-red-600" },
                  ]
                  return (
                    <div className="mt-3">
                      <div className="flex h-6 w-full overflow-hidden rounded-full">
                        {segments.map(
                          (seg) =>
                            seg.count > 0 && (
                              <div
                                key={seg.label}
                                className={`${seg.color} flex items-center justify-center text-xs font-medium text-white`}
                                style={{
                                  width: `${(seg.count / total) * 100}%`,
                                }}
                              >
                                {seg.count}
                              </div>
                            ),
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {segments.map((seg) => (
                          <span
                            key={seg.label}
                            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
                          >
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${seg.color}`}
                            />
                            {seg.label}: {seg.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </section>

            {/* ===== Module 10: Quality Scores ===== */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                JCN Scores
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                JCN Factor Scores (0-100)
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ["jcn_composite", "JCN Composite"],
                    ["quality", "Quality"],
                    ["financial_strength", "Financial Strength"],
                    ["growth", "Growth"],
                    ["momentum", "Momentum"],
                    ["value", "Value"],
                  ] as [string, string][]
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {label}
                    </p>
                    <p
                      className={`mt-1 text-lg font-bold ${scoreColor(Number(analysisData.quality_scores[key] ?? 0))}`}
                    >
                      {analysisData.quality_scores[key] != null
                        ? String(analysisData.quality_scores[key])
                        : "--"}
                    </p>
                  </div>
                ))}
              </div>
              {/* Radar chart */}
              {radarChartOption && (
                <div className="mt-6 flex justify-center">
                  <div className="w-full max-w-lg">
                    <ReactECharts
                      option={radarChartOption}
                      style={{ height: 400 }}
                      notMerge
                      lazyUpdate
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
