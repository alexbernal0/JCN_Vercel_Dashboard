"use client"

import React, { useState, useMemo } from "react"
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@tremor/react"
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline"

interface PortfolioPerformanceData {
  security: string
  ticker: string
  cost_basis: number
  current_price: number
  port_pct: number
  daily_change_pct: number
  ytd_pct: number
  yoy_pct: number
  port_gain_pct: number
  pct_below_52wk_high: number
  chan_range_pct: number
  sector: string
  industry: string
}

interface PortfolioPerformanceTableProps {
  data: PortfolioPerformanceData[]
  isLoading?: boolean
}

type SortField = keyof PortfolioPerformanceData | null
type SortDirection = "asc" | "desc"

// Ticker to company name mapping (all portfolios)
const TICKER_TO_COMPANY: Record<string, string> = {
  // Persistent Value
  SPMO: "Invesco S&P 500 Momentum ETF",
  ASML: "ASML Holding N.V.",
  MNST: "Monster Beverage Corporation",
  MSCI: "MSCI Inc.",
  COST: "Costco Wholesale Corporation",
  AVGO: "Broadcom Inc.",
  MA: "Mastercard Incorporated",
  FICO: "Fair Isaac Corporation",
  SPGI: "S&P Global Inc.",
  IDXX: "IDEXX Laboratories, Inc.",
  ISRG: "Intuitive Surgical, Inc.",
  V: "Visa Inc.",
  CAT: "Caterpillar Inc.",
  ORLY: "O'Reilly Automotive, Inc.",
  HEI: "HEICO Corporation",
  NFLX: "Netflix, Inc.",
  WM: "Waste Management, Inc.",
  TSLA: "Tesla, Inc.",
  AAPL: "Apple Inc.",
  LRCX: "Lam Research Corporation",
  TSM: "Taiwan Semiconductor Manufacturing",
  // Olivia Growth
  QGRW: "WisdomTree U.S. Quality Growth Fund",
  GOOG: "Alphabet Inc.",
  AMZN: "Amazon.com, Inc.",
  MELI: "MercadoLibre, Inc.",
  SPOT: "Spotify Technology S.A.",
  MU: "Micron Technology, Inc.",
  AMD: "Advanced Micro Devices, Inc.",
  CRWD: "CrowdStrike Holdings, Inc.",
  FTNT: "Fortinet, Inc.",
  META: "Meta Platforms, Inc.",
  NVDA: "NVIDIA Corporation",
  GEV: "GE Vernova Inc.",
  PWR: "Quanta Services, Inc.",
  CEG: "Constellation Energy Corporation",
  VST: "Vistra Corp.",
  SHOP: "Shopify Inc.",
  ANET: "Arista Networks, Inc.",
  CRCL: "Circle Internet Group, Inc.",
  AXON: "Axon Enterprise, Inc.",
  PLTR: "Palantir Technologies Inc.",
}

/**
 * Get color class for % Portfolio (position size heatmap)
 * Larger positions get warmer colors
 */
const getPortPctColor = (value: number): string => {
  if (value > 10) return "bg-blue-200"
  if (value > 7) return "bg-blue-100"
  if (value > 5) return "bg-blue-50"
  if (value > 3) return "bg-blue-25"
  return "bg-white"
}

/**
 * Get color class for Daily % Change (red to green heatmap)
 */
const getDailyChangeColor = (value: number): string => {
  if (value > 2) return "bg-green-200 text-green-900"
  if (value > 1) return "bg-green-100 text-green-800"
  if (value > 0) return "bg-green-50 text-green-700"
  if (value === 0) return "bg-white text-gray-900"
  if (value > -1) return "bg-red-50 text-red-700"
  if (value > -2) return "bg-red-100 text-red-800"
  return "bg-red-200 text-red-900"
}

/** Simple text-color helper for signed percentage values */
const getPctColor = (value: number): string => {
  if (value > 0) return "text-green-600 dark:text-green-400"
  if (value < 0) return "text-red-600 dark:text-red-400"
  return "text-gray-600 dark:text-gray-400"
}

export default function PortfolioPerformanceTable({
  data,
  isLoading = false,
}: PortfolioPerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // New field, default to descending
      setSortField(field)
      setSortDirection("desc")
    }
  }

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField) return data

    return [...data].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return 0
    })
  }, [data, sortField, sortDirection])

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? (
      <ArrowUpIcon className="ml-1 inline-block h-3 w-3" />
    ) : (
      <ArrowDownIcon className="ml-1 inline-block h-3 w-3" />
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Portfolio Performance Details
        </h3>
        {/* Refresh button removed - use main page refresh button */}
      </div>

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="hidden overflow-x-auto md:block">
        <Table className="compact-table">
          <TableHead>
            <TableRow className="text-xs">
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 hover:bg-gray-50"
                onClick={() => handleSort("security")}
              >
                <span className="text-xs">
                  Security {renderSortIcon("security")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 hover:bg-gray-50"
                onClick={() => handleSort("ticker")}
              >
                <span className="text-xs">
                  Ticker {renderSortIcon("ticker")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("cost_basis")}
              >
                <span className="text-xs">
                  Cost Basis {renderSortIcon("cost_basis")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("current_price")}
              >
                <span className="text-xs">
                  Cur Price {renderSortIcon("current_price")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("port_pct")}
              >
                <span className="text-xs">
                  % Port. {renderSortIcon("port_pct")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("daily_change_pct")}
              >
                <span className="text-xs">
                  Daily % Change {renderSortIcon("daily_change_pct")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("ytd_pct")}
              >
                <span className="text-xs">
                  YTD % {renderSortIcon("ytd_pct")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("yoy_pct")}
              >
                <span className="text-xs">
                  YoY % Change {renderSortIcon("yoy_pct")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("port_gain_pct")}
              >
                <span className="text-xs">
                  Port. Gain % {renderSortIcon("port_gain_pct")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("pct_below_52wk_high")}
              >
                <span className="text-xs">
                  % Below 52wk High {renderSortIcon("pct_below_52wk_high")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 text-right hover:bg-gray-50"
                onClick={() => handleSort("chan_range_pct")}
              >
                <span className="text-xs">
                  52wk Chan Range {renderSortIcon("chan_range_pct")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 hover:bg-gray-50"
                onClick={() => handleSort("sector")}
              >
                <span className="text-xs">
                  Sector {renderSortIcon("sector")}
                </span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer px-2 py-1.5 hover:bg-gray-50"
                onClick={() => handleSort("industry")}
              >
                <span className="text-xs">
                  Industry {renderSortIcon("industry")}
                </span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="py-6 text-center">
                  <span className="text-sm text-gray-500">
                    Loading portfolio data...
                  </span>
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="py-6 text-center text-sm text-gray-500"
                >
                  No portfolio data available
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, idx) => {
                const noData = row.sector === "No Data"
                return (
                  <TableRow
                    key={idx}
                    className={`text-xs ${noData ? "opacity-60" : ""}`}
                  >
                    {/* Security - Company Name */}
                    <TableCell className="bg-white px-2 py-1.5 font-medium text-gray-900">
                      {TICKER_TO_COMPANY[row.ticker] || row.security}
                      {noData && (
                        <span className="ml-1 text-[10px] text-amber-600">
                          (no market data)
                        </span>
                      )}
                    </TableCell>

                    {/* Ticker - Black text, white background */}
                    <TableCell className="bg-white px-2 py-1.5 font-medium text-gray-900">
                      {row.ticker}
                    </TableCell>

                    {/* Cost Basis - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-right text-gray-900">
                      ${row.cost_basis.toFixed(2)}
                    </TableCell>

                    {/* Current Price - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-right font-semibold text-gray-900">
                      ${row.current_price.toFixed(2)}
                    </TableCell>

                    {/* % Port - Heatmap for position size */}
                    <TableCell
                      className={`px-2 py-1.5 text-right ${getPortPctColor(row.port_pct)} text-gray-900`}
                    >
                      {row.port_pct.toFixed(2)}%
                    </TableCell>

                    {/* Daily % Change - Red to Green heatmap */}
                    <TableCell
                      className={`px-2 py-1.5 text-right font-medium ${getDailyChangeColor(row.daily_change_pct)}`}
                    >
                      {row.daily_change_pct > 0 ? "+" : ""}
                      {row.daily_change_pct.toFixed(2)}%
                    </TableCell>

                    {/* YTD % - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-right text-gray-900">
                      {row.ytd_pct > 0 ? "+" : ""}
                      {row.ytd_pct.toFixed(2)}%
                    </TableCell>

                    {/* YoY % Change - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-right text-gray-900">
                      {row.yoy_pct > 0 ? "+" : ""}
                      {row.yoy_pct.toFixed(2)}%
                    </TableCell>

                    {/* Port. Gain % - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-right text-gray-900">
                      {row.port_gain_pct > 0 ? "+" : ""}
                      {row.port_gain_pct.toFixed(2)}%
                    </TableCell>

                    {/* % Below 52wk High - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-right text-gray-900">
                      {row.pct_below_52wk_high.toFixed(2)}%
                    </TableCell>

                    {/* 52wk Chan Range - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-right text-gray-900">
                      {row.chan_range_pct.toFixed(1)}%
                    </TableCell>

                    {/* Sector - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-gray-900">
                      {row.sector}
                    </TableCell>

                    {/* Industry - White background */}
                    <TableCell className="bg-white px-2 py-1.5 text-gray-900">
                      {row.industry}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Mobile card list (hidden on desktop) ── */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading portfolio data...
          </div>
        ) : sortedData.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No portfolio data available
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {sortedData.map((row, idx) => {
              const noData = row.sector === "No Data"
              const companyName = TICKER_TO_COMPANY[row.ticker] || row.security
              const isExpanded = expandedTicker === row.ticker
              const toggle = () =>
                setExpandedTicker(isExpanded ? null : row.ticker)

              return (
                <div key={idx} className={`${noData ? "opacity-60" : ""}`}>
                  {/* Collapsed row — always visible */}
                  <button
                    onClick={toggle}
                    className="flex w-full items-center justify-between px-3 py-3 text-left active:bg-gray-50 dark:active:bg-gray-800"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {row.ticker}
                      </span>
                      <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {companyName}
                      </span>
                      {noData && (
                        <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">
                          (no data)
                        </span>
                      )}
                    </div>
                    <div className="ml-2 flex flex-shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        ${row.current_price.toFixed(2)}
                      </span>
                      <span
                        className={`text-xs font-medium ${getPctColor(row.daily_change_pct)}`}
                      >
                        {row.daily_change_pct > 0 ? "+" : ""}
                        {row.daily_change_pct.toFixed(2)}%
                      </span>
                      {/* Chevron */}
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform dark:text-gray-500 ${isExpanded ? "rotate-180" : ""}`}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-gray-100 px-3 pb-3 pt-2 text-xs dark:border-gray-800">
                      <div className="text-gray-500 dark:text-gray-400">
                        Cost Basis
                      </div>
                      <div className="text-right text-gray-900 dark:text-gray-100">
                        ${row.cost_basis.toFixed(2)}
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        % Portfolio
                      </div>
                      <div className="text-right text-gray-900 dark:text-gray-100">
                        {row.port_pct.toFixed(2)}%
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        YTD %
                      </div>
                      <div
                        className={`text-right font-medium ${getPctColor(row.ytd_pct)}`}
                      >
                        {row.ytd_pct > 0 ? "+" : ""}
                        {row.ytd_pct.toFixed(2)}%
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        YoY %
                      </div>
                      <div
                        className={`text-right font-medium ${getPctColor(row.yoy_pct)}`}
                      >
                        {row.yoy_pct > 0 ? "+" : ""}
                        {row.yoy_pct.toFixed(2)}%
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        Port. Gain %
                      </div>
                      <div
                        className={`text-right font-medium ${getPctColor(row.port_gain_pct)}`}
                      >
                        {row.port_gain_pct > 0 ? "+" : ""}
                        {row.port_gain_pct.toFixed(2)}%
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        % Below 52wk High
                      </div>
                      <div className="text-right text-gray-900 dark:text-gray-100">
                        {row.pct_below_52wk_high.toFixed(2)}%
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        52wk Chan Range
                      </div>
                      <div className="text-right text-gray-900 dark:text-gray-100">
                        {row.chan_range_pct.toFixed(1)}%
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        Sector
                      </div>
                      <div className="text-right text-gray-900 dark:text-gray-100">
                        {row.sector}
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        Industry
                      </div>
                      <div className="truncate text-right text-gray-900 dark:text-gray-100">
                        {row.industry}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer summary — both views */}
      {!isLoading && sortedData.length > 0 && (
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
          Showing {sortedData.length} positions
        </div>
      )}

      {/* Custom CSS for even more compact table */}
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
  )
}
