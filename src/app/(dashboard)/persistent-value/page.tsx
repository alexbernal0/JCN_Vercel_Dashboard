'use client'

import { MetricCard } from '@/components/dashboard/MetricCard'

export default function PersistentValuePage() {
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
            <button className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
              🔄 Refresh Data
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: --
            </p>
          </div>
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Metrics Section */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <MetricCard 
            title="Portfolio Est. Daily % Change" 
            value="+0.00%" 
            trend="neutral"
          />
          <MetricCard 
            title="Benchmark Est. Daily % Change" 
            value="+0.00%" 
            trend="neutral"
          />
          <MetricCard 
            title="Est. Daily Alpha" 
            value="+0.00%" 
            trend="neutral"
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

        {/* Benchmarks Section */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            📊 Benchmarks
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <MetricCard 
              title="Portfolio Est. Daily % Change" 
              value="+0.00%" 
              trend="neutral"
            />
            <MetricCard 
              title="Benchmark Est. Daily % Change" 
              value="+0.00%" 
              trend="neutral"
            />
            <MetricCard 
              title="Est. Daily Alpha" 
              value="+0.00%" 
              trend="neutral"
            />
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
    </div>
  )
}
