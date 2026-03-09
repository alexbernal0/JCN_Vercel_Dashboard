"use client";

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Table of Contents structure
// ---------------------------------------------------------------------------
interface TocItem {
  id: string;
  label: string;
  children?: TocItem[];
}

const TOC: TocItem[] = [
  { id: "overview", label: "Overview", children: [
    { id: "what-is-jcn", label: "What is JCN Financial?" },
    { id: "tech-stack", label: "Technology Stack" },
    { id: "architecture", label: "Architecture" },
  ]},
  { id: "pages", label: "Dashboard Pages", children: [
    { id: "page-persistent-value", label: "Persistent Value" },
    { id: "page-olivia-growth", label: "Olivia Growth" },
    { id: "page-pure-alpha", label: "Pure Alpha" },
    { id: "page-stock-analysis", label: "Stock Analysis" },
    { id: "page-data-sync", label: "Data Sync" },
  ]},
  { id: "portfolio-metrics", label: "Portfolio Metrics", children: [
    { id: "metric-performance", label: "Performance Table" },
    { id: "metric-allocation", label: "Allocation" },
    { id: "metric-benchmarks", label: "Benchmarks & Alpha" },
    { id: "metric-scores", label: "JCN Factor Scores" },
  ]},
  { id: "stock-analysis-metrics", label: "Stock Analysis Metrics", children: [
    { id: "sa-per-share", label: "Per Share Data" },
    { id: "sa-quality-metrics", label: "Quality Metrics" },
    { id: "sa-financial-statements", label: "Financial Statements" },
    { id: "sa-growth-rates", label: "Growth Rates" },
    { id: "sa-valuation", label: "Valuation Ratios" },
    { id: "sa-jcn-scores", label: "JCN Quality Scores" },
  ]},
  { id: "database", label: "Database & Schema", children: [
    { id: "db-motherduck", label: "MotherDuck" },
    { id: "db-prod-survivorship", label: "PROD_EOD_survivorship" },
    { id: "db-prod-etfs", label: "PROD_EOD_ETFs" },
    { id: "db-prod-fundamentals", label: "PROD_EOD_Fundamentals" },
    { id: "db-score-tables", label: "Score Tables" },
    { id: "db-sync-state", label: "SYNC_STATE & SYNC_LOG" },
  ]},
  { id: "eodhd-api", label: "EODHD API", children: [
    { id: "eodhd-overview", label: "API Overview" },
    { id: "eodhd-endpoints", label: "Endpoints Used" },
    { id: "eodhd-rate-limits", label: "Rate Limits" },
  ]},
  { id: "sync-pipeline", label: "Data Sync Pipeline", children: [
    { id: "sync-stage0", label: "Stage 0: Health Check" },
    { id: "sync-stage1", label: "Stage 1: Ingest" },
    { id: "sync-stage2", label: "Stage 2: Validate & Promote" },
    { id: "sync-stage3", label: "Stage 3: Score Rebuild" },
    { id: "sync-prime-directive", label: "Prime Directive" },
  ]},
  { id: "caching", label: "Caching Architecture", children: [
    { id: "cache-layers", label: "4-Layer Cache" },
    { id: "cache-ttl", label: "TTL Strategy" },
  ]},
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function FormulaBlock({ label, formula, note }: { label: string; formula: string; note?: string }) {
  return (
    <div className="my-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{label}</p>
      <pre className="mt-1 overflow-x-auto font-mono text-sm text-gray-900 dark:text-gray-100">{formula}</pre>
      {note && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
  );
}

function MetricRow({ name, formula, description }: { name: string; formula: string; description: string }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-3 pr-4 text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{name}</td>
      <td className="py-3 px-4"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">{formula}</code></td>
      <td className="py-3 pl-4 text-sm text-gray-600 dark:text-gray-400">{description}</td>
    </tr>
  );
}

function SchemaTable({ columns }: { columns: Array<{ name: string; type: string; desc: string }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Column</th>
            <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Type</th>
            <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Description</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col.name} className="border-b border-gray-50 dark:border-gray-800/50">
              <td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">{col.name}</td>
              <td className="py-2 px-4 font-mono text-xs text-gray-500 dark:text-gray-400">{col.type}</td>
              <td className="py-2 pl-4 text-sm text-gray-600 dark:text-gray-400">{col.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 scroll-mt-20 border-b border-gray-200 pb-2 text-xl font-bold text-gray-900 dark:border-gray-700 dark:text-gray-50">
      {children}
    </h2>
  );
}

function SubHeader({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mb-3 mt-8 scroll-mt-20 text-lg font-semibold text-gray-800 dark:text-gray-200">
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{children}</p>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Main Wiki Page
// ---------------------------------------------------------------------------
export default function WikiPage() {
  const [activeSection, setActiveSection] = useState("overview");

  // Intersection observer for active section highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    const headings = document.querySelectorAll("[id]");
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="mx-auto flex max-w-7xl">

        {/* Left TOC Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-gray-200 p-6 dark:border-gray-800 lg:block">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Wiki Contents</h2>
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">JCN Financial Wiki</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Complete reference for the JCN Financial Investment Dashboard — architecture, metrics, data, and methodology.</p>
          </div>

          {/* ============================================================ */}
          {/* SECTION: Overview */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="overview">Overview</SectionHeader>

            <SubHeader id="what-is-jcn">What is JCN Financial?</SubHeader>
            <Paragraph>
              JCN Financial is a production-grade investment dashboard that provides real-time portfolio tracking,
              deep fundamental stock analysis, and institutional-quality data infrastructure. Built for serious
              investors who need survivorship-bias-free data, point-in-time accuracy, and comprehensive fundamental
              screening across the top 1,500 US equities by market capitalization.
            </Paragraph>
            <Paragraph>
              The platform manages three distinct investment portfolios (Persistent Value, Olivia Growth, Pure Alpha),
              each with unique strategies, and offers a full Stock Analysis screener with 10 analytical modules covering
              price performance, per-share data, quality metrics, financial statements, growth rates, valuation, and
              composite quality scoring.
            </Paragraph>

            <SubHeader id="tech-stack">Technology Stack</SubHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Layer</th>
                  <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Technology</th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Purpose</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Frontend</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Next.js 14, React 18, Tailwind CSS</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">SSR, routing, responsive UI</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Charts</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">ECharts 6.0, Recharts</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Interactive charts, radar, line graphs</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">UI Kit</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Tremor v3, Radix UI</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Dashboard components, accessible primitives</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Backend</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">FastAPI (Python)</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Serverless API on Vercel</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Database</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">MotherDuck (DuckDB cloud)</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Analytical warehouse — prices, fundamentals, scores</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Data</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">EODHD API</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">EOD prices, fundamentals, bulk downloads</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Hosting</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Vercel Pro</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Serverless deploy, 300s function timeout</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Caching</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">SWR, localStorage, /tmp</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Multi-layer: browser → serverless → DB</td></tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="architecture">Architecture</SubHeader>
            <Paragraph>
              The application follows a serverless architecture deployed on Vercel. The Next.js frontend communicates
              with Python FastAPI serverless functions via <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">/api/*</code> routes.
              All market data lives in MotherDuck (cloud DuckDB), organized into production tables under the
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">PROD_EODHD</code> database.
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

            <SubHeader id="page-persistent-value">Persistent Value Portfolio</SubHeader>
            <Paragraph>
              A 21-holding portfolio focused on high-quality, durable compounders with strong competitive moats, consistent free cash flow generation, and long-term capital appreciation. Holdings include ASML, COST, AVGO, MA, FICO, SPGI, V, AAPL, NFLX, and others. Uses SPMO as the benchmark ETF.
            </Paragraph>
            <Paragraph>
              Features: real-time performance table with YTD/1Y/3Y/5Y returns, market-cap-weighted allocation pie chart, SPY benchmark comparison with alpha calculation, historical price charts, JCN 5-factor score grid, and quality radar charts. All data loads from MotherDuck with 4-layer cache.
            </Paragraph>

            <SubHeader id="page-olivia-growth">Olivia Growth Portfolio</SubHeader>
            <Paragraph>
              A 20-holding growth-oriented portfolio emphasizing high-momentum technology and infrastructure names. Holdings include GOOG, AMZN, META, NVDA, AMD, CRWD, PLTR, SHOP, and others. Uses QGRW as the benchmark ETF. Identical architecture to Persistent Value.
            </Paragraph>

            <SubHeader id="page-pure-alpha">Pure Alpha Portfolio</SubHeader>
            <Paragraph>
              A concentrated 10-holding high-conviction portfolio designed for maximum alpha generation. Holdings: GEV, GOOG, NVDA, TSLA, PWR, AXON, LRCX, MELI, MU, NFLX. Benchmarked directly against SPY.
            </Paragraph>

            <SubHeader id="page-stock-analysis">Stock Analysis Screener</SubHeader>
            <Paragraph>
              Deep single-stock fundamental analysis page with 10 analytical modules. Limited to the top 1,500 US stocks by current market capitalization. Features smart search with autocomplete, recent search history pills (localStorage, max 10), and animated progress bar.
            </Paragraph>
            <Paragraph>
              Default symbol: NVDA (loaded automatically). All modules always visible. Data fetched in a single API call and cached 30 minutes in both browser and server.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                  <th className="py-2 px-3 text-left text-xs font-medium uppercase text-gray-500">Module</th>
                  <th className="py-2 pl-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr><td className="py-2 pr-3 text-gray-500">1</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Stock Info Header</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">Company name, sector, P/E, Forward P/E, Div Yield, Beta, ROE, Analyst Target</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">2</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Price vs SPY</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">5-year chart indexed to 100. Stock (blue) vs SPY (gray)</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">3</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Per Share Data</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">14 metrics over 10+ years: Revenue/Share, EPS, FCF/Share, Book Value, Yields</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">4</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Quality Metrics</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">17 ratios: Margins, Returns, Leverage, Efficiency</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">5</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Income Statement</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">Hierarchical P&L with expandable parent-child rows</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">6</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Balance Sheet</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">Assets, Liabilities, Equity with 3-level hierarchy</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">7</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Cash Flows</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">Operating, Investing, Financing sub-items. Free Cash Flow.</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">8</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Growth Rates</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">YoY growth, 12 metrics, heatmap coloring</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">9</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Valuation Ratios</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">9 valuation metrics + analyst consensus bar</td></tr>
                  <tr><td className="py-2 pr-3 text-gray-500">10</td><td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">JCN Scores</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">6-dimension composite scoring (0-100) with radar chart</td></tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="page-data-sync">Data Sync Pipeline</SubHeader>
            <Paragraph>
              A 4-stage automated data pipeline that ingests daily EOD prices from EODHD, validates data quality, promotes to production, and rebuilds composite scores. Each stage is idempotent and safe to re-run. See the Sync Pipeline section for details.
            </Paragraph>
          </section>

          {/* ============================================================ */}
          {/* SECTION: Portfolio Metrics */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="portfolio-metrics">Portfolio Metrics</SectionHeader>

            <SubHeader id="metric-performance">Performance Table</SubHeader>
            <Paragraph>
              Each portfolio page displays a performance table showing every holding with current price, daily change, and period returns. Prices come from EODHD real-time API (15-min delayed) or MotherDuck historical data.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Formula</th>
                <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Description</th>
              </tr></thead>
              <tbody>
                <MetricRow name="Current Price" formula="EODHD real-time or latest adjusted_close" description="Most recent price, 15-min delayed max" />
                <MetricRow name="Daily Change %" formula="(close_today - close_yesterday) / close_yesterday * 100" description="Percentage move from prior close" />
                <MetricRow name="YTD Return" formula="(price_now - price_jan1) / price_jan1 * 100" description="Year-to-date total return" />
                <MetricRow name="1Y Return" formula="(price_now - price_1yr_ago) / price_1yr_ago * 100" description="Trailing 12-month return" />
                <MetricRow name="3Y Return" formula="(price_now - price_3yr_ago) / price_3yr_ago * 100" description="Trailing 3-year cumulative return" />
                <MetricRow name="5Y Return" formula="(price_now - price_5yr_ago) / price_5yr_ago * 100" description="Trailing 5-year cumulative return" />
              </tbody>
            </table>

            <SubHeader id="metric-allocation">Allocation</SubHeader>
            <Paragraph>
              Portfolio allocation is displayed as a pie chart, categorized by market cap tier: Mega Cap (above $200B), Large Cap ($10B-$200B), Mid Cap ($2B-$10B), Small Cap (below $2B), and ETF. Allocation weights are equal-weight by default.
            </Paragraph>

            <SubHeader id="metric-benchmarks">Benchmarks and Alpha</SubHeader>
            <Paragraph>
              Each portfolio is benchmarked against SPY (S&P 500 ETF) and a portfolio-specific ETF. Alpha is calculated as the excess return of the portfolio over SPY for each time period.
            </Paragraph>
            <FormulaBlock
              label="Alpha Calculation"
              formula="Alpha = Portfolio Return - SPY Return"
              note="Calculated for YTD, 1Y, 3Y, and 5Y periods. Positive alpha indicates outperformance."
            />

            <SubHeader id="metric-scores">JCN Factor Scores</SubHeader>
            <Paragraph>
              Each stock in a portfolio receives five composite factor scores (0-100), computed monthly from fundamental data and stored in dedicated score tables in MotherDuck. These scores power the radar charts and fundamentals grid on each portfolio page.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Score</th>
                <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">DB Column</th>
                <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Methodology</th>
              </tr></thead>
              <tbody>
                <MetricRow name="Value Score" formula="value_score_composite" description="Ranks stocks by valuation attractiveness. Combines P/E, P/B, P/S, EV/EBITDA, and FCF yield relative to sector peers. Lower valuations score higher." />
                <MetricRow name="Quality Score" formula="quality_score_composite" description="Measures business quality via gross margin stability, ROE consistency, earnings quality (accruals), and balance sheet strength." />
                <MetricRow name="Growth Score" formula="growth_score_composite" description="Evaluates revenue growth, earnings growth, and forward estimates. Combines trailing 3Y CAGR with analyst consensus forward growth." />
                <MetricRow name="Financial Strength" formula="finstr_score_composite" description="Assesses balance sheet health: current ratio, debt-to-equity, interest coverage, Altman Z-score components, and cash flow adequacy." />
                <MetricRow name="Momentum Score" formula="momentum_score_composite" description="Price momentum signal based on 12-1 month return (skip most recent month). Captures intermediate-term trend persistence." />
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
            <SectionHeader id="stock-analysis-metrics">Stock Analysis Metrics</SectionHeader>
            <Paragraph>
              Every metric displayed in the Stock Analysis screener is computed server-side from PROD_EOD_Fundamentals quarterly data, aggregated into annual figures. P&L and Cash Flow items are summed across quarters; Balance Sheet items use the latest quarter in each calendar year.
            </Paragraph>

            <SubHeader id="sa-per-share">Per Share Data (Module 3)</SubHeader>
            <Paragraph>
              Annual per-share metrics calculated by dividing aggregate financials by shares outstanding. Shares use bs_commonStockSharesOutstanding (quarterly historical), falling back to shares_outstanding (snapshot) if unavailable.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Formula</th>
                <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Description</th>
              </tr></thead>
              <tbody>
                <MetricRow name="Revenue/Share" formula="is_totalRevenue / shares" description="Total annual revenue divided by shares outstanding" />
                <MetricRow name="EPS" formula="is_netIncome / shares" description="Earnings per share — net income allocated to each share" />
                <MetricRow name="FCF/Share" formula="cf_freeCashFlow / shares" description="Free cash flow per share — cash available after capex" />
                <MetricRow name="EBITDA/Share" formula="is_ebitda / shares" description="Earnings before interest, taxes, depreciation, amortization per share" />
                <MetricRow name="Book Value/Share" formula="bs_totalStockholderEquity / shares" description="Net asset value per share (equity / shares)" />
                <MetricRow name="Operating CF/Share" formula="cf_totalCashFromOperatingActivities / shares" description="Cash from operations per share" />
                <MetricRow name="Dividend/Share" formula="-cf_dividendsPaid / shares" description="Annual dividend paid per share (dividends are negative in cash flow)" />
                <MetricRow name="Buyback Yield" formula="-cf_salePurchaseOfStock / market_cap" description="Share repurchases as a percentage of market cap" />
                <MetricRow name="Dividend Yield" formula="-cf_dividendsPaid / market_cap" description="Annual dividends as a percentage of market cap" />
                <MetricRow name="Total Return Yield" formula="(-dividends + -buybacks) / market_cap" description="Combined shareholder yield from dividends and buybacks" />
                <MetricRow name="Shares Outstanding" formula="bs_commonStockSharesOutstanding / 1M" description="Total shares outstanding in millions" />
                <MetricRow name="Revenue ($M)" formula="is_totalRevenue / 1M" description="Total annual revenue in millions" />
                <MetricRow name="Net Income ($M)" formula="is_netIncome / 1M" description="Total annual net income in millions" />
                <MetricRow name="Free Cash Flow ($M)" formula="cf_freeCashFlow / 1M" description="Annual free cash flow in millions" />
              </tbody>
            </table>

            <SubHeader id="sa-quality-metrics">Quality Metrics (Module 4)</SubHeader>
            <Paragraph>
              Annual quality ratios measuring profitability, returns on capital, leverage, and operational efficiency. All computed from aggregated annual data.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Formula</th>
                <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Description</th>
              </tr></thead>
              <tbody>
                <MetricRow name="Gross Margin" formula="is_grossProfit / is_totalRevenue" description="Revenue retained after cost of goods sold. Higher = stronger pricing power." />
                <MetricRow name="Operating Margin" formula="is_operatingIncome / is_totalRevenue" description="Profitability from core operations after operating expenses." />
                <MetricRow name="Net Margin" formula="is_netIncome / is_totalRevenue" description="Bottom-line profitability after all expenses, interest, and taxes." />
                <MetricRow name="EBITDA Margin" formula="is_ebitda / is_totalRevenue" description="Cash earnings margin before non-cash charges and financing." />
                <MetricRow name="FCF Margin" formula="cf_freeCashFlow / is_totalRevenue" description="Free cash flow as percentage of revenue. Measures cash conversion." />
                <MetricRow name="ROIC" formula="is_netIncome / (equity + longTermDebt)" description="Return on invested capital. Measures efficiency of capital allocation." />
                <MetricRow name="ROE" formula="is_netIncome / bs_totalStockholderEquity" description="Return on equity. Profit generated per dollar of shareholder equity." />
                <MetricRow name="ROA" formula="is_netIncome / bs_totalAssets" description="Return on assets. Profit generated per dollar of total assets." />
                <MetricRow name="ROCE" formula="is_operatingIncome / (equity + longTermDebt)" description="Return on capital employed. Operating profit on invested capital." />
                <MetricRow name="Debt/Equity" formula="bs_totalLiab / bs_totalStockholderEquity" description="Total leverage ratio. Higher = more leveraged balance sheet." />
                <MetricRow name="LT Debt/Equity" formula="bs_longTermDebt / bs_totalStockholderEquity" description="Long-term debt leverage. Excludes short-term obligations." />
                <MetricRow name="Current Ratio" formula="bs_totalCurrentAssets / bs_totalCurrentLiabilities" description="Short-term liquidity. Above 1.0 = can cover near-term obligations." />
                <MetricRow name="Interest Coverage" formula="is_operatingIncome / is_interestExpense" description="Ability to service debt. Higher = more comfortable debt burden." />
                <MetricRow name="Asset Turnover" formula="is_totalRevenue / bs_totalAssets" description="Revenue generated per dollar of assets. Measures asset efficiency." />
                <MetricRow name="CapEx/Revenue" formula="abs(cf_capitalExpenditures) / is_totalRevenue" description="Capital intensity. How much revenue is reinvested in fixed assets." />
                <MetricRow name="FCF Conversion" formula="cf_freeCashFlow / is_netIncome" description="How much net income converts to free cash flow. Above 1.0 = high quality." />
                <MetricRow name="Cash Conversion" formula="cf_operatingCashFlow / is_netIncome" description="Operating cash flow relative to reported earnings. Earnings quality check." />
              </tbody>
            </table>

            <SubHeader id="sa-financial-statements">Financial Statements (Modules 5-7)</SubHeader>
            <Paragraph>
              Income Statement, Balance Sheet, and Cash Flows are displayed as hierarchical tables with expandable parent-child rows. All values are shown in millions ($M). Quarterly data is aggregated into annual: P&L and Cash Flow items are summed, Balance Sheet items use the latest quarter.
            </Paragraph>
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Income Statement Hierarchy</div>
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
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Balance Sheet Hierarchy</div>
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
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Cash Flow Hierarchy</div>
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
              Year-over-year growth rates for 12 key financial metrics. Computed as percentage change from the prior year. Displayed with heatmap coloring: deep green for high growth, red for contraction, gray for null.
            </Paragraph>
            <FormulaBlock
              label="YoY Growth Rate"
              formula="growth_pct = (current_year - prior_year) / abs(prior_year) * 100"
              note="Null if either year is missing or prior year is zero. Absolute value in denominator handles negative base values."
            />
            <Paragraph>
              Tracked metrics: Revenue, Gross Profit, Operating Income, EBITDA, Net Income, EPS, Free Cash Flow, Operating Cash Flow, Total Assets, Stockholder Equity, Long-Term Debt, Dividends Paid.
            </Paragraph>

            <SubHeader id="sa-valuation">Valuation Ratios (Module 9)</SubHeader>
            <Paragraph>
              Current snapshot valuation multiples from EODHD. These are point-in-time values (not historical per quarter) and represent the latest available data for each stock.
            </Paragraph>
            <table className="mb-6 w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Formula</th>
                <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Description</th>
              </tr></thead>
              <tbody>
                <MetricRow name="P/E Ratio" formula="price / EPS (trailing)" description="Price relative to trailing 12-month earnings" />
                <MetricRow name="Forward P/E" formula="price / forward EPS estimate" description="Price relative to consensus forward earnings estimate" />
                <MetricRow name="PEG Ratio" formula="P/E / earnings growth rate" description="P/E adjusted for growth. Below 1.0 suggests undervaluation relative to growth." />
                <MetricRow name="Price/Book" formula="price / book value per share" description="Market price relative to net asset value. Below 1.0 = trading below book." />
                <MetricRow name="Price/Sales" formula="market_cap / revenue_ttm" description="Market cap relative to trailing revenue. Lower = cheaper on revenue basis." />
                <MetricRow name="EV/EBITDA" formula="enterprise_value / ebitda" description="Enterprise value per unit of operating cash earnings. Standard M&A metric." />
                <MetricRow name="EV/Revenue" formula="enterprise_value / revenue_ttm" description="Enterprise value per unit of revenue. Capital-structure-neutral valuation." />
                <MetricRow name="Trailing P/E" formula="price / trailing EPS" description="Price to trailing earnings (may differ from standard P/E by data source)." />
                <MetricRow name="Dividend Yield" formula="annual_dividend / price" description="Annual dividend as percentage of current share price." />
              </tbody>
            </table>

            <SubHeader id="sa-jcn-scores">JCN Quality Scores (Module 10)</SubHeader>
            <Paragraph>
              Composite quality scores computed from the most recent 4 years of fundamental data. Each dimension is scored 0-100 by normalizing a key ratio to a predefined range. The overall score is the simple average of all six dimensions.
            </Paragraph>
            <table className="mb-4 w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Dimension</th>
                <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Input Metric</th>
                <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Range [Low, High]</th>
                <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">What it Measures</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Profitability</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Gross Margin</td><td className="py-2 px-4"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">[0%, 70%]</code></td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Pricing power and cost efficiency</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Returns</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">ROE (4yr avg)</td><td className="py-2 px-4"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">[-10%, 50%]</code></td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Shareholder return generation</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Efficiency</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">ROA (4yr avg)</td><td className="py-2 px-4"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">[-5%, 20%]</code></td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Asset utilization effectiveness</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Cash Generation</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">FCF Margin (4yr avg)</td><td className="py-2 px-4"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">[-10%, 30%]</code></td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Ability to convert revenue to free cash</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Financial Health</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Current Ratio (4yr avg)</td><td className="py-2 px-4"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">[0.5x, 3.0x]</code></td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Short-term liquidity and solvency</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Growth</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Revenue CAGR (4yr)</td><td className="py-2 px-4"><code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">[-10%, 30%]</code></td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Top-line growth trajectory</td></tr>
              </tbody>
            </table>
            <FormulaBlock
              label="Dimension Score"
              formula="score = round((clamp(value, low, high) - low) / (high - low) * 100)"
              note="Value clamped to [low, high], then linearly mapped to 0-100. Score of 50 = median of the range."
            />
            <FormulaBlock
              label="Overall Score"
              formula="overall = round(mean(profitability, returns, efficiency, cash_gen, health, growth))"
              note="Simple average of all 6 dimension scores. Displayed as the center value on the radar chart."
            />
          </section>

          {/* ============================================================ */}
          {/* SECTION: Database & Schema */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="database">Database &amp; Schema</SectionHeader>

            <SubHeader id="db-motherduck">MotherDuck</SubHeader>
            <Paragraph>
              MotherDuck is a cloud-hosted DuckDB service that provides the analytical warehouse for all JCN data. Single-writer architecture (concurrent writes fail silently). Connection via MOTHERDUCK_TOKEN environment variable. All symbols stored in TICKER.US format (e.g., AAPL.US).
            </Paragraph>
            <CodeBlock>{`-- Connection pattern
conn = duckdb.connect(f'md:?motherduck_token={token}')

-- Database layout
PROD_EODHD.main.*        -- Production tables (read by dashboard)
DEV_EODHD_DATA.main.*    -- Staging tables (written by sync pipeline)`}</CodeBlock>

            <SubHeader id="db-prod-survivorship">PROD_EOD_survivorship</SubHeader>
            <Paragraph>
              The primary price table. Contains daily OHLC + adjusted_close for all US common stocks and ADRs, including delisted symbols (survivorship-bias free). Over 121 million rows. Zone-map optimized by (date, symbol).
            </Paragraph>
            <SchemaTable columns={[
              { name: "symbol", type: "VARCHAR", desc: "Ticker in TICKER.US format (e.g., AAPL.US)" },
              { name: "date", type: "DATE", desc: "Trading date" },
              { name: "open", type: "DOUBLE", desc: "Opening price" },
              { name: "high", type: "DOUBLE", desc: "Intraday high" },
              { name: "low", type: "DOUBLE", desc: "Intraday low" },
              { name: "close", type: "DOUBLE", desc: "Raw closing price (NOT used for analysis)" },
              { name: "adjusted_close", type: "DOUBLE", desc: "Split/dividend-adjusted close (PRIMARY price field)" },
              { name: "isin", type: "VARCHAR", desc: "International Securities Identification Number" },
              { name: "in_sp500", type: "BOOLEAN", desc: "Current S&P 500 membership" },
              { name: "gics_sector", type: "VARCHAR", desc: "GICS sector classification" },
              { name: "industry", type: "VARCHAR", desc: "Industry sub-classification" },
              { name: "market_cap", type: "DOUBLE", desc: "Latest market capitalization in USD" },
              { name: "listing_date", type: "DATE", desc: "IPO / listing date" },
              { name: "delisting_date", type: "DATE", desc: "Delisting date (NULL if still active)" },
              { name: "is_active", type: "BOOLEAN", desc: "TRUE if currently trading" },
              { name: "instrument_type", type: "VARCHAR", desc: "Common Stock, ADR, etc." },
            ]} />

            <SubHeader id="db-prod-etfs">PROD_EOD_ETFs</SubHeader>
            <Paragraph>
              Daily OHLC + adjusted_close for ETFs. SPY.US is the primary benchmark. Same structure as survivorship but without survivorship metadata columns.
            </Paragraph>
            <SchemaTable columns={[
              { name: "symbol", type: "VARCHAR", desc: "ETF ticker in TICKER.US format (e.g., SPY.US)" },
              { name: "date", type: "DATE", desc: "Trading date" },
              { name: "open", type: "DOUBLE", desc: "Opening price" },
              { name: "high", type: "DOUBLE", desc: "Intraday high" },
              { name: "low", type: "DOUBLE", desc: "Intraday low" },
              { name: "close", type: "DOUBLE", desc: "Raw closing price" },
              { name: "adjusted_close", type: "DOUBLE", desc: "Adjusted close (PRIMARY)" },
              { name: "isin", type: "VARCHAR", desc: "ISIN identifier" },
            ]} />

            <SubHeader id="db-prod-fundamentals">PROD_EOD_Fundamentals</SubHeader>
            <Paragraph>
              Quarterly fundamental data for all US stocks. 196 columns covering income statement (is_*), balance sheet (bs_*), cash flow (cf_*), valuation snapshots, analyst estimates, and company metadata. Over 160 quarters of history for major stocks.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Column Group</th>
                  <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Prefix</th>
                  <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Aggregation</th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Key Columns</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Identity</td><td className="py-2 px-4"><code className="text-xs">symbol, date, filing_date</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">N/A</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">symbol (VARCHAR), date (quarter end), filing_date (SEC filing date)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Company Info</td><td className="py-2 px-4"><code className="text-xs">company_name, sector, industry</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Latest</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">sector, industry, gic_sector, gic_industry, exchange</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Income Statement</td><td className="py-2 px-4"><code className="text-xs">is_*</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">SUM across quarters</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">is_totalRevenue, is_grossProfit, is_operatingIncome, is_ebitda, is_netIncome</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Balance Sheet</td><td className="py-2 px-4"><code className="text-xs">bs_*</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Latest quarter in year</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">bs_totalAssets, bs_totalLiab, bs_totalStockholderEquity, bs_cash, bs_longTermDebt</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Cash Flow</td><td className="py-2 px-4"><code className="text-xs">cf_*</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">SUM across quarters</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">cf_totalCashFromOperatingActivities, cf_capitalExpenditures, cf_freeCashFlow</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Valuation (snapshot)</td><td className="py-2 px-4"><code className="text-xs">pe_ratio, forward_pe, ...</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Latest (overwritten)</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">market_cap, pe_ratio, forward_pe, peg_ratio, enterprise_value, dividend_yield</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Analyst</td><td className="py-2 px-4"><code className="text-xs">analyst_*</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Latest (overwritten)</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">analyst_target_price, analyst_buy, analyst_hold, analyst_sell, analyst_rating</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Shares</td><td className="py-2 px-4"><code className="text-xs">shares_outstanding, bs_common...</code></td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Latest / Historical</td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">shares_outstanding (snapshot), bs_commonStockSharesOutstanding (per quarter)</td></tr>
                </tbody>
              </table>
            </div>
            <Paragraph>
              Important: Valuation fields (market_cap, pe_ratio, etc.) are SNAPSHOT values — identical across all quarters for a given symbol. They represent the CURRENT latest value, not historical. Only financial statement columns (is_*, bs_*, cf_*) contain true historical quarterly data.
            </Paragraph>

            <SubHeader id="db-score-tables">Score Tables</SubHeader>
            <Paragraph>
              Five separate score tables, each containing monthly composite scores per symbol. Rebuilt during Stage 3 of the sync pipeline. Used by portfolio pages for the JCN 5-factor score grid and radar charts.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Table</th>
                  <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Score Column</th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Key Columns</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">PROD_OBQ_Value_Scores</td><td className="py-2 px-4"><code className="text-xs">value_score_composite</code></td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">symbol, month_date, value_score_composite</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">PROD_OBQ_Quality_Scores</td><td className="py-2 px-4"><code className="text-xs">quality_score_composite</code></td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">symbol, month_date, quality_score_composite</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">PROD_OBQ_Growth_Scores</td><td className="py-2 px-4"><code className="text-xs">growth_score_composite</code></td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">symbol, month_date, growth_score_composite</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">PROD_OBQ_FinStr_Scores</td><td className="py-2 px-4"><code className="text-xs">finstr_score_composite</code></td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">symbol, month_date, finstr_score_composite</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">PROD_OBQ_Momentum_Scores</td><td className="py-2 px-4"><code className="text-xs">momentum_score_composite</code></td><td className="py-2 pl-4 text-xs text-gray-600 dark:text-gray-400">symbol, month_date, momentum_score_composite</td></tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="db-sync-state">SYNC_STATE &amp; SYNC_LOG</SubHeader>
            <Paragraph>
              SYNC_STATE stores the current state of each sync stage (last run timestamp, status, cursor position for resumable operations). SYNC_LOG records every sync run with timing, row counts, and error details. Both tables enable the Prime Directive PD-08 (cursor persistence) and provide audit trail.
            </Paragraph>
          </section>

          {/* ============================================================ */}
          {/* SECTION: EODHD API */}
          {/* ============================================================ */}
          <section className="mb-12">
            <SectionHeader id="eodhd-api">EODHD API</SectionHeader>

            <SubHeader id="eodhd-overview">API Overview</SubHeader>
            <Paragraph>
              EODHD (End of Day Historical Data) is the primary external data provider for JCN Financial. It supplies daily end-of-day prices, quarterly fundamentals, and company metadata for all US-listed securities including common stocks, ADRs, and ETFs. Data is point-in-time accurate using SEC filing dates.
            </Paragraph>

            <SubHeader id="eodhd-endpoints">Endpoints Used</SubHeader>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Endpoint</th>
                  <th className="py-2 px-4 text-left text-xs font-medium uppercase text-gray-500">Used In</th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Purpose</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">/api/eod-bulk-last-day/US</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Stage 1 (Ingest)</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Bulk download of latest EOD prices for all US symbols in a single API call</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">/api/real-time/[symbol].US</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Live Prices</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">15-min delayed real-time quotes for portfolio current prices</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs text-blue-600 dark:text-blue-400">/api/fundamentals/[symbol].US</td><td className="py-2 px-4 text-gray-600 dark:text-gray-400">Fundamentals Sync</td><td className="py-2 pl-4 text-gray-600 dark:text-gray-400">Quarterly financial statements, valuation, analyst data</td></tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="eodhd-rate-limits">Rate Limits</SubHeader>
            <Paragraph>
              EODHD enforces rate limits of 1,000 API calls per minute and 100,000 calls per day. The sync pipeline uses bulk endpoints to minimize call count. Real-time price fetches for portfolios are throttled to one refresh per 15 minutes (client-side localStorage cache) and only trigger on manual refresh button click or TTL expiry.
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
              The sync pipeline is a 4-stage process that maintains the production database. Each stage is independently runnable, idempotent, and designed to operate within Vercel Pro 300-second function timeout (280s budget with 20s safety buffer).
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
              Runs 8 diagnostic checks before any sync operation: (1) MotherDuck connectivity, (2) EODHD API key validation, (3) Required tables existence with estimated row counts, (4) Last sync timestamp from SYNC_STATE, (5) Symbol format consistency (PD-03 — all must be TICKER.US), (6) Fundamentals coverage ratio, (7) Gap analysis (latest date vs today), (8) Duplicate detection in last 7 days. Uses sampled queries and LIMIT 1 patterns for speed. Results cached 5 minutes.
            </Paragraph>

            <SubHeader id="sync-stage1">Stage 1: Ingest</SubHeader>
            <Paragraph>
              Downloads daily EOD prices for all US symbols via EODHD bulk endpoint (/api/eod-bulk-last-day/US). Separates stocks from ETFs based on exchange code. Validates inline (filters out mutual funds, OTC, warrants per PD-06). Writes to DEV_EODHD_DATA staging tables. Idempotent — skips dates already ingested. Tracks cursor in SYNC_STATE for resumability.
            </Paragraph>

            <SubHeader id="sync-stage2">Stage 2: Validate &amp; Promote</SubHeader>
            <Paragraph>
              Four phases: (Phase 1) 6-point data quality audit on DEV — NULL checks on critical columns, duplicate detection, row count validation, date continuity, price reasonableness, symbol format compliance. (Phase 2) DEV to PROD promotion via ANTI JOIN (only new rows inserted, never overwrites). (Phase 3) Incremental Weekly OHLC rebuild. (Phase 3.5) Dashboard snapshot rebuild. (Phase 4) Post-validation + SYNC_LOG entry.
            </Paragraph>
            <div className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">6-Point DQ Audit Checks</div>
            <CodeBlock>{`1. NULL check on critical columns (symbol, date, adjusted_close)
2. Duplicate detection (same symbol+date in last 7 days)
3. Row count validation (≥95% of expected rows)
4. Date continuity (no gaps > 3 business days)
5. Price reasonableness (no negative prices, no > 1000% daily moves)
6. Symbol format compliance (all must end in .US)`}</CodeBlock>

            <SubHeader id="sync-stage3">Stage 3: Score Rebuild</SubHeader>
            <Paragraph>
              Recomputes all 5 JCN composite factor scores (Value, Quality, Growth, Financial Strength, Momentum) for 8 different presets. Reads from PROD tables, applies scoring algorithms, and writes results to the 5 PROD_OBQ_*_Scores tables. Approximately 4.48 million score rows generated.
            </Paragraph>

            <SubHeader id="sync-prime-directive">Prime Directive v1.0</SubHeader>
            <Paragraph>
              Eight immutable rules governing all data operations in the sync pipeline. These rules cannot be overridden and are enforced at every stage.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Rule</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-01</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">NEVER DELETE HISTORICAL DATA. Append-only. Deactivate via is_active=FALSE.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-02</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">POINT-IN-TIME COMPLIANCE. Use filing_date, not quarter_date, for fundamental joins.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-03</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">SYMBOL FORMAT CANONICAL. All tables use TICKER.US format.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-04</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">NO PARTIAL WRITES TO PROD. All writes to DEV first. Gate: ≥95% rows + zero nulls on critical columns.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-05</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">ADJUSTED_CLOSE ONLY. Raw close never used for analysis.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-06</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">SYMBOL CONTAMINATION ZERO TOLERANCE. Filter mutual funds, OTC, warrants at Stage 1.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-07</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">IDEMPOTENT STAGES. Safe to re-run. UPSERT / ANTI JOIN patterns.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PD-08</td><td className="py-2 pl-4 text-sm text-gray-700 dark:text-gray-300">CURSOR PERSISTENCE. Long-running stages write progress to SYNC_STATE for resumability.</td></tr>
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
              JCN uses a multi-layer caching strategy to minimize latency and API calls. Each layer has specific TTLs and invalidation rules.
            </Paragraph>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 text-left text-xs font-medium uppercase text-gray-500">Layer</th>
                  <th className="py-2 px-3 text-left text-xs font-medium uppercase text-gray-500">Location</th>
                  <th className="py-2 px-3 text-left text-xs font-medium uppercase text-gray-500">Latency</th>
                  <th className="py-2 pl-3 text-left text-xs font-medium uppercase text-gray-500">TTL</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  <tr><td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">L3</td><td className="py-2 px-3 text-gray-700 dark:text-gray-300">Browser localStorage</td><td className="py-2 px-3 text-gray-600 dark:text-gray-400">0ms</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">24hr (perf data), 15min (live prices), 30min (analysis)</td></tr>
                  <tr><td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">L2</td><td className="py-2 px-3 text-gray-700 dark:text-gray-300">Vercel /tmp</td><td className="py-2 px-3 text-gray-600 dark:text-gray-400">0ms (warm)</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">Date-based invalidation (new trading day)</td></tr>
                  <tr><td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">L1</td><td className="py-2 px-3 text-gray-700 dark:text-gray-300">PROD_DASHBOARD_SNAPSHOT</td><td className="py-2 px-3 text-gray-600 dark:text-gray-400">~200ms</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">Rebuilt during Stage 2 sync</td></tr>
                  <tr><td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">L0</td><td className="py-2 px-3 text-gray-700 dark:text-gray-300">Legacy 5-CTE Query</td><td className="py-2 px-3 text-gray-600 dark:text-gray-400">2-4s</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">Always available fallback (no cache)</td></tr>
                  <tr><td className="py-2 pr-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">L4</td><td className="py-2 px-3 text-gray-700 dark:text-gray-300">EODHD Real-Time</td><td className="py-2 px-3 text-gray-600 dark:text-gray-400">~500ms</td><td className="py-2 pl-3 text-gray-600 dark:text-gray-400">15min client-side throttle, manual refresh only</td></tr>
                </tbody>
              </table>
            </div>

            <SubHeader id="cache-ttl">TTL Strategy</SubHeader>
            <Paragraph>
              Cache TTLs are designed around data freshness requirements. Portfolio performance data (24hr TTL) only needs daily refresh since it uses EOD prices. Live prices (15min TTL) balance freshness with API rate limits. Stock analysis data (30min TTL) represents quarterly fundamentals that change infrequently.
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
  );
}