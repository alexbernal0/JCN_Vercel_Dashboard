"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RowData = Record<string, unknown>

interface ScreenerTableProps {
  data: RowData[]
  columns: string[]
  totalCount: number
  isLoading: boolean
  error?: string | null
  onCellClick?: (
    symbol: string,
    action: "analysis" | "watchlist" | "grok",
  ) => void
}

// ---------------------------------------------------------------------------
// Column display config
// ---------------------------------------------------------------------------

/** Human-readable column headers and formatting rules. */
const COLUMN_CONFIG: Record<
  string,
  {
    header: string
    format?: "pct" | "score" | "ratio" | "currency" | "bignum"
    decimals?: number
    defaultVisible?: boolean
  }
> = {
  // Always visible
  symbol: { header: "Symbol", defaultVisible: true },
  company_name: { header: "Company", defaultVisible: true },
  gics_sector: { header: "Sector", defaultVisible: true },
  market_cap: { header: "Market Cap", format: "bignum", defaultVisible: true },
  adjusted_close: {
    header: "Price",
    format: "currency",
    decimals: 2,
    defaultVisible: true,
  },
  daily_change_pct: {
    header: "Daily %",
    format: "pct",
    decimals: 2,
    defaultVisible: true,
  },

  // Visible by default
  ytd_pct: {
    header: "YTD %",
    format: "pct",
    decimals: 2,
    defaultVisible: true,
  },
  yoy_pct: {
    header: "YoY %",
    format: "pct",
    decimals: 2,
    defaultVisible: true,
  },

  // Scores — visible by default
  value_score_composite: {
    header: "Value",
    format: "score",
    defaultVisible: true,
  },
  quality_score_composite: {
    header: "Quality",
    format: "score",
    defaultVisible: true,
  },
  finstr_score_composite: {
    header: "Fin. Str.",
    format: "score",
    defaultVisible: true,
  },
  growth_score_composite: {
    header: "Growth",
    format: "score",
    defaultVisible: true,
  },
  momentum_score_composite: {
    header: "Momentum",
    format: "score",
    defaultVisible: true,
  },
  jcn_full_composite: {
    header: "JCN Full",
    format: "score",
    defaultVisible: true,
  },

  // Hidden by default but available
  industry: { header: "Industry" },
  pct_below_52wk_high: {
    header: "% Below 52W High",
    format: "pct",
    decimals: 2,
  },
  chan_range_pct: { header: "52W Range %", format: "pct", decimals: 2 },
  week_52_high: { header: "52W High", format: "currency", decimals: 2 },
  week_52_low: { header: "52W Low", format: "currency", decimals: 2 },

  // JCN Blends
  jcn_qarp: { header: "QARP", format: "score" },
  jcn_garp: { header: "GARP", format: "score" },
  jcn_quality_momentum: { header: "Qual. Mom.", format: "score" },
  jcn_value_momentum: { header: "Val. Mom.", format: "score" },
  jcn_growth_quality_momentum: { header: "Grw. Qual. Mom.", format: "score" },
  jcn_fortress: { header: "Fortress", format: "score" },
  jcn_alpha_trifecta: { header: "Alpha Tri.", format: "score" },

  // Momentum sub-components
  af_r3m: { header: "AF R3M", format: "ratio", decimals: 2 },
  af_r6m: { header: "AF R6M", format: "ratio", decimals: 2 },
  af_r9m: { header: "AF R9M", format: "ratio", decimals: 2 },
  af_r12m: { header: "AF R12M", format: "ratio", decimals: 2 },
  af_momentum: { header: "AF Momentum", format: "score" },
  fip_3m: { header: "FIP 3M", format: "score" },
  fip_6m: { header: "FIP 6M", format: "score" },
  fip_12m: { header: "FIP 12M", format: "score" },
  fip_score: { header: "FIP Score", format: "score" },
  systemscore: { header: "System Score", format: "score" },
  af_composite: { header: "AF Composite", format: "score" },
  fip_composite: { header: "FIP Composite", format: "score" },
  sys_composite: { header: "SYS Composite", format: "score" },

  // Valuation
  pe_ratio: { header: "P/E", format: "ratio", decimals: 1 },
  forward_pe: { header: "Fwd P/E", format: "ratio", decimals: 1 },
  peg_ratio: { header: "PEG", format: "ratio", decimals: 2 },
  price_book: { header: "P/B", format: "ratio", decimals: 2 },
  price_sales: { header: "P/S", format: "ratio", decimals: 2 },
  ev_ebitda: { header: "EV/EBITDA", format: "ratio", decimals: 1 },
  dividend_yield: { header: "Div Yield", format: "pct", decimals: 2 },
  beta: { header: "Beta", format: "ratio", decimals: 2 },

  // Profitability
  profit_margin: { header: "Net Margin", format: "pct", decimals: 2 },
  operating_margin: { header: "Op. Margin", format: "pct", decimals: 2 },
  return_on_equity: { header: "ROE", format: "pct", decimals: 2 },
  return_on_assets: { header: "ROA", format: "pct", decimals: 2 },
  gross_margin: { header: "Gross Margin", format: "pct", decimals: 2 },

  // Growth
  revenue_growth: { header: "Rev Growth", format: "pct", decimals: 2 },
  earnings_growth: { header: "Earn Growth", format: "pct", decimals: 2 },

  // Fundamentals
  debt_to_equity: { header: "D/E", format: "ratio", decimals: 2 },
  current_ratio: { header: "Current Ratio", format: "ratio", decimals: 2 },
  interest_coverage: { header: "Int. Coverage", format: "ratio", decimals: 1 },
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCell(
  value: unknown,
  format?: string,
  decimals?: number,
): string {
  if (value == null) return "—"

  const num = Number(value)
  if (!Number.isFinite(num)) return "—"

  switch (format) {
    case "pct":
      return `${num >= 0 ? "+" : ""}${num.toFixed(decimals ?? 2)}%`
    case "score":
      return num.toFixed(1)
    case "ratio":
      return num.toFixed(decimals ?? 2)
    case "currency":
      return `$${num.toFixed(decimals ?? 2)}`
    case "bignum": {
      const abs = Math.abs(num)
      if (abs >= 1e12) return `$${(num / 1e12).toFixed(1)}T`
      if (abs >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
      if (abs >= 1e6) return `$${(num / 1e6).toFixed(0)}M`
      return `$${num.toLocaleString()}`
    }
    default:
      return String(value)
  }
}

function pctCellColor(value: unknown): string {
  if (value == null) return ""
  const num = Number(value)
  if (!Number.isFinite(num)) return ""
  if (num > 0) return "text-green-600 dark:text-green-400"
  if (num < 0) return "text-red-600 dark:text-red-400"
  return ""
}

function scoreCellBg(value: unknown): string {
  if (value == null) return ""
  const num = Number(value)
  if (!Number.isFinite(num)) return ""
  if (num >= 80) return "bg-green-50 dark:bg-green-950/30"
  if (num >= 60) return "bg-blue-50 dark:bg-blue-950/30"
  if (num <= 30) return "bg-red-50 dark:bg-red-950/30"
  return ""
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScreenerTable({
  data,
  columns: apiColumns,
  totalCount,
  isLoading,
  error,
  onCellClick,
}: ScreenerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const columnPickerRef = useRef<HTMLDivElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    symbol: string
  } | null>(null)

  // Close column picker and context menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        columnPickerRef.current &&
        !columnPickerRef.current.contains(e.target as Node)
      ) {
        setShowColumnPicker(false)
      }
      setContextMenu(null)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Build default visibility from COLUMN_CONFIG
  const defaultVisibility = useMemo<VisibilityState>(() => {
    const vis: VisibilityState = {}
    for (const col of apiColumns) {
      const cfg = COLUMN_CONFIG[col]
      vis[col] = cfg?.defaultVisible ?? false
    }
    return vis
  }, [apiColumns])

  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(defaultVisibility)

  // When API returns new columns, merge with current visibility
  // (keep user choices, default new ones)
  const effectiveVisibility = useMemo(() => {
    const merged = { ...defaultVisibility }
    for (const [k, v] of Object.entries(columnVisibility)) {
      merged[k] = v
    }
    return merged
  }, [defaultVisibility, columnVisibility])

  // Build TanStack column defs from API column list
  const columnDefs = useMemo<ColumnDef<RowData>[]>(() => {
    return apiColumns.map((col) => {
      const cfg = COLUMN_CONFIG[col] ?? { header: col }
      return {
        accessorKey: col,
        header: cfg.header,
        cell: (info) => {
          const val = info.getValue()
          const formatted = formatCell(val, cfg.format, cfg.decimals)

          let className = "text-xs whitespace-nowrap"
          if (cfg.format === "pct") className += ` ${pctCellColor(val)}`
          if (cfg.format === "score") className += ` ${scoreCellBg(val)}`
          if (
            cfg.format === "currency" ||
            cfg.format === "bignum" ||
            cfg.format === "ratio" ||
            cfg.format === "score" ||
            cfg.format === "pct"
          ) {
            className += " text-right"
          }

          return <span className={className}>{formatted}</span>
        },
        enableSorting: true,
        size:
          col === "company_name"
            ? 180
            : col === "symbol"
              ? 70
              : col === "gics_sector"
                ? 130
                : col === "industry"
                  ? 150
                  : 90,
      }
    })
  }, [apiColumns])

  // TanStack Table instance
  const table = useReactTable({
    data,
    columns: columnDefs,
    state: {
      sorting,
      columnVisibility: effectiveVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // CSV Export
  const exportCSV = useCallback(() => {
    const visibleCols = table.getVisibleFlatColumns()
    const headers = visibleCols.map((c) => {
      const cfg = COLUMN_CONFIG[c.id]
      return cfg?.header ?? c.id
    })

    const rows = table.getRowModel().rows.map((row) =>
      visibleCols.map((col) => {
        const val = row.getValue(col.id)
        if (val == null) return ""
        return String(val)
      }),
    )

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `jcn_screener_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [table])

  // Row click handler for context menu
  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, symbol: string) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, symbol })
    },
    [],
  )

  const handleRowClick = useCallback((_symbol: string) => {
    setContextMenu(null)
    // Single click → close any open context menu
    // Right-click opens the context menu with Analysis/Watchlist/Grok options
  }, [])

  // Group columns for the column picker
  const columnGroups = useMemo(() => {
    const groups: { label: string; cols: string[] }[] = [
      {
        label: "Basic",
        cols: [
          "symbol",
          "company_name",
          "gics_sector",
          "industry",
          "market_cap",
          "adjusted_close",
        ],
      },
      {
        label: "Performance",
        cols: [
          "daily_change_pct",
          "ytd_pct",
          "yoy_pct",
          "pct_below_52wk_high",
          "chan_range_pct",
          "week_52_high",
          "week_52_low",
        ],
      },
      {
        label: "Factor Scores",
        cols: [
          "value_score_composite",
          "quality_score_composite",
          "finstr_score_composite",
          "growth_score_composite",
          "momentum_score_composite",
        ],
      },
      {
        label: "JCN Blends",
        cols: [
          "jcn_full_composite",
          "jcn_qarp",
          "jcn_garp",
          "jcn_quality_momentum",
          "jcn_value_momentum",
          "jcn_growth_quality_momentum",
          "jcn_fortress",
          "jcn_alpha_trifecta",
        ],
      },
      {
        label: "Momentum Detail",
        cols: [
          "af_r3m",
          "af_r6m",
          "af_r9m",
          "af_r12m",
          "af_momentum",
          "fip_3m",
          "fip_6m",
          "fip_12m",
          "fip_score",
          "systemscore",
          "af_composite",
          "fip_composite",
          "sys_composite",
        ],
      },
      {
        label: "Valuation",
        cols: [
          "pe_ratio",
          "forward_pe",
          "peg_ratio",
          "price_book",
          "price_sales",
          "ev_ebitda",
          "dividend_yield",
          "beta",
        ],
      },
      {
        label: "Profitability",
        cols: [
          "gross_margin",
          "profit_margin",
          "operating_margin",
          "return_on_equity",
          "return_on_assets",
        ],
      },
      {
        label: "Growth",
        cols: ["revenue_growth", "earnings_growth"],
      },
      {
        label: "Fundamentals",
        cols: ["debt_to_equity", "current_ratio", "interest_coverage"],
      },
    ]
    // Only include groups that have columns in apiColumns
    return groups
      .map((g) => ({
        ...g,
        cols: g.cols.filter((c) => apiColumns.includes(c)),
      }))
      .filter((g) => g.cols.length > 0)
  }, [apiColumns])

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isLoading
            ? "Loading..."
            : error
              ? `Error: ${error}`
              : `${totalCount.toLocaleString()} stocks found · Showing ${data.length.toLocaleString()}`}
        </div>

        <div className="flex items-center gap-2">
          {/* Column Picker Toggle */}
          <div className="relative" ref={columnPickerRef}>
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              Columns
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                {columnGroups.map((group) => (
                  <div key={group.label} className="mb-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {group.label}
                    </div>
                    {group.cols.map((col) => {
                      const cfg = COLUMN_CONFIG[col]
                      const isVis = effectiveVisibility[col] !== false
                      return (
                        <label
                          key={col}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <input
                            type="checkbox"
                            checked={isVis}
                            onChange={() =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [col]: !isVis,
                              }))
                            }
                            className="h-3 w-3 rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-gray-700 dark:text-gray-300">
                            {cfg?.header ?? col}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CSV Export */}
          <button
            onClick={exportCSV}
            disabled={data.length === 0}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const cfg = COLUMN_CONFIG[header.column.id]
                  const isNumeric =
                    cfg?.format &&
                    ["pct", "score", "ratio", "currency", "bignum"].includes(
                      cfg.format,
                    )
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`cursor-pointer select-none whitespace-nowrap border-b border-gray-200 px-2 py-2 font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 ${
                        isNumeric ? "text-right" : "text-left"
                      }`}
                      style={{ width: header.getSize() }}
                    >
                      <div
                        className={`flex items-center gap-1 ${isNumeric ? "justify-end" : ""}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {{
                          asc: " ▲",
                          desc: " ▼",
                        }[header.column.getIsSorted() as string] ?? ""}
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
                  colSpan={table.getVisibleFlatColumns().length}
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
                    Loading screener data...
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={table.getVisibleFlatColumns().length}
                  className="py-12 text-center text-sm text-red-600 dark:text-red-400"
                >
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleFlatColumns().length}
                  className="py-12 text-center text-sm text-gray-500"
                >
                  No stocks match your filters. Try adjusting the criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                  onClick={() =>
                    handleRowClick(String(row.original.symbol ?? ""))
                  }
                  onContextMenu={(e) =>
                    handleRowContextMenu(e, String(row.original.symbol ?? ""))
                  }
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="border-b border-gray-100 px-3 py-1 text-xs font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
            {contextMenu.symbol}
          </div>
          <button
            onClick={() => {
              onCellClick?.(contextMenu.symbol, "analysis")
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 dark:text-gray-300 dark:hover:bg-blue-950"
          >
            <span>📈</span> Analysis
          </button>
          <button
            onClick={() => {
              onCellClick?.(contextMenu.symbol, "watchlist")
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 dark:text-gray-300 dark:hover:bg-blue-950"
          >
            <span>⭐</span> Add to Watchlist
          </button>
          <button
            disabled
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-400 dark:text-gray-600"
          >
            <span>🤖</span> Grok (Coming Soon)
          </button>
        </div>
      )}
    </div>
  )
}
