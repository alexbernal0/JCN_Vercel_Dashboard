"use client";

import { useState, useEffect, useCallback } from 'react'
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

// Default portfolio holdings - Olivia Growth
const DEFAULT_HOLDINGS = [
  { symbol: 'QGRW', costBasis: 50.50, shares: 37952 },
  { symbol: 'GOOG', costBasis: 137.21, shares: 12788 },
  { symbol: 'AMZN', costBasis: 145.09, shares: 12844 },
  { symbol: 'MELI', costBasis: 1545.00, shares: 1555 },
  { symbol: 'SPOT', costBasis: 698.00, shares: 2247 },
  { symbol: 'MU', costBasis: 396.93, shares: 4486 },
  { symbol: 'AMD', costBasis: 214.00, shares: 5806 },
  { symbol: 'CRWD', costBasis: 248.42, shares: 4185 },
  { symbol: 'FTNT', costBasis: 58.48, shares: 13547 },
  { symbol: 'META', costBasis: 589.00, shares: 1836 },
  { symbol: 'NVDA', costBasis: 50.00, shares: 13385 },
  { symbol: 'GEV', costBasis: 660.00, shares: 1794 },
  { symbol: 'PWR', costBasis: 430.00, shares: 2762 },
  { symbol: 'CEG', costBasis: 291.47, shares: 4867 },
  { symbol: 'VST', costBasis: 160.90, shares: 7391 },
  { symbol: 'SHOP', costBasis: 74.18, shares: 15104 },
  { symbol: 'ANET', costBasis: 57.62, shares: 8697 },
  { symbol: 'CRCL', costBasis: 78.01, shares: 17378 },
  { symbol: 'AXON', costBasis: 520.00, shares: 3010 },
  { symbol: 'PLTR', costBasis: 39.00, shares: 6820 },
];

// localStorage cache helpers (24-hour TTL)
const LS_PERF_KEY = 'jcn_olivia_perf_cache';
const LS_LIVE_KEY = 'jcn_olivia_live_cache';
const LS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LIVE_PRICE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function lsGet(key: string, ttl: number = LS_TTL_MS): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed._ts ?? 0) > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function lsSet(key: string, payload: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ payload, _ts: Date.now() }));
  } catch {
    // localStorage full or unavailable
  }
}

// Custom fetcher for POST requests with localStorage write-through
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

  const data = await response.json();
  lsSet(LS_PERF_KEY, data);
  return data;
};

export default function OliviaGrowthPage() {
  const [currentHoldings, setCurrentHoldings] = useState(DEFAULT_HOLDINGS);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [livePricesLoading, setLivePricesLoading] = useState(false);

  // Hydrate from localStorage for instant render (SSR-safe)
  const cachedPerf = typeof window !== 'undefined' ? lsGet(LS_PERF_KEY) : null;

  // Stable key for SWR
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
      fallbackData: cachedPerf || undefined,
    }
  );

  const portfolioData = data?.data ?? [];
  const lastUpdated = data?.last_updated
    ? new Date(data.last_updated).toLocaleString()
    : '--';

  // Fetch live/delayed prices from EODHD (~500ms, cached 15 min)
  const fetchLivePrices = useCallback(async (force = false) => {
    if (!currentHoldings.length) return;
    // Check 15-minute localStorage cache unless forced (Refresh button)
    if (!force) {
      const cached = lsGet(LS_LIVE_KEY, LIVE_PRICE_TTL_MS);
      if (cached && cached.prices) {
        setLivePrices(cached.prices);
        return;
      }
    }
    const symbols = currentHoldings.map(h => h.symbol).join(',');
    setLivePricesLoading(true);
    try {
      const res = await fetch(`/api/prices/live?symbols=${symbols}`);
      if (res.ok) {
        const json = await res.json();
        if (json.prices) {
          setLivePrices(json.prices);
          lsSet(LS_LIVE_KEY, { prices: json.prices });
        }
      }
    } catch {
      // Live price fetch failed - keep stale data
    } finally {
      setLivePricesLoading(false);
    }
  }, [currentHoldings]);

  useEffect(() => {
    fetchLivePrices();
  }, [fetchLivePrices]);

  // Merge live EODHD prices into portfolio data
  const portfolioDataWithLive = portfolioData.map((row: any) => {
    const live = livePrices[row.ticker];
    if (live && live > 0) {
      return { ...row, current_price: live };
    }
    return row;
  });

  const handleRefresh = async () => {
    const symbolsStr = currentHoldings.map(h => h.symbol).sort().join(',');
    await Promise.all([
      mutate(['/api/portfolio/performance?force_refresh=false', currentHoldings]),
      mutate(['/api/benchmarks?force_refresh=false', symbolsStr]),
      mutate(['/api/portfolio/allocation', symbolsStr]),
      fetchLivePrices(true),
    ]);
  };

  const handlePortfolioSave = (holdings: any[]) => {
    console.log('Portfolio saved:', holdings);
    setCurrentHoldings(holdings);
    setLivePrices({});
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
              Olivia Growth Portfolio
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Growth-focused investment strategy with high-conviction positions
            </p>
          </div>

          {/* Refresh Button + Live Status */}
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleRefresh}
              disabled={isLoading && !cachedPerf}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isLoading && !cachedPerf ? 'Loading...' : 'Refresh Data'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdated}
            </p>
            {livePricesLoading && (
              <p className="text-xs text-blue-500 dark:text-blue-400">Fetching live prices...</p>
            )}
            {Object.keys(livePrices).length > 0 && !livePricesLoading && (
              <p className="text-xs text-green-600 dark:text-green-400">Live prices active</p>
            )}
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
            data={portfolioDataWithLive}
            isLoading={isLoading && !cachedPerf}
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

        {/* Portfolio Fundamentals */}
        <PortfolioFundamentalsTable symbols={currentHoldings.map(h => h.symbol)} />

        {/* Portfolio Aggregated Metrics */}
        <PortfolioAggregatedMetricsTable symbols={currentHoldings.map(h => h.symbol)} />

        {/* Portfolio Quality Radar Charts */}
        <PortfolioQualityRadarCharts symbols={currentHoldings.map(h => h.symbol)} />

        {/* Portfolio Trends */}
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