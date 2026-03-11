"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  clearWatchlist,
  type WatchlistEntry,
} from "@/lib/watchlist"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichedRow {
  symbol: string
  company_name: string | null
  gics_sector: string | null
  market_cap: number | null
  adjusted_close: number | null
  daily_change_pct: number | null
  ytd_pct: number | null
  yoy_pct: number | null
  value_score_composite: number | null
  quality_score_composite: number | null
  growth_score_composite: number | null
  momentum_score_composite: number | null
  jcn_full_composite: number | null
  addedAt: string
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
}
function fmtScore(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return v.toFixed(1)
}
function fmtPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return `$${v.toFixed(2)}`
}
function fmtMcap(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—"
  const abs = Math.abs(v)
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}
function pctColor(v: number | null): string {
  if (v == null) return ""
  if (v > 0) return "text-green-600 dark:text-green-400"
  if (v < 0) return "text-red-600 dark:text-red-400"
  return ""
}
function scoreBg(v: number | null): string {
  if (v == null) return ""
  if (v >= 80) return "bg-green-50 dark:bg-green-950/30"
  if (v >= 60) return "bg-blue-50 dark:bg-blue-950/30"
  if (v <= 30) return "bg-red-50 dark:bg-red-950/30"
  return ""
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [enriched, setEnriched] = useState<EnrichedRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addInput, setAddInput] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load watchlist from localStorage
  const refreshEntries = useCallback(() => {
    setEntries(getWatchlist())
  }, [])

  // On mount + listen for cross-component changes
  useEffect(() => {
    refreshEntries()

    const handler = () => refreshEntries()
    window.addEventListener("watchlist-change", handler)
    window.addEventListener("storage", handler)
    return () => {
      window.removeEventListener("watchlist-change", handler)
      window.removeEventListener("storage", handler)
    }
  }, [refreshEntries])

  // Fetch enrichment data when entries change
  useEffect(() => {
    if (entries.length === 0) {
      setEnriched([])
      return
    }

    let cancelled = false
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Use the screener API with no filters — just fetch specific symbols
        // We send market_cap >= 0 as a no-op filter and let the API return all data
        // Then we filter client-side to only our watchlist symbols
        const symbols = entries.map((e) => e.symbol)

        const res = await fetch("/api/screener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filters: [],
            sort_by: "market_cap",
            sort_dir: "desc",
            limit: 3000,
            offset: 0,
          }),
        })

        if (!res.ok) throw new Error(`API ${res.status}`)
        const result = await res.json()

        if (cancelled) return

        if (result.error) {
          setError(result.error)
          return
        }

        // Filter to only watchlist symbols
        const symbolSet = new Set(symbols.map((s) => s.toUpperCase()))
        const rows: EnrichedRow[] = []
        const addedAtMap = new Map(
          entries.map((e) => [e.symbol.toUpperCase(), e.addedAt]),
        )

        for (const row of result.data ?? []) {
          const sym = (row.symbol ?? "").toUpperCase()
          if (symbolSet.has(sym)) {
            rows.push({
              symbol: sym,
              company_name: row.company_name ?? null,
              gics_sector: row.gics_sector ?? null,
              market_cap: row.market_cap ?? null,
              adjusted_close: row.adjusted_close ?? null,
              daily_change_pct: row.daily_change_pct ?? null,
              ytd_pct: row.ytd_pct ?? null,
              yoy_pct: row.yoy_pct ?? null,
              value_score_composite: row.value_score_composite ?? null,
              quality_score_composite: row.quality_score_composite ?? null,
              growth_score_composite: row.growth_score_composite ?? null,
              momentum_score_composite: row.momentum_score_composite ?? null,
              jcn_full_composite: row.jcn_full_composite ?? null,
              addedAt: addedAtMap.get(sym) ?? new Date().toISOString(),
            })
            symbolSet.delete(sym) // mark found
          }
        }

        // Add un-enriched symbols (might not be in screener universe)
        const remaining = Array.from(symbolSet)
        for (const sym of remaining) {
          rows.push({
            symbol: sym,
            company_name: null,
            gics_sector: null,
            market_cap: null,
            adjusted_close: null,
            daily_change_pct: null,
            ytd_pct: null,
            yoy_pct: null,
            value_score_composite: null,
            quality_score_composite: null,
            growth_score_composite: null,
            momentum_score_composite: null,
            jcn_full_composite: null,
            addedAt: addedAtMap.get(sym) ?? new Date().toISOString(),
          })
        }

        setEnriched(rows)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load watchlist data",
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [entries])

  // Add symbol
  const handleAdd = useCallback(() => {
    const sym = addInput.trim().toUpperCase()
    if (!sym) return
    const added = addToWatchlist(sym)
    if (added) {
      setAddInput("")
      refreshEntries()
      inputRef.current?.focus()
    } else {
      alert(`${sym} is already on your Watchlist`)
    }
  }, [addInput, refreshEntries])

  // Remove symbol
  const handleRemove = useCallback(
    (symbol: string) => {
      removeFromWatchlist(symbol)
      refreshEntries()
    },
    [refreshEntries],
  )

  // Clear all
  const handleClearAll = useCallback(() => {
    clearWatchlist()
    refreshEntries()
    setShowClearConfirm(false)
  }, [refreshEntries])

  // CSV export
  const exportCSV = useCallback(() => {
    if (enriched.length === 0) return
    const headers = [
      "Symbol",
      "Company",
      "Sector",
      "Market Cap",
      "Price",
      "Daily %",
      "YTD %",
      "YoY %",
      "Value",
      "Quality",
      "Growth",
      "Momentum",
      "JCN Full",
      "Added",
    ]
    const rows = enriched.map((r) => [
      r.symbol,
      r.company_name ?? "",
      r.gics_sector ?? "",
      r.market_cap ?? "",
      r.adjusted_close ?? "",
      r.daily_change_pct ?? "",
      r.ytd_pct ?? "",
      r.yoy_pct ?? "",
      r.value_score_composite ?? "",
      r.quality_score_composite ?? "",
      r.growth_score_composite ?? "",
      r.momentum_score_composite ?? "",
      r.jcn_full_composite ?? "",
      r.addedAt.slice(0, 10),
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `jcn_watchlist_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [enriched])

  // Open analysis
  const openAnalysis = useCallback((symbol: string) => {
    window.open(
      `/stock-analysis?symbol=${encodeURIComponent(symbol)}`,
      "_blank",
    )
  }, [])

  // Column definitions
  const columns = useMemo<ColumnDef<EnrichedRow>[]>(
    () => [
      {
        id: "actions",
        header: "",
        size: 36,
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRemove(row.original.symbol)
            }}
            className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            title="Remove from watchlist"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        ),
      },
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "company_name",
        header: "Company",
        size: 180,
        cell: ({ getValue }) => (
          <span className="truncate text-xs text-gray-600 dark:text-gray-400">
            {(getValue() as string) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "gics_sector",
        header: "Sector",
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {(getValue() as string) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "market_cap",
        header: "Market Cap",
        size: 95,
        cell: ({ getValue }) => (
          <span className="text-right text-xs">
            {fmtMcap(getValue() as number | null)}
          </span>
        ),
      },
      {
        accessorKey: "adjusted_close",
        header: "Price",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-right text-xs">
            {fmtPrice(getValue() as number | null)}
          </span>
        ),
      },
      {
        accessorKey: "daily_change_pct",
        header: "Daily %",
        size: 75,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs ${pctColor(v)}`}>
              {fmtPct(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "ytd_pct",
        header: "YTD %",
        size: 75,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs ${pctColor(v)}`}>
              {fmtPct(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "yoy_pct",
        header: "YoY %",
        size: 75,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs ${pctColor(v)}`}>
              {fmtPct(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "value_score_composite",
        header: "Value",
        size: 65,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs ${scoreBg(v)}`}>
              {fmtScore(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "quality_score_composite",
        header: "Quality",
        size: 65,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs ${scoreBg(v)}`}>
              {fmtScore(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "growth_score_composite",
        header: "Growth",
        size: 65,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs ${scoreBg(v)}`}>
              {fmtScore(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "momentum_score_composite",
        header: "Mom.",
        size: 65,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs ${scoreBg(v)}`}>
              {fmtScore(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "jcn_full_composite",
        header: "JCN Full",
        size: 70,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return (
            <span className={`text-right text-xs font-medium ${scoreBg(v)}`}>
              {fmtScore(v)}
            </span>
          )
        },
      },
      {
        accessorKey: "addedAt",
        header: "Added",
        size: 85,
        cell: ({ getValue }) => (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {((getValue() as string) ?? "").slice(0, 10)}
          </span>
        ),
      },
      {
        id: "analyze",
        header: "",
        size: 36,
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              openAnalysis(row.original.symbol)
            }}
            className="rounded p-0.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400"
            title="Open analysis in new tab"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ),
      },
    ],
    [handleRemove, openAnalysis],
  )

  // TanStack Table
  const table = useReactTable({
    data: enriched,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-[1600px]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
              Watchlist
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {entries.length === 0
                ? "Your watchlist is empty. Add symbols below or from the Screener."
                : `${entries.length} symbol${entries.length !== 1 ? "s" : ""} · Data from PROD universe`}
            </p>
          </div>
        </div>

        {/* Add + Actions Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Manual add */}
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd()
              }}
              placeholder="Add ticker..."
              className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <button
              onClick={handleAdd}
              disabled={!addInput.trim()}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            disabled={enriched.length === 0}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            Export CSV
          </button>

          {/* Clear All */}
          {entries.length > 0 && (
            <>
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Clear All
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-red-600 dark:text-red-400">
                    Remove all {entries.length} symbols?
                  </span>
                  <button
                    onClick={handleClearAll}
                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Yes, clear
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Table */}
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 dark:border-gray-700">
            <span className="text-3xl">⭐</span>
            <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
              No symbols yet
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Type a ticker above, or right-click a stock in the Screener →
              &quot;Add to Watchlist&quot;
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort()
                      return (
                        <th
                          key={header.id}
                          onClick={
                            canSort
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                          className={`whitespace-nowrap border-b border-gray-200 px-2 py-2 font-semibold text-gray-600 dark:border-gray-800 dark:text-gray-400 ${canSort ? "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800" : ""}`}
                          style={{ width: header.getSize() }}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {canSort &&
                              ({
                                asc: " ▲",
                                desc: " ▼",
                              }[header.column.getIsSorted() as string] ??
                                "")}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-12 text-center text-sm text-gray-500"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="h-5 w-5 animate-spin text-blue-600"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Loading watchlist data...
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-900/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-2 py-1.5">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
