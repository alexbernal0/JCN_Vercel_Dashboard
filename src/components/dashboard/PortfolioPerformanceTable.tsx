"use client";

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Button
} from '@tremor/react';
import { ArrowUpIcon, ArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

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
  onRefresh?: () => void;
}

type SortField = keyof PortfolioPerformanceData | null;
type SortDirection = 'asc' | 'desc';

/**
 * Get color class based on percentage value (for heatmap)
 */
const getPercentageColor = (value: number): string => {
  if (value > 10) return 'bg-green-100 text-green-900';
  if (value > 5) return 'bg-green-50 text-green-800';
  if (value > 0) return 'bg-green-25 text-green-700';
  if (value > -5) return 'bg-red-25 text-red-700';
  if (value > -10) return 'bg-red-50 text-red-800';
  return 'bg-red-100 text-red-900';
};

/**
 * Get color class for 52-week channel range (0-100%)
 */
const getChanRangeColor = (value: number): string => {
  if (value > 80) return 'bg-green-100 text-green-900';
  if (value > 60) return 'bg-green-50 text-green-800';
  if (value > 40) return 'bg-yellow-50 text-yellow-800';
  if (value > 20) return 'bg-orange-50 text-orange-800';
  return 'bg-red-100 text-red-900';
};

/**
 * Get color class for % below 52-week high
 */
const getBelow52wkColor = (value: number): string => {
  if (value < 5) return 'bg-green-100 text-green-900';
  if (value < 10) return 'bg-green-50 text-green-800';
  if (value < 20) return 'bg-yellow-50 text-yellow-800';
  if (value < 30) return 'bg-orange-50 text-orange-800';
  return 'bg-red-100 text-red-900';
};

export default function PortfolioPerformanceTable({
  data,
  isLoading = false,
  onRefresh
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
      <ArrowUpIcon className="inline-block w-4 h-4 ml-1" />
    ) : (
      <ArrowDownIcon className="inline-block w-4 h-4 ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Portfolio Performance Details
        </h3>
        {onRefresh && (
          <Button
            size="xs"
            variant="secondary"
            icon={ArrowPathIcon}
            onClick={onRefresh}
            loading={isLoading}
          >
            Refresh Data
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('security')}
              >
                Security {renderSortIcon('security')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('ticker')}
              >
                Ticker {renderSortIcon('ticker')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('cost_basis')}
              >
                Cost Basis {renderSortIcon('cost_basis')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('current_price')}
              >
                Cur Price {renderSortIcon('current_price')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('port_pct')}
              >
                % Port. {renderSortIcon('port_pct')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('daily_change_pct')}
              >
                Daily % Change {renderSortIcon('daily_change_pct')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('ytd_pct')}
              >
                YTD % {renderSortIcon('ytd_pct')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('yoy_pct')}
              >
                YoY % Change {renderSortIcon('yoy_pct')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('port_gain_pct')}
              >
                Port. Gain % {renderSortIcon('port_gain_pct')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('pct_below_52wk_high')}
              >
                % Below 52wk High {renderSortIcon('pct_below_52wk_high')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('chan_range_pct')}
              >
                52wk Chan Range {renderSortIcon('chan_range_pct')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('sector')}
              >
                Sector {renderSortIcon('sector')}
              </TableHeaderCell>
              <TableHeaderCell
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('industry')}
              >
                Industry {renderSortIcon('industry')}
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-500">Loading portfolio data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                  No portfolio data available
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{row.security}</TableCell>
                  <TableCell>
                    <Badge color="gray">{row.ticker}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ${row.cost_basis.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${row.current_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.port_pct.toFixed(2)}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getPercentageColor(row.daily_change_pct)}`}
                  >
                    {row.daily_change_pct > 0 ? '+' : ''}
                    {row.daily_change_pct.toFixed(2)}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getPercentageColor(row.ytd_pct)}`}
                  >
                    {row.ytd_pct > 0 ? '+' : ''}
                    {row.ytd_pct.toFixed(2)}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getPercentageColor(row.yoy_pct)}`}
                  >
                    {row.yoy_pct > 0 ? '+' : ''}
                    {row.yoy_pct.toFixed(2)}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getPercentageColor(row.port_gain_pct)}`}
                  >
                    {row.port_gain_pct > 0 ? '+' : ''}
                    {row.port_gain_pct.toFixed(2)}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getBelow52wkColor(row.pct_below_52wk_high)}`}
                  >
                    {row.pct_below_52wk_high.toFixed(2)}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getChanRangeColor(row.chan_range_pct)}`}
                  >
                    {row.chan_range_pct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-sm">{row.sector}</TableCell>
                  <TableCell className="text-sm">{row.industry}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer summary */}
      {!isLoading && sortedData.length > 0 && (
        <div className="text-sm text-gray-500 text-right">
          Showing {sortedData.length} positions
        </div>
      )}
    </div>
  );
}
