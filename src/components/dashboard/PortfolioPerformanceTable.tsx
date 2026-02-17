"use client";

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Button
} from '@tremor/react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

interface PortfolioPerformanceData {
  security: string;
  ticker: string;
  cost_basis: number;
  current_price: number;
  port_pct: number;
  daily_change_pct: number;
  ytd_pct: number;
  yoy_pct: number;
  port_gain_pct: number;
  pct_below_52wk_high: number;
  chan_range_pct: number;
  sector: string;
  industry: string;
}

interface PortfolioPerformanceTableProps {
  data: PortfolioPerformanceData[];
  isLoading?: boolean;
}

type SortField = keyof PortfolioPerformanceData | null;
type SortDirection = 'asc' | 'desc';

// Ticker to company name mapping
const TICKER_TO_COMPANY: Record<string, string> = {
  'SPMO': 'Invesco S&P 500 Momentum ETF',
  'ASML': 'ASML Holding N.V.',
  'MNST': 'Monster Beverage Corporation',
  'MSCI': 'MSCI Inc.',
  'COST': 'Costco Wholesale Corporation',
  'AVGO': 'Broadcom Inc.',
  'MA': 'Mastercard Incorporated',
  'FICO': 'Fair Isaac Corporation',
  'SPGI': 'S&P Global Inc.',
  'IDXX': 'IDEXX Laboratories, Inc.',
  'ISRG': 'Intuitive Surgical, Inc.',
  'V': 'Visa Inc.',
  'CAT': 'Caterpillar Inc.',
  'ORLY': "O'Reilly Automotive, Inc.",
  'HEI': 'HEICO Corporation',
  'NFLX': 'Netflix, Inc.',
  'WM': 'Waste Management, Inc.',
  'TSLA': 'Tesla, Inc.',
  'AAPL': 'Apple Inc.',
  'LRCX': 'Lam Research Corporation',
  'TSM': 'Taiwan Semiconductor Manufacturing'
};

/**
 * Get color class for % Portfolio (position size heatmap)
 * Larger positions get warmer colors
 */
const getPortPctColor = (value: number): string => {
  if (value > 10) return 'bg-blue-200';
  if (value > 7) return 'bg-blue-100';
  if (value > 5) return 'bg-blue-50';
  if (value > 3) return 'bg-blue-25';
  return 'bg-white';
};

/**
 * Get color class for Daily % Change (red to green heatmap)
 */
const getDailyChangeColor = (value: number): string => {
  if (value > 2) return 'bg-green-200 text-green-900';
  if (value > 1) return 'bg-green-100 text-green-800';
  if (value > 0) return 'bg-green-50 text-green-700';
  if (value === 0) return 'bg-white text-gray-900';
  if (value > -1) return 'bg-red-50 text-red-700';
  if (value > -2) return 'bg-red-100 text-red-800';
  return 'bg-red-200 text-red-900';
};

export default function PortfolioPerformanceTable({
  data,
  isLoading = false
}: PortfolioPerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  }, [data, sortField, sortDirection]);

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUpIcon className="inline-block w-3 h-3 ml-1" />
    ) : (
      <ArrowDownIcon className="inline-block w-3 h-3 ml-1" />
    );
  };

  return (
    <div className="space-y-3">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-gray-900">
          Portfolio Performance Details
        </h3>
        {/* Refresh button removed - use main page refresh button */}
      </div>

      {/* Compact Table */}
      <div className="overflow-x-auto">
        <Table className="compact-table">
          <TableHead>
            <TableRow className="text-xs">
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 py-1.5 px-2"
                onClick={() => handleSort('security')}
              >
                <span className="text-xs">Security {renderSortIcon('security')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 py-1.5 px-2"
                onClick={() => handleSort('ticker')}
              >
                <span className="text-xs">Ticker {renderSortIcon('ticker')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('cost_basis')}
              >
                <span className="text-xs">Cost Basis {renderSortIcon('cost_basis')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('current_price')}
              >
                <span className="text-xs">Cur Price {renderSortIcon('current_price')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('port_pct')}
              >
                <span className="text-xs">% Port. {renderSortIcon('port_pct')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('daily_change_pct')}
              >
                <span className="text-xs">Daily % Change {renderSortIcon('daily_change_pct')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('ytd_pct')}
              >
                <span className="text-xs">YTD % {renderSortIcon('ytd_pct')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('yoy_pct')}
              >
                <span className="text-xs">YoY % Change {renderSortIcon('yoy_pct')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('port_gain_pct')}
              >
                <span className="text-xs">Port. Gain % {renderSortIcon('port_gain_pct')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('pct_below_52wk_high')}
              >
                <span className="text-xs">% Below 52wk High {renderSortIcon('pct_below_52wk_high')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right py-1.5 px-2"
                onClick={() => handleSort('chan_range_pct')}
              >
                <span className="text-xs">52wk Chan Range {renderSortIcon('chan_range_pct')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 py-1.5 px-2"
                onClick={() => handleSort('sector')}
              >
                <span className="text-xs">Sector {renderSortIcon('sector')}</span>
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 py-1.5 px-2"
                onClick={() => handleSort('industry')}
              >
                <span className="text-xs">Industry {renderSortIcon('industry')}</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-6">
                  <span className="text-gray-500 text-sm">Loading portfolio data...</span>
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-6 text-gray-500 text-sm">
                  No portfolio data available
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, idx) => (
                <TableRow key={idx} className="text-xs">
                  {/* Security - Company Name */}
                  <TableCell className="font-medium py-1.5 px-2 bg-white text-gray-900">
                    {TICKER_TO_COMPANY[row.ticker] || row.security}
                  </TableCell>
                  
                  {/* Ticker - Black text, white background */}
                  <TableCell className="py-1.5 px-2 bg-white text-gray-900 font-medium">
                    {row.ticker}
                  </TableCell>
                  
                  {/* Cost Basis - White background */}
                  <TableCell className="text-right py-1.5 px-2 bg-white text-gray-900">
                    ${row.cost_basis.toFixed(2)}
                  </TableCell>
                  
                  {/* Current Price - White background */}
                  <TableCell className="text-right font-semibold py-1.5 px-2 bg-white text-gray-900">
                    ${row.current_price.toFixed(2)}
                  </TableCell>
                  
                  {/* % Port - Heatmap for position size */}
                  <TableCell className={`text-right py-1.5 px-2 ${getPortPctColor(row.port_pct)} text-gray-900`}>
                    {row.port_pct.toFixed(2)}%
                  </TableCell>
                  
                  {/* Daily % Change - Red to Green heatmap */}
                  <TableCell
                    className={`text-right font-medium py-1.5 px-2 ${getDailyChangeColor(row.daily_change_pct)}`}
                  >
                    {row.daily_change_pct > 0 ? '+' : ''}
                    {row.daily_change_pct.toFixed(2)}%
                  </TableCell>
                  
                  {/* YTD % - White background */}
                  <TableCell className="text-right py-1.5 px-2 bg-white text-gray-900">
                    {row.ytd_pct > 0 ? '+' : ''}
                    {row.ytd_pct.toFixed(2)}%
                  </TableCell>
                  
                  {/* YoY % Change - White background */}
                  <TableCell className="text-right py-1.5 px-2 bg-white text-gray-900">
                    {row.yoy_pct > 0 ? '+' : ''}
                    {row.yoy_pct.toFixed(2)}%
                  </TableCell>
                  
                  {/* Port. Gain % - White background */}
                  <TableCell className="text-right py-1.5 px-2 bg-white text-gray-900">
                    {row.port_gain_pct > 0 ? '+' : ''}
                    {row.port_gain_pct.toFixed(2)}%
                  </TableCell>
                  
                  {/* % Below 52wk High - White background */}
                  <TableCell className="text-right py-1.5 px-2 bg-white text-gray-900">
                    {row.pct_below_52wk_high.toFixed(2)}%
                  </TableCell>
                  
                  {/* 52wk Chan Range - White background */}
                  <TableCell className="text-right py-1.5 px-2 bg-white text-gray-900">
                    {row.chan_range_pct.toFixed(1)}%
                  </TableCell>
                  
                  {/* Sector - White background */}
                  <TableCell className="py-1.5 px-2 bg-white text-gray-900">
                    {row.sector}
                  </TableCell>
                  
                  {/* Industry - White background */}
                  <TableCell className="py-1.5 px-2 bg-white text-gray-900">
                    {row.industry}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer summary */}
      {!isLoading && sortedData.length > 0 && (
        <div className="text-xs text-gray-500 text-right">
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
  );
}
