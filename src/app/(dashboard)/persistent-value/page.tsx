"use client";

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { PortfolioInput } from '@/components/dashboard/PortfolioInput'
import PortfolioPerformanceTable from '@/components/dashboard/PortfolioPerformanceTable'
import Benchmarks from '@/components/dashboard/Benchmarks'
import PortfolioAllocation from '@/components/dashboard/PortfolioAllocation'
import StockPriceComparison from '@/components/dashboard/StockPriceComparison'

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

  // Use SWR for automatic caching and revalidation
  const { data, isLoading } = useSWR(
    ['/api/portfolio/performance?force_refresh=false', currentHoldings],
    portfolioFetcher,
    {
      // Keep data in cache and show it instantly on return
      revalidateOnMount: true,
      dedupingInterval: 60000, // 60 seconds
      // Don't revalidate automatically - only on manual refresh
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const portfolioData = data?.data || [];
  const lastUpdated = data?.last_updated 
    ? new Date(data.last_updated).toLocaleString() 
    : '--';

  // Handle refresh button - force revalidate all data
  const handleRefresh = async () => {
    // Revalidate both portfolio and benchmarks data
    await mutate(['/api/portfolio/performance?force_refresh=true', currentHoldings]);
    await mutate(['/api/portfolio/benchmarks?force_refresh=true', currentHoldings]);
    
    // Force a fresh fetch
    window.location.reload();
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
          <PortfolioPerformanceTable 
            data={portfolioData}
            isLoading={isLoading}
          />
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Benchmarks Section */}
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

        {/* Portfolio Allocation Section */}
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

        {/* Holdings Table */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Portfolio Holdings
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">Ticker</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-50">Company</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-50">Shares</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-50">Price</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-50">Value</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-50">Gain/Loss</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-50">Daily %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Loading portfolio data...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Portfolio Allocation */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            📊 Portfolio Allocation
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pie chart placeholders */}
            <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-gray-500 dark:text-gray-400">Allocation by Stock</p>
            </div>
            <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-gray-500 dark:text-gray-400">Allocation by Sector</p>
            </div>
          </div>
        </div>

        {/* Price Comparison Chart */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            📊 Normalized Stock Price Comparison
          </h2>
          
          {/* Time period selector */}
          <div className="mb-4 flex flex-wrap gap-2">
            {['1 Month', '3 Months', '6 Months', '1 Year', '5 Years', '10 Years', '20 Years'].map((period) => (
              <button
                key={period}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              >
                {period}
              </button>
            ))}
          </div>

          {/* Chart placeholder */}
          <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">Price Comparison Chart</p>
          </div>
        </div>

        {/* Fundamental Metrics */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            📊 Fundamental Metrics
          </h2>
          
          {/* Metric selector buttons */}
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-7">
            {['P/E Ratio', 'P/B Ratio', 'Dividend Yield', 'ROE', 'Debt/Equity', 'Revenue Growth', 'Profit Margin'].map((metric) => (
              <button
                key={metric}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              >
                {metric}
              </button>
            ))}
          </div>

          {/* Chart placeholder */}
          <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">Fundamental Metrics Chart</p>
          </div>
        </div>

        {/* Quality Radar Chart */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            📊 Quality Metrics Radar
          </h2>
          <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">Quality Radar Chart</p>
          </div>
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
