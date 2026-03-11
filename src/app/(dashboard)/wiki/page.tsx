"use client"

import { useState, useEffect } from "react"

// ---------------------------------------------------------------------------
// Table of Contents structure
// ---------------------------------------------------------------------------
interface TocItem {
  id: string
  label: string
  children?: TocItem[]
}

const TOC: TocItem[] = [
  {
    id: "overview",
    label: "Overview",
    children: [
      { id: "what-is-jcn", label: "What is JCN Financial?" },
      { id: "tech-stack", label: "Technology Stack" },
      { id: "architecture", label: "Architecture" },
    ],
  },
  {
    id: "pages",
    label: "Dashboard Pages",
    children: [
      { id: "page-dashboard", label: "Dashboard (Heatmap)" },
      { id: "page-persistent-value", label: "Persistent Value" },
      { id: "page-olivia-growth", label: "Olivia Growth" },
      { id: "page-pure-alpha", label: "Pure Alpha" },
      { id: "page-stock-analysis", label: "Stock Analysis" },
      { id: "page-screener", label: "Stock Screener" },
      { id: "page-watchlist", label: "Watchlist" },
      { id: "page-data-sync", label: "Data Sync" },
    ],
  },
  {
    id: "portfolio-metrics",
    label: "Portfolio Metrics",
    children: [
      { id: "metric-performance", label: "Performance Table" },
      { id: "metric-allocation", label: "Allocation" },
      { id: "metric-benchmarks", label: "Benchmarks & Alpha" },
      { id: "metric-scores", label: "JCN Factor Scores" },
    ],
  },
  {
    id: "stock-analysis-metrics",
    label: "Stock Analysis Metrics",
    children: [
      { id: "sa-per-share", label: "Per Share Data" },
      { id: "sa-quality-metrics", label: "Quality Metrics" },
      { id: "sa-financial-statements", label: "Financial Statements" },
      { id: "sa-growth-rates", label: "Growth Rates" },
      { id: "sa-valuation", label: "Valuation Ratios" },
      { id: "sa-jcn-scores", label: "JCN Factor Scores" },
    ],
  },
  {
    id: "jcn-methodology",
    label: "JCN Score Methodology",
    children: [
      { id: "jcn-investable-universe", label: "Investable Universe" },
      { id: "jcn-3way-scoring", label: "3-Way Scoring System" },
      { id: "jcn-value-score", label: "Value Score" },
      { id: "jcn-quality-score", label: "Quality Score" },
      { id: "jcn-growth-score", label: "Growth Score" },
      { id: "jcn-finstr-score", label: "Financial Strength" },
      { id: "jcn-momentum-score", label: "Momentum Score" },
      { id: "jcn-composite-blends", label: "Composite Blends" },
      { id: "jcn-citations", label: "References" },
    ],
  },
  {
    id: "database",
    label: "Database & Schema",
    children: [
      { id: "db-motherduck", label: "MotherDuck" },
      { id: "db-prod-survivorship", label: "PROD_EOD_survivorship" },
      { id: "db-prod-etfs", label: "PROD_EOD_ETFs" },
      { id: "db-prod-fundamentals", label: "PROD_EOD_Fundamentals" },
      { id: "db-score-tables", label: "Score Tables" },
      { id: "db-sync-state", label: "SYNC_STATE & SYNC_LOG" },
    ],
  },
  {
    id: "eodhd-api",
    label: "EODHD API",
    children: [
      { id: "eodhd-overview", label: "API Overview" },
      { id: "eodhd-endpoints", label: "Endpoints Used" },
      { id: "eodhd-rate-limits", label: "Rate Limits" },
    ],
  },
  {
    id: "sync-pipeline",
    label: "Data Sync Pipeline",
    children: [
      { id: "sync-stage0", label: "Stage 0: Health Check" },
      { id: "sync-stage1", label: "Stage 1: Ingest" },
      { id: "sync-stage2", label: "Stage 2: Validate & Promote" },
      { id: "sync-stage3", label: "Stage 3: Score Rebuild" },
      { id: "sync-prime-directive", label: "Prime Directive" },
    ],
  },
  {
    id: "caching",
    label: "Caching Architecture",
    children: [
      { id: "cache-layers", label: "4-Layer Cache" },
      { id: "cache-ttl", label: "TTL Strategy" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function FormulaBlock({
  label,
  formula,
  note,
}: {
  label: string
  formula: string
  note?: string
}) {
  return (
    <div className="my-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        {label}
      </p>
      <pre className="mt-1 overflow-x-auto font-mono text-sm text-gray-900 dark:text-gray-100">
        {formula}
      </pre>
      {note && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note}</p>
      )}
    </div>
  )
}

function MetricRow({
  name,
  formula,
  description,
}: {
  name: string
  formula: string
  description: string
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="whitespace-nowrap py-3 pr-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {name}
      </td>
      <td className="px-4 py-3">
        <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
          {formula}
        </code>
      </td>
      <td className="py-3 pl-4 text-sm text-gray-600 dark:text-gray-400">
        {description}
      </td>
    </tr>
  )
}

function SchemaTable({
  columns,
}: {
  columns: Array<{ name: string; type: string; desc: string }>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Column
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Type
            </th>
            <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr
              key={col.name}
              className="border-b border-gray-50 dark:border-gray-800/50"
            >
              <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                {col.name}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                {col.type}
              </td>
              <td className="py-2 pl-4 text-sm text-gray-600 dark:text-gray-400">
                {col.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionHeader({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <h2
      id={id}
      className="mb-4 scroll-mt-20 border-b border-gray-200 pb-2 text-xl font-bold text-gray-900 dark:border-gray-700 dark:text-gray-50"
    >
      {children}
    </h2>
  )
}

function SubHeader({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <h3
      id={id}
      className="mb-3 mt-8 scroll-mt-20 text-lg font-semibold text-gray-800 dark:text-gray-200"
    >
      {children}
    </h3>
  )
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
      {children}
    </p>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
      <code>{children}</code>
    </pre>
  )
}

// ---------------------------------------------------------------------------
// Main Wiki Page
// ---------------------------------------------------------------------------
export default function WikiPage() {
  const [activeSection, setActiveSection] = useState("overview")

  // Intersection observer for active section highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: "-80px 0px -70% 0px" },
    )
    const headings = document.querySelectorAll("[id]")
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="mx-auto flex max-w-7xl">
        {/* Left TOC Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-gray-200 p-6 lg:block dark:border-gray-800">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Wiki Contents
          </h2>
          <nav className="space-y-1">
            {TOC.map((section) => (
              <div key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={`block rounded px-2 py-1.5 text-sm font-semibold transition-colors ${
                    activeSection === section.id
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                  }`}
                >
                  {section.label}
                </a>
                {section.children && (
                  <div className="ml-3 space-y-0.5">
                    {section.children.map((child) => (
                      <a
                        key={child.id}
                        href={`#${child.id}`}
                        className={`block rounded px-2 py-1 text-xs transition-colors ${
                          activeSection === child.id
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                        }`}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-6 py-8 lg:px-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              JCN Financial Wiki
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Complete reference for the JCN Financial Investment Dashboard —
              architecture, metrics, data, and methodology.
            </p>
          </div>

          {/* ============================================================ */}
          {/* SECTION: Overview */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="overview">Overview</SectionHeader>

            <SubHeader id="what-is-jcn">What is JCN Financial?</SubHeader>
            <Paragraph>
              JCN Financial is a production-grade investment dashboard that
              provides real-time portfolio tracking, deep fundamental stock
              analysis, and institutional-quality data infrastructure. Built for
              serious investors who need survivorship-bias-free data,
              point-in-time accuracy, and comprehensive fundamental screening
              across the top 1,500 US equities by market capitalization.
            </Paragraph>
            <Paragraph>
              The platform manages three distinct investment portfolios
              (Persistent Value, Olivia Growth, Pure Alpha), each with unique
              strategies, and offers a full Stock Analysis screener with 10
              analytical modules covering price performance, per-share data,
              quality metrics, financial statements, growth rates, valuation,
              and composite quality scoring.
            </Paragraph>

            <SubHeader id="tech-stack">Technology Stack</SubHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                      Layer
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Technology
                    </th>
                    <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Frontend
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Next.js 14, React 18, Tailwind CSS
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      SSR, routing, responsive UI
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Charts
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      ECharts 6.0, Recharts
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Interactive charts, radar, line graphs
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      UI Kit
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Tremor v3, Radix UI
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Dashboard components, accessible primitives
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Backend
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      FastAPI (Python)
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Serverless API on Vercel
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Database
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      MotherDuck (DuckDB cloud)
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Analytical warehouse — prices, fundamentals, scores
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Data
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      EODHD API
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      EOD prices, fundamentals, bulk downloads
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Hosting
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Vercel Pro
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Serverless deploy, 300s function timeout
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Caching
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      SWR, localStorage, /tmp
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Multi-layer: browser → serverless → DB
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="architecture">Architecture</SubHeader>
            <Paragraph>
              The application follows a serverless architecture deployed on
              Vercel. The Next.js frontend communicates with Python FastAPI
              serverless functions via{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
                /api/*
              </code>{" "}
              routes. All market data lives in MotherDuck (cloud DuckDB),
              organized into production tables under the
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
                PROD_EODHD
              </code>{" "}
              database.
            </Paragraph>
            <CodeBlock>{`Browser (React)
  └─ Next.js SSR / Client
       └─ /api/* routes (Vercel Serverless)
            └─ FastAPI (Python)
                 ├─ Cache: /tmp (Vercel ephemeral)
                 └─ MotherDuck (DuckDB Cloud)
                      ├─ PROD_EODHD (production)
                      └─ DEV_EODHD_DATA (staging)`}</CodeBlock>
          </section>

          {/* ============================================================ */}
          {/* SECTION: Dashboard Pages */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="pages">Dashboard Pages</SectionHeader>

            <SubHeader id="page-dashboard">Dashboard (Heatmap + Charts)</SubHeader>
            <Paragraph>
              The main dashboard page features a full-width TradingView stock
              market heatmap showing real-time sector and stock performance
              with color-coded daily percentage changes. Above the heatmap,
              three equally spaced TradingView Advanced Chart widgets display
              daily candle charts for SPY (S&P 500), QQQ (Nasdaq 100), and
              ACWI (All Country World Index) — providing instant macro context.
              Charts use white backgrounds with volume bars hidden for a clean
              presentation.
            </Paragraph>

            <SubHeader id="page-persistent-value">
              Persistent Value Portfolio
            </SubHeader>
            <Paragraph>
              A 21-holding portfolio focused on high-quality, durable
              compounders with strong competitive moats, consistent free cash
              flow generation, and long-term capital appreciation. Holdings
              include ASML, COST, AVGO, MA, FICO, SPGI, V, AAPL, NFLX, and
              others. Uses SPMO as the benchmark ETF.
            </Paragraph>
            <Paragraph>
              Features: real-time performance table with YTD/1Y/3Y/5Y returns,
              market-cap-weighted allocation pie chart, SPY benchmark comparison
              with alpha calculation, historical price charts, JCN 5-factor
              score grid, and quality radar charts. All data loads from
              MotherDuck with 4-layer cache.
            </Paragraph>

            <SubHeader id="page-olivia-growth">
              Olivia Growth Portfolio
            </SubHeader>
            <Paragraph>
              A 20-holding growth-oriented portfolio emphasizing high-momentum
              technology and infrastructure names. Holdings include GOOG, AMZN,
              META, NVDA, AMD, CRWD, PLTR, SHOP, and others. Uses QGRW as the
              benchmark ETF. Identical architecture to Persistent Value.
            </Paragraph>

            <SubHeader id="page-pure-alpha">Pure Alpha Portfolio</SubHeader>
            <Paragraph>
              A concentrated 10-holding high-conviction portfolio designed for
              maximum alpha generation. Holdings: GEV, GOOG, NVDA, TSLA, PWR,
              AXON, LRCX, MELI, MU, NFLX. Benchmarked directly against SPY.
            </Paragraph>

            <SubHeader id="page-stock-analysis">
              Stock Analysis Screener
            </SubHeader>
            <Paragraph>
              Deep single-stock fundamental analysis page with 10 analytical
              modules. Limited to the top 1,500 US stocks by current market
              capitalization. Features smart search with autocomplete, recent
              search history pills (localStorage, max 10), and animated progress
              bar.
            </Paragraph>
            <Paragraph>
              Default symbol: NVDA (loaded automatically). All modules always
              visible. Data fetched in a single API call and cached 30 minutes
              in both browser and server.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3 text-left text-xs font-medium uppercase text-gray-500">
                      #
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Module
                    </th>
                    <th className="py-2 pl-3 text-left text-xs font-medium uppercase text-gray-500">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">1</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Stock Info Header
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      Company name, sector, P/E, Forward P/E, Div Yield, Beta,
                      ROE, Analyst Target
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">2</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Price vs SPY
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      5-year chart indexed to 100. Stock (blue) vs SPY (gray)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">3</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Per Share Data
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      14 metrics over 10+ years: Revenue/Share, EPS, FCF/Share,
                      Book Value, Yields
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">4</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Quality Metrics
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      17 ratios: Margins, Returns, Leverage, Efficiency
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">5</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Income Statement
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      Hierarchical P&L with expandable parent-child rows
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">6</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Balance Sheet
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      Assets, Liabilities, Equity with 3-level hierarchy
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">7</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Cash Flows
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      Operating, Investing, Financing sub-items. Free Cash Flow.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">8</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Growth Rates
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      YoY growth, 12 metrics, heatmap coloring
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">9</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      Valuation Ratios
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      9 valuation metrics + analyst consensus bar
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-gray-500">10</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      JCN Scores
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      6-dimension composite scoring (0-100) with radar chart
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="page-screener">Stock Screener</SubHeader>
            <Paragraph>
              A FinViz-style stock screener that filters the ~3,000 stock
              investable universe using preset dropdown filters — no manual
              value input required. Organized into 7 filter tabs: Descriptive
              (market cap, sector), JCN Scores (5 factor composites + 8 blend
              composites), Valuation (P/E, PEG, P/B, P/S, EV/EBITDA, dividend
              yield), Growth (revenue and earnings growth), Profitability
              (margins, ROE, ROA), Momentum (daily/YTD/YoY changes, beta, and
              all AF/FIP/System momentum sub-components), and Fundamentals
              (debt/equity, current ratio, interest coverage).
            </Paragraph>
            <Paragraph>
              Results display in a TanStack Table v8 with full sorting on any
              column, a column picker to show/hide fields, and CSV export.
              Right-clicking any cell opens a context menu with three options:
              Analysis (opens the stock in Stock Analysis in a new tab), Add to
              Watchlist (saves to localStorage), and Grok (placeholder for
              future AI analysis). Filter and table state are persisted in
              sessionStorage so navigating away and back preserves the screener
              exactly as the user left it.
            </Paragraph>
            <Paragraph>
              The screener API (POST /api/screener) uses a dynamic SQL query
              builder with a whitelisted field map to prevent SQL injection. It
              JOINs across 8 MotherDuck tables using inline subqueries (not
              CTEs, which fail on MotherDuck). Results are cached in /tmp with
              a 5-minute TTL. The API is 100% read-only and never writes to any
              production table.
            </Paragraph>

            <SubHeader id="page-watchlist">Watchlist</SubHeader>
            <Paragraph>
              A personal watchlist page where users can track stocks of
              interest. Symbols can be added manually via a ticker input field
              or from the Screener context menu. The watchlist is stored in
              localStorage (no database writes required) and syncs across
              components via a custom watchlist-change event.
            </Paragraph>
            <Paragraph>
              The watchlist table displays enriched data fetched from the
              screener API: company name, sector, market cap, price, daily/YTD/YoY
              percentage changes, and five JCN factor scores (Value, Quality,
              Growth, Momentum, JCN Full Composite). Users can sort by any
              column, remove individual symbols, clear all with a confirmation
              dialog, export to CSV, or open any symbol in Stock Analysis via a
              new-tab link. An empty state guides new users to add symbols from
              the input field or the Screener page.
            </Paragraph>

            <SubHeader id="page-data-sync">Data Sync Pipeline</SubHeader>
            <Paragraph>
              A 4-stage automated data pipeline that ingests daily EOD prices
              from EODHD, validates data quality, promotes to production, and
              rebuilds composite scores. Each stage is idempotent and safe to
              re-run. See the Sync Pipeline section for details.
            </Paragraph>
          </section>

          {/* ============================================================ */}
          {/* SECTION: Portfolio Metrics */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="portfolio-metrics">
              Portfolio Metrics
            </SectionHeader>

            <SubHeader id="metric-performance">Performance Table</SubHeader>
            <Paragraph>
              Each portfolio page displays a performance table showing every
              holding with current price, daily change, and period returns.
              Prices come from EODHD real-time API (15-min delayed) or
              MotherDuck historical data.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Formula
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  name="Current Price"
                  formula="EODHD real-time or latest adjusted_close"
                  description="Most recent price, 15-min delayed max"
                />
                <MetricRow
                  name="Daily Change %"
                  formula="(close_today - close_yesterday) / close_yesterday * 100"
                  description="Percentage move from prior close"
                />
                <MetricRow
                  name="YTD Return"
                  formula="(price_now - price_jan1) / price_jan1 * 100"
                  description="Year-to-date total return"
                />
                <MetricRow
                  name="1Y Return"
                  formula="(price_now - price_1yr_ago) / price_1yr_ago * 100"
                  description="Trailing 12-month return"
                />
                <MetricRow
                  name="3Y Return"
                  formula="(price_now - price_3yr_ago) / price_3yr_ago * 100"
                  description="Trailing 3-year cumulative return"
                />
                <MetricRow
                  name="5Y Return"
                  formula="(price_now - price_5yr_ago) / price_5yr_ago * 100"
                  description="Trailing 5-year cumulative return"
                />
              </tbody>
            </table>

            <SubHeader id="metric-allocation">Allocation</SubHeader>
            <Paragraph>
              Portfolio allocation is displayed as a pie chart, categorized by
              market cap tier: Mega Cap (above $200B), Large Cap ($10B-$200B),
              Mid Cap ($2B-$10B), Small Cap (below $2B), and ETF. Allocation
              weights are equal-weight by default.
            </Paragraph>

            <SubHeader id="metric-benchmarks">Benchmarks and Alpha</SubHeader>
            <Paragraph>
              Each portfolio is benchmarked against SPY (S&P 500 ETF) and a
              portfolio-specific ETF. Alpha is calculated as the excess return
              of the portfolio over SPY for each time period.
            </Paragraph>
            <FormulaBlock
              label="Alpha Calculation"
              formula="Alpha = Portfolio Return - SPY Return"
              note="Calculated for YTD, 1Y, 3Y, and 5Y periods. Positive alpha indicates outperformance."
            />

            <SubHeader id="metric-scores">JCN Factor Scores</SubHeader>
            <Paragraph>
              Each stock in a portfolio receives five composite factor scores
              (0-100), computed monthly from fundamental data and stored in
              dedicated score tables in MotherDuck. These scores power the radar
              charts and fundamentals grid on each portfolio page.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Score
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    DB Column
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Methodology
                  </th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  name="Value Score"
                  formula="value_score_composite"
                  description="Ranks stocks by valuation attractiveness. Combines P/E, P/B, P/S, EV/EBITDA, and FCF yield relative to sector peers. Lower valuations score higher."
                />
                <MetricRow
                  name="Quality Score"
                  formula="quality_score_composite"
                  description="Measures business quality via gross margin stability, ROE consistency, earnings quality (accruals), and balance sheet strength."
                />
                <MetricRow
                  name="Growth Score"
                  formula="growth_score_composite"
                  description="Evaluates revenue growth, earnings growth, and forward estimates. Combines trailing 3Y CAGR with analyst consensus forward growth."
                />
                <MetricRow
                  name="Financial Strength"
                  formula="finstr_score_composite"
                  description="Assesses balance sheet health: current ratio, debt-to-equity, interest coverage, Altman Z-score components, and cash flow adequacy."
                />
                <MetricRow
                  name="Momentum Score"
                  formula="momentum_score_composite"
                  description="Price momentum signal based on 12-1 month return (skip most recent month). Captures intermediate-term trend persistence."
                />
              </tbody>
            </table>
            <FormulaBlock
              label="Score Normalization"
              formula="score = round((clamped_value - low) / (high - low) * 100)"
              note="Each raw metric is clamped to [low, high] bounds, then linearly scaled to 0-100. A score of 50 indicates median performance."
            />
          </section>

          {/* ============================================================ */}
          {/* SECTION: Stock Analysis Metrics */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="stock-analysis-metrics">
              Stock Analysis Metrics
            </SectionHeader>
            <Paragraph>
              Every metric displayed in the Stock Analysis screener is computed
              server-side from PROD_EOD_Fundamentals quarterly data, aggregated
              into annual figures. P&L and Cash Flow items are summed across
              quarters; Balance Sheet items use the latest quarter in each
              calendar year.
            </Paragraph>

            <SubHeader id="sa-per-share">Per Share Data (Module 3)</SubHeader>
            <Paragraph>
              Annual per-share metrics calculated by dividing aggregate
              financials by shares outstanding. Shares use
              bs_commonStockSharesOutstanding (quarterly historical), falling
              back to shares_outstanding (snapshot) if unavailable.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Formula
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  name="Revenue/Share"
                  formula="is_totalRevenue / shares"
                  description="Total annual revenue divided by shares outstanding"
                />
                <MetricRow
                  name="EPS"
                  formula="is_netIncome / shares"
                  description="Earnings per share — net income allocated to each share"
                />
                <MetricRow
                  name="FCF/Share"
                  formula="cf_freeCashFlow / shares"
                  description="Free cash flow per share — cash available after capex"
                />
                <MetricRow
                  name="EBITDA/Share"
                  formula="is_ebitda / shares"
                  description="Earnings before interest, taxes, depreciation, amortization per share"
                />
                <MetricRow
                  name="Book Value/Share"
                  formula="bs_totalStockholderEquity / shares"
                  description="Net asset value per share (equity / shares)"
                />
                <MetricRow
                  name="Operating CF/Share"
                  formula="cf_totalCashFromOperatingActivities / shares"
                  description="Cash from operations per share"
                />
                <MetricRow
                  name="Dividend/Share"
                  formula="-cf_dividendsPaid / shares"
                  description="Annual dividend paid per share (dividends are negative in cash flow)"
                />
                <MetricRow
                  name="Buyback Yield"
                  formula="-cf_salePurchaseOfStock / market_cap"
                  description="Share repurchases as a percentage of market cap"
                />
                <MetricRow
                  name="Dividend Yield"
                  formula="-cf_dividendsPaid / market_cap"
                  description="Annual dividends as a percentage of market cap"
                />
                <MetricRow
                  name="Total Return Yield"
                  formula="(-dividends + -buybacks) / market_cap"
                  description="Combined shareholder yield from dividends and buybacks"
                />
                <MetricRow
                  name="Shares Outstanding"
                  formula="bs_commonStockSharesOutstanding / 1M"
                  description="Total shares outstanding in millions"
                />
                <MetricRow
                  name="Revenue ($M)"
                  formula="is_totalRevenue / 1M"
                  description="Total annual revenue in millions"
                />
                <MetricRow
                  name="Net Income ($M)"
                  formula="is_netIncome / 1M"
                  description="Total annual net income in millions"
                />
                <MetricRow
                  name="Free Cash Flow ($M)"
                  formula="cf_freeCashFlow / 1M"
                  description="Annual free cash flow in millions"
                />
              </tbody>
            </table>

            <SubHeader id="sa-quality-metrics">
              Quality Metrics (Module 4)
            </SubHeader>
            <Paragraph>
              Annual quality ratios measuring profitability, returns on capital,
              leverage, and operational efficiency. All computed from aggregated
              annual data.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Formula
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  name="Gross Margin"
                  formula="is_grossProfit / is_totalRevenue"
                  description="Revenue retained after cost of goods sold. Higher = stronger pricing power."
                />
                <MetricRow
                  name="Operating Margin"
                  formula="is_operatingIncome / is_totalRevenue"
                  description="Profitability from core operations after operating expenses."
                />
                <MetricRow
                  name="Net Margin"
                  formula="is_netIncome / is_totalRevenue"
                  description="Bottom-line profitability after all expenses, interest, and taxes."
                />
                <MetricRow
                  name="EBITDA Margin"
                  formula="is_ebitda / is_totalRevenue"
                  description="Cash earnings margin before non-cash charges and financing."
                />
                <MetricRow
                  name="FCF Margin"
                  formula="cf_freeCashFlow / is_totalRevenue"
                  description="Free cash flow as percentage of revenue. Measures cash conversion."
                />
                <MetricRow
                  name="ROIC"
                  formula="is_netIncome / (equity + longTermDebt)"
                  description="Return on invested capital. Measures efficiency of capital allocation."
                />
                <MetricRow
                  name="ROE"
                  formula="is_netIncome / bs_totalStockholderEquity"
                  description="Return on equity. Profit generated per dollar of shareholder equity."
                />
                <MetricRow
                  name="ROA"
                  formula="is_netIncome / bs_totalAssets"
                  description="Return on assets. Profit generated per dollar of total assets."
                />
                <MetricRow
                  name="ROCE"
                  formula="is_operatingIncome / (equity + longTermDebt)"
                  description="Return on capital employed. Operating profit on invested capital."
                />
                <MetricRow
                  name="Debt/Equity"
                  formula="bs_totalLiab / bs_totalStockholderEquity"
                  description="Total leverage ratio. Higher = more leveraged balance sheet."
                />
                <MetricRow
                  name="LT Debt/Equity"
                  formula="bs_longTermDebt / bs_totalStockholderEquity"
                  description="Long-term debt leverage. Excludes short-term obligations."
                />
                <MetricRow
                  name="Current Ratio"
                  formula="bs_totalCurrentAssets / bs_totalCurrentLiabilities"
                  description="Short-term liquidity. Above 1.0 = can cover near-term obligations."
                />
                <MetricRow
                  name="Interest Coverage"
                  formula="is_operatingIncome / is_interestExpense"
                  description="Ability to service debt. Higher = more comfortable debt burden."
                />
                <MetricRow
                  name="Asset Turnover"
                  formula="is_totalRevenue / bs_totalAssets"
                  description="Revenue generated per dollar of assets. Measures asset efficiency."
                />
                <MetricRow
                  name="CapEx/Revenue"
                  formula="abs(cf_capitalExpenditures) / is_totalRevenue"
                  description="Capital intensity. How much revenue is reinvested in fixed assets."
                />
                <MetricRow
                  name="FCF Conversion"
                  formula="cf_freeCashFlow / is_netIncome"
                  description="How much net income converts to free cash flow. Above 1.0 = high quality."
                />
                <MetricRow
                  name="Cash Conversion"
                  formula="cf_operatingCashFlow / is_netIncome"
                  description="Operating cash flow relative to reported earnings. Earnings quality check."
                />
              </tbody>
            </table>

            <SubHeader id="sa-financial-statements">
              Financial Statements (Modules 5-7)
            </SubHeader>
            <Paragraph>
              Income Statement, Balance Sheet, and Cash Flows are displayed as
              hierarchical tables with expandable parent-child rows. All values
              are shown in millions ($M). Quarterly data is aggregated into
              annual: P&L and Cash Flow items are summed, Balance Sheet items
              use the latest quarter.
            </Paragraph>
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Income Statement Hierarchy
            </div>
            <CodeBlock>{`Revenue
  └ Cost of Revenue
Gross Profit
Operating Expenses
  ├ R&D
  ├ SG&A
  └ D&A
Operating Income
Interest Expense
Income Before Tax
Income Tax
EBITDA
Net Income`}</CodeBlock>
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Balance Sheet Hierarchy
            </div>
            <CodeBlock>{`Total Assets
  ├ Current Assets
  │   ├ Cash & Equivalents
  │   ├ Short-Term Investments
  │   ├ Net Receivables
  │   └ Inventory
  └ Non-Current Assets
      ├ PP&E
      ├ Goodwill
      ├ Intangibles
      └ Long-Term Investments
Total Liabilities
  ├ Current Liabilities
  │   ├ Accounts Payable
  │   └ Short-Term Debt
  └ Non-Current Liabilities
      └ Long-Term Debt
Stockholder Equity
  ├ Common Stock
  ├ Retained Earnings
  └ Treasury Stock
Net Debt
Shares Outstanding`}</CodeBlock>
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Cash Flow Hierarchy
            </div>
            <CodeBlock>{`Operating Cash Flow
  ├ Net Income
  ├ D&A
  ├ Stock-Based Comp
  └ Working Capital Changes
Investing Cash Flow
  ├ Capital Expenditures
  └ Investments
Financing Cash Flow
  ├ Dividends Paid
  ├ Share Buybacks/Issuance
  └ Net Borrowings
Free Cash Flow
Net Change in Cash`}</CodeBlock>

            <SubHeader id="sa-growth-rates">Growth Rates (Module 8)</SubHeader>
            <Paragraph>
              Year-over-year growth rates for 12 key financial metrics. Computed
              as percentage change from the prior year. Displayed with heatmap
              coloring: deep green for high growth, red for contraction, gray
              for null.
            </Paragraph>
            <FormulaBlock
              label="YoY Growth Rate"
              formula="growth_pct = (current_year - prior_year) / abs(prior_year) * 100"
              note="Null if either year is missing or prior year is zero. Absolute value in denominator handles negative base values."
            />
            <Paragraph>
              Tracked metrics: Revenue, Gross Profit, Operating Income, EBITDA,
              Net Income, EPS, Free Cash Flow, Operating Cash Flow, Total
              Assets, Stockholder Equity, Long-Term Debt, Dividends Paid.
            </Paragraph>

            <SubHeader id="sa-valuation">Valuation Ratios (Module 9)</SubHeader>
            <Paragraph>
              Current snapshot valuation multiples from EODHD. These are
              point-in-time values (not historical per quarter) and represent
              the latest available data for each stock.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Formula
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  name="P/E Ratio"
                  formula="price / EPS (trailing)"
                  description="Price relative to trailing 12-month earnings"
                />
                <MetricRow
                  name="Forward P/E"
                  formula="price / forward EPS estimate"
                  description="Price relative to consensus forward earnings estimate"
                />
                <MetricRow
                  name="PEG Ratio"
                  formula="P/E / earnings growth rate"
                  description="P/E adjusted for growth. Below 1.0 suggests undervaluation relative to growth."
                />
                <MetricRow
                  name="Price/Book"
                  formula="price / book value per share"
                  description="Market price relative to net asset value. Below 1.0 = trading below book."
                />
                <MetricRow
                  name="Price/Sales"
                  formula="market_cap / revenue_ttm"
                  description="Market cap relative to trailing revenue. Lower = cheaper on revenue basis."
                />
                <MetricRow
                  name="EV/EBITDA"
                  formula="enterprise_value / ebitda"
                  description="Enterprise value per unit of operating cash earnings. Standard M&A metric."
                />
                <MetricRow
                  name="EV/Revenue"
                  formula="enterprise_value / revenue_ttm"
                  description="Enterprise value per unit of revenue. Capital-structure-neutral valuation."
                />
                <MetricRow
                  name="Trailing P/E"
                  formula="price / trailing EPS"
                  description="Price to trailing earnings (may differ from standard P/E by data source)."
                />
                <MetricRow
                  name="Dividend Yield"
                  formula="annual_dividend / price"
                  description="Annual dividend as percentage of current share price."
                />
              </tbody>
            </table>

            <SubHeader id="sa-jcn-scores">
              JCN Factor Scores (Module 10)
            </SubHeader>
            <Paragraph>
              Five precomputed composite factor scores fetched from PROD score
              tables (computed monthly). Each score is 0-100. The JCN Composite
              is the simple average of all five factor scores. Displayed as
              score cards and a 5-axis radar chart.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Score
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Source Table
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    What it Measures
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Value
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    PROD_OBQ_Value_Scores
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Ranks stocks by valuation attractiveness (P/E, P/B,
                    EV/EBITDA, etc.)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Quality
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    PROD_OBQ_Quality_Scores
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Business quality via margins, ROE, earnings stability
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Financial Strength
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    PROD_OBQ_FinStr_Scores
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Balance sheet health, debt coverage, liquidity
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Growth
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    PROD_OBQ_Growth_Scores
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Revenue growth, earnings growth, forward estimates
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Momentum
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    PROD_OBQ_Momentum_Scores
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Price momentum signal based on relative strength
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold text-blue-600 dark:text-blue-400">
                    JCN Composite
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Average of all 5
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Overall factor score = (V + Q + FS + G + M) / 5
                  </td>
                </tr>
              </tbody>
            </table>
            <FormulaBlock
              label="JCN Composite Score"
              formula="jcn_composite = (value + quality + financial_strength + growth + momentum) / 5"
              note="Each factor score is precomputed monthly from fundamental data and stored in PROD score tables (PROD_OBQ_*_Scores). The JCN Composite is the simple average of all five."
            />
          </section>

          {/* ============================================================ */}
          {/* SECTION: JCN Score Methodology */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="jcn-methodology">
              JCN Score Methodology
            </SectionHeader>
            <Paragraph>
              The JCN scoring system evaluates every stock in the investable
              universe across five fundamental dimensions: Value, Quality,
              Growth, Financial Strength, and Momentum. Each factor is computed
              monthly using a proprietary 3-way scoring system that combines
              cross-sectional, sector-relative, and historical self-relative
              rankings. The five individual scores are then blended into eight
              composite presets for different investment strategies.
            </Paragraph>

            <SubHeader id="jcn-investable-universe">
              Investable Universe
            </SubHeader>
            <Paragraph>
              Scores are computed only for stocks in the JCN Investable Universe
              — the top 3,000 US equities by market capitalization,
              reconstituted annually on the last trading day of May. This
              mirrors the Russell 3000 reconstitution methodology used by FTSE
              Russell.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Parameter
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Universe Size
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Top 3,000 by market cap
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Rank Day
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Last trading day of May each year
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Effective Period
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    July 1 through June 30 of the following year
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    DQ Filters
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Market cap $10M - $5T, adjusted close $0.01 - $500K
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Pre-2003 Handling
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    All available stocks scored (no universe filter)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Table
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    PROD_OBQ_Investable_Universe (67,528 rows, 2003-2025)
                  </td>
                </tr>
              </tbody>
            </table>

            <SubHeader id="jcn-3way-scoring">3-Way Scoring System</SubHeader>
            <Paragraph>
              Each of the five factor scores uses three independent scoring
              dimensions, combined into a single composite. This multi-lens
              approach prevents a stock from scoring well simply because its
              entire sector is cheap or because it happens to be in a
              historically low-quality industry.
            </Paragraph>
            <FormulaBlock
              label="Composite Formula"
              formula="composite = Universe Score (40%) + Sector Score (40%) + History Score (20%)"
              note="All three dimensions use PERCENT_RANK() to produce 0-100 scores. The composite is a weighted average of the three."
            />
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Dimension
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Weight
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Universe
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    40%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Cross-sectional percentile rank vs. all ~3,000 stocks in the
                    same month. A stock scoring 90 is in the top 10% of the
                    entire investable universe.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Sector
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    40%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Same percentile rank but within GICS sector peers only
                    (minimum 3 peers). Captures relative standing within an
                    industry — is this tech stock cheap vs. other tech stocks?
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    History
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    20%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Percentile rank against the stock&apos;s own 8+ quarter
                    history (rolling window). Is this stock cheap relative to
                    its own historical norms?
                  </td>
                </tr>
              </tbody>
            </table>
            <Paragraph>
              Fallback rules: if a sector has fewer than 3 peers, weights shift
              to Universe 60% + History 40%. If historical data has fewer than 8
              quarters, weights shift to Universe 50% + Sector 50%.
            </Paragraph>

            <SubHeader id="jcn-value-score">Value Score</SubHeader>
            <Paragraph>
              Measures how attractively priced a stock is relative to its
              fundamentals. Lower valuation ratios produce higher scores
              (inverted ranking). The weighting emphasizes cash-flow-based
              measures over accounting earnings.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Weight
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Direction
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    P/FCF (TTM)
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    30%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Lower is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Price to Free Cash Flow. Cash yield to shareholders —
                    hardest metric to manipulate.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    EV/EBITDA (TTM)
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    25%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Lower is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Enterprise value to operating earnings.
                    Capital-structure-neutral. Standard M&amp;A metric.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    P/E (TTM)
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    20%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Lower is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Price to trailing earnings. The classic valuation metric,
                    included for universality.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    P/S (TTM)
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    15%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Lower is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Price to sales. Useful for pre-profit or cyclically
                    depressed companies.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    P/B (MRQ)
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    10%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Lower is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Price to book value. Asset-based valuation floor, most
                    relevant for financials and industrials.
                  </td>
                </tr>
              </tbody>
            </table>
            <Paragraph>
              P/FCF receives the highest weight because free cash flow is the
              purest measure of economic value available to shareholders. Unlike
              earnings, FCF is difficult to inflate through accounting choices.
              EV/EBITDA is capital-structure-neutral, allowing fair comparison
              between levered and unlevered firms — the standard metric in
              M&amp;A valuation. P/E is included for universality but
              downweighted due to susceptibility to one-time charges and
              accounting distortions. The value factor draws directly from the
              HML (High Minus Low) factor identified by Fama &amp; French
              (1992).
            </Paragraph>

            <SubHeader id="jcn-quality-score">Quality Score</SubHeader>
            <Paragraph>
              Measures business quality through profitability, capital
              efficiency, and earnings reliability. Higher values indicate
              better quality. The weighting emphasizes asset-level profitability
              measures that academic research has shown to be the most
              predictive of future returns.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Weight
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Gross Profitability (GPA)
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    20%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Gross Profit / Total Assets. The Novy-Marx (2013) quality
                    factor — shown to be as powerful as book-to-market in
                    predicting returns.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    ROIC
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    20%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Return on Invested Capital. Net Income / (Equity + Long-Term
                    Debt). Measures how efficiently management allocates
                    capital.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    ROA
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    15%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Return on Assets. Asset-level profitability, independent of
                    capital structure.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    FCF Margin
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    15%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Free Cash Flow / Revenue. How much revenue converts to
                    actual cash available to shareholders.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Gross Margin
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    10%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Pricing power and cost structure durability.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Operating Margin
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    10%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Core business profitability after operating expenses.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Earnings Quality
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    10%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    (Operating CF - Net Income) / Total Assets. Detects accrual
                    manipulation — companies where reported earnings exceed
                    actual cash flows score lower.
                  </td>
                </tr>
              </tbody>
            </table>
            <Paragraph>
              The Earnings Quality metric is a Sloan (1996) accruals-based
              signal: companies where cash flow consistently trails reported
              earnings tend to have lower future returns, as the accrual
              component eventually reverses. GPA at 20% weight follows Novy-Marx
              (2013), who showed gross profitability scaled by assets has strong
              return-predictive power and is negatively correlated with value —
              making it an excellent complement in a multi-factor model.
            </Paragraph>

            <SubHeader id="jcn-growth-score">Growth Score</SubHeader>
            <Paragraph>
              Measures multi-period earnings, revenue, and cash flow growth
              using blended compound annual growth rates (CAGRs). Equal-weighted
              across four per-share growth metrics, each blending three lookback
              periods to balance recent acceleration with durable compounding.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Weight
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Revenue/Share Growth
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    25%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Top-line growth on a per-share basis. Adjusts for dilution
                    from share issuance.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    EPS Growth
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    25%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Earnings per share growth. Bottom-line compounding.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    FCF/Share Growth
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    25%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Free cash flow per share growth. Cash-based confirmation of
                    earnings growth.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Equity/Share Growth
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    25%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Book value per share growth. Equity compounding, a proxy for
                    intrinsic value accumulation.
                  </td>
                </tr>
              </tbody>
            </table>
            <FormulaBlock
              label="Period Blending"
              formula="Blended = 1Y CAGR (40%) + 3Y CAGR (35%) + 5Y CAGR (25%)"
              note="Emphasizes recent acceleration while rewarding durable multi-year compounders. Growth rates are winsorized at +/-200% to prevent outliers from distorting rankings."
            />
            <Paragraph>
              All growth metrics are computed on a per-share basis to penalize
              companies that grow revenue by diluting shareholders through stock
              issuance. The per-share normalization ensures that only genuine
              organic growth (or efficient capital deployment) is rewarded.
            </Paragraph>

            <SubHeader id="jcn-finstr-score">
              Financial Strength Score
            </SubHeader>
            <Paragraph>
              Measures balance sheet health, debt serviceability, and liquidity.
              Equal-weighted across six metrics covering both stock measures
              (balance sheet ratios) and flow measures (coverage ratios). Draws
              from Altman Z-score principles (Altman, 1968) and Piotroski
              F-score methodology (Piotroski, 2000).
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Weight
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Direction
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Interest Coverage
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    16.7%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Higher is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Operating Income / Interest Expense. Can the company
                    comfortably service its debt?
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    FCF / Debt
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    16.7%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Higher is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Free Cash Flow / Total Debt. How quickly could the company
                    repay all debt from cash flow?
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Net Debt / EBITDA
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    16.7%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Lower is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Net leverage ratio. Years to repay net debt from operating
                    earnings. Below 2x is healthy.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Debt / Assets
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    16.7%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Lower is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Total leverage ratio. What fraction of total assets is
                    financed by debt?
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Cash / Assets
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    16.7%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Higher is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Liquidity buffer as a fraction of total assets.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Working Capital / Assets
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    16.7%
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Higher is better
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Short-term financial cushion. Positive working capital =
                    current assets exceed current liabilities.
                  </td>
                </tr>
              </tbody>
            </table>
            <Paragraph>
              Equal weighting ensures no single dimension (leverage, liquidity,
              or coverage) dominates the score. The mix captures both
              point-in-time balance sheet health and ongoing cash flow adequacy.
              Companies with zero debt naturally score high on debt-related
              metrics but still need strong liquidity and working capital to
              score well overall.
            </Paragraph>

            <SubHeader id="jcn-momentum-score">Momentum Score</SubHeader>
            <Paragraph>
              Measures price trend strength and persistence from weekly return
              data. Unlike the other four factor scores which use monthly
              fundamental data, Momentum is computed weekly from adjusted
              closing prices.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Component
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Weight
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    AF Momentum
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    ~40%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Average of 3-month, 6-month, and 12-month cumulative
                    returns. Captures intermediate-term trend persistence. Based
                    on the classic Jegadeesh &amp; Titman (1993) momentum
                    factor.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    FIP Score
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    ~40%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    180-day directional price strength. Measures sustained
                    trending behavior with less noise than raw returns by
                    filtering short-term reversals.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    SystemScore
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    ~20%
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    5-year avg annual return multiplied by R-cubed (cube of
                    R-squared to 5-year trend line). Rewards strong AND
                    consistent long-term trends. The R-cubed term aggressively
                    penalizes high-return stocks with erratic paths.
                  </td>
                </tr>
              </tbody>
            </table>
            <FormulaBlock
              label="SystemScore"
              formula={`SystemScore = (5yr_avg_annual_return) * (R_squared ^ 3)`}
              note="R-squared measures how well the stock's price fits a linear trend. Cubing it means a stock with R²=0.5 retains only 12.5% of its return contribution, while R²=0.9 retains 72.9%. This heavily rewards smooth, consistent uptrends."
            />
            <Paragraph>
              Weights are conditional: if a component is unavailable for a stock
              (e.g., less than 5 years of data for SystemScore), remaining
              component weights are re-normalized. The momentum score also uses
              the 3-way scoring system (Universe 40% + Sector 40% + History 20%)
              for the final composite.
            </Paragraph>

            <SubHeader id="jcn-composite-blends">Composite Blends</SubHeader>
            <Paragraph>
              Eight pre-configured factor blend presets are stored in
              PROD_JCN_Composite_Scores. Each is a weighted average of the five
              individual factor composite scores. When a factor is unavailable
              for a given stock, the remaining factor weights are re-normalized
              so they still sum to 100%.
            </Paragraph>
            <FormulaBlock
              label="Re-normalization"
              formula="blend_score = SUM(weight_i * factor_i) / SUM(weight_i for non-null factors)"
              note="If a stock has 4 of 5 factors, the weights of the available factors are scaled up proportionally."
            />
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                    Preset
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Column
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Formula
                  </th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                    Use Case
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Full OBQ Composite
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_full_composite
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    V:20 + Q:20 + G:20 + M:20 + FS:20
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Balanced all-factor exposure. No single factor dominates.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    QARP
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_qarp
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Q:40 + V:40 + M:20
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Quality at Reasonable Price. Buffett-style quality-value
                    investing with trend confirmation.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    GARP
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_garp
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    G:40 + V:40 + M:20
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Growth at Reasonable Price. Peter Lynch-style growth-value
                    blend.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Quality + Momentum
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_quality_momentum
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Q:50 + M:50
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    High-quality businesses in uptrends. Avoids value traps by
                    requiring momentum confirmation.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Value + Momentum
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_value_momentum
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    V:50 + M:50
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Deep value with trend confirmation. Avoids catching falling
                    knives.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Growth + Quality + Momentum
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_growth_quality_momentum
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    G:34 + Q:33 + M:33
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Growth compounders with quality and momentum filter. Screens
                    for the best growth stories.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Fortress
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_fortress
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Q:40 + FS:40 + V:20
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    Defensive. Strong balance sheet + high quality + reasonable
                    price. Best for risk-off periods.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    Alpha Trifecta
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    jcn_alpha_trifecta
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    V:34 + Q:33 + M:33
                  </td>
                  <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                    The classic academic three-factor alpha blend: value +
                    quality + momentum.
                  </td>
                </tr>
              </tbody>
            </table>

            <SubHeader id="jcn-citations">References</SubHeader>
            <Paragraph>
              The JCN scoring methodology draws from decades of peer-reviewed
              financial economics research. Key references:
            </Paragraph>
            <div className="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Value Factor:
                </strong>{" "}
                Fama, E.F. &amp; French, K.R. (1992). {'"'}The Cross-Section of
                Expected Stock Returns.{'"'} <em>Journal of Finance</em>, 47(2),
                427-465.
              </p>
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Quality / Profitability:
                </strong>{" "}
                Novy-Marx, R. (2013). {'"'}The Other Side of Value: The Gross
                Profitability Premium.{'"'}{" "}
                <em>Journal of Financial Economics</em>, 108(1), 1-28.
              </p>
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Momentum:
                </strong>{" "}
                Jegadeesh, N. &amp; Titman, S. (1993). {'"'}Returns to Buying
                Winners and Selling Losers: Implications for Stock Market
                Efficiency.{'"'} <em>Journal of Finance</em>, 48(1), 65-91.
              </p>
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Financial Distress:
                </strong>{" "}
                Altman, E.I. (1968). {'"'}Financial Ratios, Discriminant
                Analysis and the Prediction of Corporate Bankruptcy.{'"'}{" "}
                <em>Journal of Finance</em>, 23(4), 589-609.
              </p>
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  F-Score:
                </strong>{" "}
                Piotroski, J.D. (2000). {'"'}Value Investing: The Use of
                Historical Financial Statement Information to Separate Winners
                from Losers.{'"'} <em>Journal of Accounting Research</em>, 38,
                1-41.
              </p>
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Accruals Anomaly:
                </strong>{" "}
                Sloan, R.G. (1996). {'"'}Do Stock Prices Fully Reflect
                Information in Accruals and Cash Flows About Future Earnings?
                {'"'} <em>The Accounting Review</em>, 71(3), 289-315.
              </p>
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Five-Factor Model:
                </strong>{" "}
                Fama, E.F. &amp; French, K.R. (2015). {'"'}A Five-Factor Asset
                Pricing Model.{'"'} <em>Journal of Financial Economics</em>,
                116(1), 1-22.
              </p>
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Russell 3000 Methodology:
                </strong>{" "}
                FTSE Russell (2024). {'"'}Russell U.S. Equity Indexes:
                Construction and Methodology.{'"'} ftserussell.com.
              </p>
            </div>
          </section>

          {/* ============================================================ */}
          {/* SECTION: Database & Schema */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="database">Database &amp; Schema</SectionHeader>

            <SubHeader id="db-motherduck">MotherDuck</SubHeader>
            <Paragraph>
              MotherDuck is a cloud-hosted DuckDB service that provides the
              analytical warehouse for all JCN data. Single-writer architecture
              (concurrent writes fail silently). Connection via MOTHERDUCK_TOKEN
              environment variable. All symbols stored in TICKER.US format
              (e.g., AAPL.US).
            </Paragraph>
            <CodeBlock>{`-- Connection pattern
conn = duckdb.connect(f'md:?motherduck_token={token}')

-- Database layout
PROD_EODHD.main.*        -- Production tables (read by dashboard)
DEV_EODHD_DATA.main.*    -- Staging tables (written by sync pipeline)`}</CodeBlock>

            <SubHeader id="db-prod-survivorship">
              PROD_EOD_survivorship
            </SubHeader>
            <Paragraph>
              The primary price table. Contains daily OHLC + adjusted_close for
              all US common stocks and ADRs, including delisted symbols
              (survivorship-bias free). Over 121 million rows. Zone-map
              optimized by (date, symbol).
            </Paragraph>
            <SchemaTable
              columns={[
                {
                  name: "symbol",
                  type: "VARCHAR",
                  desc: "Ticker in TICKER.US format (e.g., AAPL.US)",
                },
                { name: "date", type: "DATE", desc: "Trading date" },
                { name: "open", type: "DOUBLE", desc: "Opening price" },
                { name: "high", type: "DOUBLE", desc: "Intraday high" },
                { name: "low", type: "DOUBLE", desc: "Intraday low" },
                {
                  name: "close",
                  type: "DOUBLE",
                  desc: "Raw closing price (NOT used for analysis)",
                },
                {
                  name: "adjusted_close",
                  type: "DOUBLE",
                  desc: "Split/dividend-adjusted close (PRIMARY price field)",
                },
                {
                  name: "isin",
                  type: "VARCHAR",
                  desc: "International Securities Identification Number",
                },
                {
                  name: "in_sp500",
                  type: "BOOLEAN",
                  desc: "Current S&P 500 membership",
                },
                {
                  name: "gics_sector",
                  type: "VARCHAR",
                  desc: "GICS sector classification",
                },
                {
                  name: "industry",
                  type: "VARCHAR",
                  desc: "Industry sub-classification",
                },
                {
                  name: "market_cap",
                  type: "DOUBLE",
                  desc: "Latest market capitalization in USD",
                },
                {
                  name: "listing_date",
                  type: "DATE",
                  desc: "IPO / listing date",
                },
                {
                  name: "delisting_date",
                  type: "DATE",
                  desc: "Delisting date (NULL if still active)",
                },
                {
                  name: "is_active",
                  type: "BOOLEAN",
                  desc: "TRUE if currently trading",
                },
                {
                  name: "instrument_type",
                  type: "VARCHAR",
                  desc: "Common Stock, ADR, etc.",
                },
              ]}
            />

            <SubHeader id="db-prod-etfs">PROD_EOD_ETFs</SubHeader>
            <Paragraph>
              Daily OHLC + adjusted_close for ETFs. SPY.US is the primary
              benchmark. Same structure as survivorship but without survivorship
              metadata columns.
            </Paragraph>
            <SchemaTable
              columns={[
                {
                  name: "symbol",
                  type: "VARCHAR",
                  desc: "ETF ticker in TICKER.US format (e.g., SPY.US)",
                },
                { name: "date", type: "DATE", desc: "Trading date" },
                { name: "open", type: "DOUBLE", desc: "Opening price" },
                { name: "high", type: "DOUBLE", desc: "Intraday high" },
                { name: "low", type: "DOUBLE", desc: "Intraday low" },
                { name: "close", type: "DOUBLE", desc: "Raw closing price" },
                {
                  name: "adjusted_close",
                  type: "DOUBLE",
                  desc: "Adjusted close (PRIMARY)",
                },
                { name: "isin", type: "VARCHAR", desc: "ISIN identifier" },
              ]}
            />

            <SubHeader id="db-prod-fundamentals">
              PROD_EOD_Fundamentals
            </SubHeader>
            <Paragraph>
              Quarterly fundamental data for all US stocks. 196 columns covering
              income statement (is_*), balance sheet (bs_*), cash flow (cf_*),
              valuation snapshots, analyst estimates, and company metadata. Over
              160 quarters of history for major stocks.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                      Column Group
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Prefix
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Aggregation
                    </th>
                    <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                      Key Columns
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Identity
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">symbol, date, filing_date</code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      N/A
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      symbol (VARCHAR), date (quarter end), filing_date (SEC
                      filing date)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Company Info
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">
                        company_name, sector, industry
                      </code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Latest
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      sector, industry, gic_sector, gic_industry, exchange
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Income Statement
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">is_*</code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      SUM across quarters
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      is_totalRevenue, is_grossProfit, is_operatingIncome,
                      is_ebitda, is_netIncome
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Balance Sheet
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">bs_*</code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Latest quarter in year
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      bs_totalAssets, bs_totalLiab, bs_totalStockholderEquity,
                      bs_cash, bs_longTermDebt
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Cash Flow
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">cf_*</code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      SUM across quarters
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      cf_totalCashFromOperatingActivities,
                      cf_capitalExpenditures, cf_freeCashFlow
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Valuation (snapshot)
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">pe_ratio, forward_pe, ...</code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Latest (overwritten)
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      market_cap, pe_ratio, forward_pe, peg_ratio,
                      enterprise_value, dividend_yield
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Analyst
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">analyst_*</code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Latest (overwritten)
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      analyst_target_price, analyst_buy, analyst_hold,
                      analyst_sell, analyst_rating
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      Shares
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">
                        shares_outstanding, bs_common...
                      </code>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Latest / Historical
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      shares_outstanding (snapshot),
                      bs_commonStockSharesOutstanding (per quarter)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Paragraph>
              Important: Valuation fields (market_cap, pe_ratio, etc.) are
              SNAPSHOT values — identical across all quarters for a given
              symbol. They represent the CURRENT latest value, not historical.
              Only financial statement columns (is_*, bs_*, cf_*) contain true
              historical quarterly data.
            </Paragraph>

            <SubHeader id="db-score-tables">Score Tables</SubHeader>
            <Paragraph>
              Five separate score tables, each containing monthly composite
              scores per symbol. Rebuilt during Stage 3 of the sync pipeline.
              Used by portfolio pages for the JCN 5-factor score grid and radar
              charts.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                      Table
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Score Column
                    </th>
                    <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                      Key Columns
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      PROD_OBQ_Value_Scores
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">value_score_composite</code>
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      symbol, month_date, value_score_composite
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      PROD_OBQ_Quality_Scores
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">quality_score_composite</code>
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      symbol, month_date, quality_score_composite
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      PROD_OBQ_Growth_Scores
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">growth_score_composite</code>
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      symbol, month_date, growth_score_composite
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      PROD_OBQ_FinStr_Scores
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">finstr_score_composite</code>
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      symbol, month_date, finstr_score_composite
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      PROD_OBQ_Momentum_Scores
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">momentum_score_composite</code>
                    </td>
                    <td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">
                      symbol, month_date, momentum_score_composite
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="db-sync-state">SYNC_STATE &amp; SYNC_LOG</SubHeader>
            <Paragraph>
              SYNC_STATE stores the current state of each sync stage (last run
              timestamp, status, cursor position for resumable operations).
              SYNC_LOG records every sync run with timing, row counts, and error
              details. Both tables enable the Prime Directive PD-08 (cursor
              persistence) and provide audit trail.
            </Paragraph>
          </section>

          {/* ============================================================ */}
          {/* SECTION: EODHD API */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="eodhd-api">EODHD API</SectionHeader>

            <SubHeader id="eodhd-overview">API Overview</SubHeader>
            <Paragraph>
              EODHD (End of Day Historical Data) is the primary external data
              provider for JCN Financial. It supplies daily end-of-day prices,
              quarterly fundamentals, and company metadata for all US-listed
              securities including common stocks, ADRs, and ETFs. Data is
              point-in-time accurate using SEC filing dates.
            </Paragraph>

            <SubHeader id="eodhd-endpoints">Endpoints Used</SubHeader>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                      Endpoint
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Used In
                    </th>
                    <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      /api/eod-bulk-last-day/US
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Stage 1 (Ingest)
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Bulk download of latest EOD prices for all US symbols in a
                      single API call
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      /api/real-time/[symbol].US
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Live Prices
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      15-min delayed real-time quotes for portfolio current
                      prices
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                      /api/fundamentals/[symbol].US
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      Fundamentals Sync
                    </td>
                    <td className="py-2 pl-4 text-gray-600 dark:text-gray-400">
                      Quarterly financial statements, valuation, analyst data
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="eodhd-rate-limits">Rate Limits</SubHeader>
            <Paragraph>
              EODHD enforces rate limits of 1,000 API calls per minute and
              100,000 calls per day. The sync pipeline uses bulk endpoints to
              minimize call count. Real-time price fetches for portfolios are
              throttled to one refresh per 15 minutes (client-side localStorage
              cache) and only trigger on manual refresh button click or TTL
              expiry.
            </Paragraph>
            <FormulaBlock
              label="Rate Limiter"
              formula="delay = max(0.06s per call, 60ms between requests)"
              note="Enforced via RateLimiter class. API key stored as Vercel environment variable EODHD_API_KEY, never in source code."
            />
          </section>

          {/* ============================================================ */}
          {/* SECTION: Data Sync Pipeline */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="sync-pipeline">Data Sync Pipeline</SectionHeader>
            <Paragraph>
              The sync pipeline is a 4-stage process that maintains the
              production database. Each stage is independently runnable,
              idempotent, and designed to operate within Vercel Pro 300-second
              function timeout (280s budget with 20s safety buffer).
            </Paragraph>
            <CodeBlock>{`Stage 0: Health Check (diagnostics)
    ↓
Stage 1: Ingest (EODHD → DEV)
    ↓
Stage 2: Validate & Promote (DEV → PROD)
    ↓
Stage 3: Score Rebuild (recompute composites)`}</CodeBlock>

            <SubHeader id="sync-stage0">Stage 0: Health Check</SubHeader>
            <Paragraph>
              Runs 8 diagnostic checks before any sync operation: (1) MotherDuck
              connectivity, (2) EODHD API key validation, (3) Required tables
              existence with estimated row counts, (4) Last sync timestamp from
              SYNC_STATE, (5) Symbol format consistency (PD-03 — all must be
              TICKER.US), (6) Fundamentals coverage ratio, (7) Gap analysis
              (latest date vs today), (8) Duplicate detection in last 7 days.
              Uses sampled queries and LIMIT 1 patterns for speed. Results
              cached 5 minutes.
            </Paragraph>

            <SubHeader id="sync-stage1">Stage 1: Ingest</SubHeader>
            <Paragraph>
              Downloads daily EOD prices for all US symbols via EODHD bulk
              endpoint (/api/eod-bulk-last-day/US). Separates stocks from ETFs
              based on exchange code. Validates inline (filters out mutual
              funds, OTC, warrants per PD-06). Writes to DEV_EODHD_DATA staging
              tables. Idempotent — skips dates already ingested. Tracks cursor
              in SYNC_STATE for resumability.
            </Paragraph>

            <SubHeader id="sync-stage2">
              Stage 2: Validate &amp; Promote
            </SubHeader>
            <Paragraph>
              Four phases: (Phase 1) 6-point data quality audit on DEV — NULL
              checks on critical columns, duplicate detection, row count
              validation, date continuity, price reasonableness, symbol format
              compliance. (Phase 2) DEV to PROD promotion via ANTI JOIN (only
              new rows inserted, never overwrites). (Phase 3) Incremental Weekly
              OHLC rebuild. (Phase 3.5) Dashboard snapshot rebuild. (Phase 4)
              Post-validation + SYNC_LOG entry.
            </Paragraph>
            <div className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
              6-Point DQ Audit Checks
            </div>
            <CodeBlock>{`1. NULL check on critical columns (symbol, date, adjusted_close)
2. Duplicate detection (same symbol+date in last 7 days)
3. Row count validation (≥95% of expected rows)
4. Date continuity (no gaps > 3 business days)
5. Price reasonableness (no negative prices, no > 1000% daily moves)
6. Symbol format compliance (all must end in .US)`}</CodeBlock>

            <SubHeader id="sync-stage3">Stage 3: Score Rebuild</SubHeader>
            <Paragraph>
              Recomputes all 5 JCN composite factor scores (Value, Quality,
              Growth, Financial Strength, Momentum) for 8 different presets.
              Reads from PROD tables, applies scoring algorithms, and writes
              results to the 5 PROD_OBQ_*_Scores tables. Approximately 4.48
              million score rows generated.
            </Paragraph>

            <SubHeader id="sync-prime-directive">
              Prime Directive v1.0
            </SubHeader>
            <Paragraph>
              Eight immutable rules governing all data operations in the sync
              pipeline. These rules cannot be overridden and are enforced at
              every stage.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">
                      ID
                    </th>
                    <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">
                      Rule
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-01
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      NEVER DELETE HISTORICAL DATA. Append-only. Deactivate via
                      is_active=FALSE.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-02
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      POINT-IN-TIME COMPLIANCE. Use filing_date, not
                      quarter_date, for fundamental joins.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-03
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      SYMBOL FORMAT CANONICAL. All tables use TICKER.US format.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-04
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      NO PARTIAL WRITES TO PROD. All writes to DEV first. Gate:
                      ≥95% rows + zero nulls on critical columns.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-05
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      ADJUSTED_CLOSE ONLY. Raw close never used for analysis.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-06
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      SYMBOL CONTAMINATION ZERO TOLERANCE. Filter mutual funds,
                      OTC, warrants at Stage 1.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-07
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      IDEMPOTENT STAGES. Safe to re-run. UPSERT / ANTI JOIN
                      patterns.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      PD-08
                    </td>
                    <td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      CURSOR PERSISTENCE. Long-running stages write progress to
                      SYNC_STATE for resumability.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ============================================================ */}
          {/* SECTION: Caching Architecture */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="caching">Caching Architecture</SectionHeader>

            <SubHeader id="cache-layers">4-Layer Cache</SubHeader>
            <Paragraph>
              JCN uses a multi-layer caching strategy to minimize latency and
              API calls. Each layer has specific TTLs and invalidation rules.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3 text-left text-xs font-medium uppercase text-gray-500">
                      Layer
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Location
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Latency
                    </th>
                    <th className="py-2 pl-3 text-left text-xs font-medium uppercase text-gray-500">
                      TTL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      L3
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      Browser localStorage
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      0ms
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      24hr (perf data), 15min (live prices), 30min (analysis)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      L2
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      Vercel /tmp
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      0ms (warm)
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      Date-based invalidation (new trading day)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      L1
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      PROD_DASHBOARD_SNAPSHOT
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      ~200ms
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      Rebuilt during Stage 2 sync
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      L0
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      Legacy 5-CTE Query
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      2-4s
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      Always available fallback (no cache)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      L4
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      EODHD Real-Time
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      ~500ms
                    </td>
                    <td className="py-2 pl-3 text-gray-600 dark:text-gray-400">
                      15min client-side throttle, manual refresh only
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="cache-ttl">TTL Strategy</SubHeader>
            <Paragraph>
              Cache TTLs are designed around data freshness requirements.
              Portfolio performance data (24hr TTL) only needs daily refresh
              since it uses EOD prices. Live prices (15min TTL) balance
              freshness with API rate limits. Stock analysis data (30min TTL)
              represents quarterly fundamentals that change infrequently.
            </Paragraph>
            <CodeBlock>{`// Cache hierarchy — check in order, return first hit:
1. localStorage (instant)  → if valid TTL, return
2. /tmp file cache (instant if warm)  → if same day, return
3. PROD_DASHBOARD_SNAPSHOT (~200ms)  → pre-computed row, return
4. Legacy 5-CTE query (2-4s)  → full DB query, return + cache
5. EODHD API (500ms)  → live prices only, on manual refresh`}</CodeBlock>
          </section>
        </main>
      </div>
    </div>
  )
}
