"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import ScreenerFilters, {
  type ActiveFilter,
} from "@/components/screener/ScreenerFilters"
import ScreenerTable from "@/components/screener/ScreenerTable"
import { addToWatchlist } from "@/lib/watchlist"

// Session storage key for filter + data persistence
const STORAGE_KEY = "jcn_screener_state"

interface ScreenerState {
  filters: ActiveFilter[]
  data: Record<string, unknown>[]
  columns: string[]
  totalCount: number
}

function loadState(): ScreenerState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScreenerState
  } catch {
    return null
  }
}

function saveState(state: ScreenerState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<ActiveFilter[]>([])
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialLoadDone = useRef(false)

  // On mount: restore from sessionStorage if available, otherwise fetch with no filters
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const cached = loadState()
    if (cached && cached.data.length > 0) {
      setFilters(cached.filters)
      setData(cached.data)
      setColumns(cached.columns)
      setTotalCount(cached.totalCount)
    } else {
      // Initial load with no filters
      fetchScreener([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchScreener = useCallback(async (activeFilters: ActiveFilter[]) => {
    setIsLoading(true)
    setError(null)

    try {
      const body = {
        filters: activeFilters.map((f) => ({
          field: f.field,
          op: f.op,
          value: f.value,
        })),
        sort_by: "market_cap",
        sort_dir: "desc",
        limit: 3000,
        offset: 0,
      }

      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error")
        throw new Error(`API error ${res.status}: ${errText}`)
      }

      const result = await res.json()

      if (result.error) {
        setError(result.error)
        setData([])
        setColumns([])
        setTotalCount(0)
      } else {
        setData(result.data ?? [])
        setColumns(result.columns ?? [])
        setTotalCount(result.total_count ?? 0)
        setError(null)

        // Persist to sessionStorage
        saveState({
          filters: activeFilters,
          data: result.data ?? [],
          columns: result.columns ?? [],
          totalCount: result.total_count ?? 0,
        })
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch screener data"
      setError(msg)
      setData([])
      setColumns([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleFiltersChange = useCallback(
    (newFilters: ActiveFilter[]) => {
      setFilters(newFilters)
      fetchScreener(newFilters)
    },
    [fetchScreener],
  )

  const handleCellClick = useCallback(
    (symbol: string, action: "analysis" | "watchlist" | "grok") => {
      switch (action) {
        case "analysis":
          // Open stock analysis in new tab — preserves screener state
          window.open(
            `/stock-analysis?symbol=${encodeURIComponent(symbol)}`,
            "_blank",
          )
          break
        case "watchlist": {
          const added = addToWatchlist(symbol)
          // Brief visual feedback — non-blocking
          if (added) {
            alert(`${symbol} added to Watchlist`)
          } else {
            alert(`${symbol} is already on your Watchlist`)
          }
          break
        }
        case "grok":
          // Placeholder — no functionality yet
          break
      }
    },
    [],
  )

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-[1800px]">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
            Stock Screener
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Filter the JCN universe (~3,000 stocks) by fundamentals, scores, and
            momentum. Right-click any row for actions.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <ScreenerFilters
            activeFilters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </div>

        {/* Results Table */}
        <ScreenerTable
          data={data}
          columns={columns}
          totalCount={totalCount}
          isLoading={isLoading}
          error={error}
          onCellClick={handleCellClick}
        />
      </div>
    </div>
  )
}
