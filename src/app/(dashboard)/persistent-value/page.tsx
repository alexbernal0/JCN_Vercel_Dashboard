"use client";

import { useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR, { mutate } from 'swr'
import { PortfolioInput } from '@/components/dashboard/PortfolioInput'
import PortfolioPerformanceTable from '@/components/dashboard/PortfolioPerformanceTable'
import Benchmarks from '@/components/dashboard/Benchmarks'
import PortfolioAllocation from '@/components/dashboard/PortfolioAllocation'
import StockPriceComparison from '@/components/dashboard/StockPriceComparison'
import PortfolioFundamentalsTable from '@/components/dashboard/PortfolioFundamentalsTable'
import PortfolioAggregatedMetricsTable from '@/components/dashboard/PortfolioAggregatedMetricsTable'
import PortfolioQualityRadarCharts from '@/components/dashboard/PortfolioQualityRadarCharts'
import PortfolioTrendsErrorBoundary from '@/components/dashboard/PortfolioTrendsErrorBoundary'

const PortfolioTrendsCharts = dynamic(
  () => import('@/components/dashboard/PortfolioTrendsCharts'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Portfolio Trends</h3>
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading trend charts…</p>
        </div>
      </div>
    ),
  },
)

// Default portfolio holdings
const DEFAULT_HOLDINGS = [
  { symbol: 'SPMO', costBasis: 97.40, shares: 14301 },
  { symbol: 'ASML', costBasis: 660.32, shares: 1042 },
  { symbol: 'MNST', costBasis: 50.00, shares: 8234 },
  { symbol: 'MSCI', costBasis: 595.23, shares: 2016 },
  { symbol: 'COST', costBasis: 655.21, shares: 798 },
  { symbol: 'AVGO', costBasis: 138.00, shares: 6088 },
  { symbol: 'MA', costBasis: 418.76, shares: 1389 },
  { symbol: 'FICO', costBasis: 1850.00, shares: 778 },
  { symbol: 'SPGI', costBasis: 427.93, shares: 1554 },
  { symbol: 'IDXX', costBasis: 378.01, shares: 1570 },
  { symbol: 'ISRG', costBasis: 322.50, shares: 2769 },
  { symbol: 'V', costBasis: 276.65, shares: 2338 },
  { symbol: 'CAT', costBasis: 287.70, shares: 1356 },
  { symbol: 'ORLY', costBasis: 91.00, shares: 4696 },
  { symbol: 'HEI', costBasis: 172.00, shares: 1804 },
  { symbol: 'NFLX', costBasis: 80.82, shares: 10083 },
  { symbol: 'WM', costBasis: 177.77, shares: 5000 },
  { symbol: 'TSLA', costBasis: 270.00, shares: 5022 },
  { symbol: 'AAPL', costBasis: 181.40, shares: 2865 },
  { symbol: 'LRCX', costBasis: 73.24, shares: 18667 },
  { symbol: 'TSM', costBasis: 99.61, shares: 5850 },
];

// Custom fetcher for POST requests with body
const portfolioFetcher = async ([url, holdings]: [string, any[]]) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      holdings: holdings.map(h => ({
        symbol: h.symbol,
        cost_basis: h.costBasis,
        shares: h.shares
      }))
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
};

export default function PersistentValuePage() {
  const [currentHoldings, setCurrentHoldings] = useState(DEFAULT_HOLDINGS);

  // Stable key for SWR: same symbols => same key (avoid refetch on every render)
  const perfKey = currentHoldings.length
    ? ['/api/portfolio/performance?force_refresh=false', currentHoldings]
    : null;

  const { data, error: perfError, isLoading } = useSWR(
    perfKey,
    portfolioFetcher,
    {
      revalidateOnMount: true,
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const portfolioData = data?.data ?? [];
  const lastUpdated = data?.last_updated
    ? new Date(data.last_updated).toLocaleString()
    : '--';

  // Handle refresh button - revalidate all three modules (mutate the same keys components use so they refetch)
  const handleRefresh = async () => {
    const symbolsStr = currentHoldings.map(h => h.symbol).sort().join(',');
    await Promise.all([
      mutate(['/api/portfolio/performance?force_refresh=false', currentHoldings]),
      mutate(['/api/benchmarks?force_refresh=false', symbolsStr]),
      mutate(['/api/portfolio/allocation', symbolsStr]),
    ]);
  };

  // Handle portfolio save
  const handlePortfolioSave = (holdings: any[]) => {
    console.log('Portfolio saved:', holdings);
    setCurrentHoldings(holdings);
    // SWR will automatically refetch with new holdings
  };

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr_auto] md:items-start">
          {/* Logo */}
          <div className="h-24 w-24 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-gray-800" />
          
          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              📊 Persistent Value Portfolio
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Value-focused investment strategy with long-term growth potential
            </p>
          </div>

          {/* Refresh Button */}
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleRefresh}
              disabled={isLoading}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isLoading ? '⏳ Loading...' : '🔄 Refresh Data'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdated}
            </p>
          </div>
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Portfolio Performance Details Table */}
        <div className="mb-8">
          {perfError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              Failed to load portfolio performance: {perfError.message}. Check that the API is running and MOTHERDUCK_TOKEN is set.
            </div>
          )}
          <PortfolioPerformanceTable 
            data={portfolioData}
            isLoading={isLoading}
          />
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Benchmarks Section - uses same user symbols from currentHoldings */}
        <div className="mb-8">
          <Benchmarks 
            holdings={currentHoldings.map(h => ({
              symbol: h.symbol,
              cost_basis: h.costBasis,
              shares: h.shares
            }))}
          />
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Portfolio Allocation Section - uses same user symbols from currentHoldings */}
        <div className="mb-8">
          <PortfolioAllocation 
            portfolio={currentHoldings.map(h => ({
              symbol: h.symbol,
              cost_basis: h.costBasis,
              shares: h.shares
            }))}
          />
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Stock Price Comparison Section */}
        <div className="mb-8">
          <StockPriceComparison 
            symbols={currentHoldings.map(h => h.symbol)}
          />
        </div>

        {/* Portfolio Fundamentals – OBQ + Momentum scores */}
        <PortfolioFundamentalsTable symbols={currentHoldings.map(h => h.symbol)} />

        {/* Portfolio Aggregated Metrics – Max / Median / Average / Min across 5 scores */}
        <PortfolioAggregatedMetricsTable symbols={currentHoldings.map(h => h.symbol)} />

        {/* Portfolio Quality Radar Charts – one radar per stock, 5 scores */}
        <PortfolioQualityRadarCharts symbols={currentHoldings.map(h => h.symbol)} />

        {/* Portfolio Trends – dynamic import (ssr:false) + error boundary */}
        <div className="mt-8">
          <PortfolioTrendsErrorBoundary>
            <PortfolioTrendsCharts symbols={currentHoldings.map(h => h.symbol)} />
          </PortfolioTrendsErrorBoundary>
        </div>
      </div>

      {/* Portfolio Input - Fixed at bottom */}
      <PortfolioInput 
        initialHoldings={DEFAULT_HOLDINGS}
        onSave={handlePortfolioSave}
      />
    </div>
  )
}
