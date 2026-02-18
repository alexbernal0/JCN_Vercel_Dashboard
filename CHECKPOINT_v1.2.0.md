# Checkpoint v1.2.0 - Portfolio Fundamentals, Aggregated Metrics, Stock Price Comparison

**Date:** February 18, 2026  
**Status:** Production Ready ✅  
**Tag:** `v1.2.0-fundamentals-aggregated`

---

## 🎯 What's New in v1.2.0

### Major Features Added

1. **Portfolio Fundamentals Table** 📊
   - One row per portfolio stock, 5 score columns: Value, Growth, Financial Strength, Quality, Momentum
   - Data from MotherDuck: `PROD_OBQ_Scores` (symbols without .US), `PROD_OBQ_Momentum_Scores` (symbols with .US)
   - Handles both .US and non-.US symbol formats in DB
   - Momentum fallback: `obq_momentum_score` or `systemscore` when null
   - Compact Tremor table (same style as Portfolio Performance Details)

2. **Portfolio Aggregated Metrics Table** 📈
   - Rows: Max, Median, Average, Min (across portfolio)
   - Columns: Value, Growth, Financial Strength, Quality, Momentum
   - Computed client-side from fundamentals API response
   - Same compact table format

3. **Normalized Stock Price Comparison Chart** 📉
   - ECharts line chart: normalized return % (price / first price - 1) × 100
   - One line per stock; time-period buttons (1M, 3M, 6M, 1Y, 5Y, 10Y, 20Y) filter to that period
   - Data from `/api/stock/prices` (MotherDuck PROD_EOD_survivorship)
   - Tooltip: date + each series as +/-X.XX%; deduplicated by series name
   - One series per stock (deduped symbols, canonical keys)

4. **Placeholder Cleanup** 🧹
   - Removed duplicate/placeholder sections below Portfolio Aggregated Metrics:
     - Portfolio Holdings (duplicate table)
     - Portfolio Allocation (placeholder grid)
     - Normalized Stock Price Comparison (placeholder block)
     - Fundamental Metrics (placeholder)
     - Quality Metrics Radar (placeholder)
   - Real modules (Performance, Benchmarks, Allocation, Stock Price Comparison, Fundamentals, Aggregated Metrics) unchanged and in order.

---

## 📁 File Structure (v1.2.0)

```
JCN_Vercel_Dashboard/
├── api/
│   ├── index.py                    # FastAPI app; all routes
│   ├── portfolio_performance.py    # Performance metrics from MotherDuck
│   ├── portfolio_allocation.py     # Allocation pie-chart data
│   ├── portfolio_fundamentals.py    # OBQ + Momentum scores (5 columns)
│   ├── benchmarks.py               # SPY comparison, alpha
│   ├── stock_prices_module.py      # Historical prices for chart
│   ├── cache_manager.py            # MotherDuck cache (24hr)
│   ├── cache_utils.py
│   ├── cache_manager_old.py        # Legacy; not used by app
│   └── __init__.py
├── src/
│   ├── app/
│   │   ├── page.tsx                # Landing
│   │   ├── layout.tsx
│   │   └── (dashboard)/
│   │       ├── dashboard/page.tsx
│   │       ├── persistent-value/page.tsx  # Main portfolio page
│   │       ├── olivia-growth/page.tsx     # Under construction
│   │       ├── pure-alpha/page.tsx
│   │       ├── stock-analysis/page.tsx
│   │       ├── market-analysis/page.tsx
│   │       ├── risk-management/page.tsx
│   │       └── about/page.tsx
│   ├── components/dashboard/
│   │   ├── PortfolioPerformanceTable.tsx
│   │   ├── Benchmarks.tsx
│   │   ├── PortfolioAllocation.tsx
│   │   ├── StockPriceComparison.tsx
│   │   ├── PortfolioFundamentalsTable.tsx
│   │   ├── PortfolioAggregatedMetricsTable.tsx
│   │   ├── PortfolioInput.tsx
│   │   ├── Sidebar.tsx
│   │   ├── UnderConstruction.tsx
│   │   └── MetricCard.tsx
│   └── lib/
│       └── swr-provider.tsx
├── scripts/
│   ├── describe_score_tables.py    # List OBQ/Momentum columns
│   └── check_fundamentals_data.py   # Diagnose score data for symbols
├── docs/                            # All procedure & reference docs
├── CHECKPOINT_v1.0.0.md
├── CHECKPOINT_v1.1.0.md
├── CHECKPOINT_v1.2.0.md             # This file
├── CHECKPOINTS.md
├── README.md
├── ARCHITECTURE.md
├── DATA_FLOW.md
├── BUILDING_GUIDE.md
├── TECH_STACK.md
├── PAGE_LAYOUTS.md
├── vercel.json
├── next.config.mjs
├── requirements.txt
└── package.json
```

---

## 🔌 API Endpoints (v1.2.0)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | API info and endpoint list |
| GET | `/api/health` | Health check; MOTHERDUCK_TOKEN presence |
| POST | `/api/portfolio/performance` | Portfolio performance (holdings body) |
| POST | `/api/portfolio/allocation` | Allocation for pie charts |
| POST | `/api/portfolio/fundamentals` | 5 scores per symbol (OBQ + Momentum) |
| POST | `/api/benchmarks` | Benchmarks vs SPY |
| POST | `/api/stock/prices` | Historical daily prices (symbols body) |

---

## 🗄️ MotherDuck Tables Used

| Database | Table | Symbol format | Use |
|----------|-------|----------------|-----|
| PROD_EODHD | PROD_EOD_survivorship | .US (e.g. AAPL.US) | Prices, sector, 52wk, YTD, YoY |
| PROD_EODHD | PROD_EOD_ETFs | .US | SPY for benchmarks |
| PROD_EODHD | PROD_OBQ_Scores | No .US (e.g. AAPL) | Value, Growth, FS, Quality |
| PROD_EODHD | PROD_OBQ_Momentum_Scores | .US (e.g. AAPL.US) | Momentum (obq_momentum_score / systemscore) |

---

## 📊 Persistent Value Page Order (Top to Bottom)

1. Header (title, refresh, last updated)
2. Portfolio Performance Details (Tremor table)
3. Benchmarks
4. Portfolio Allocation (4 pie charts)
5. Stock Price Comparison (ECharts normalized return chart)
6. Portfolio Fundamentals (5 scores per stock)
7. Portfolio Aggregated Metrics (Max / Median / Avg / Min)
8. Portfolio Input (fixed at bottom)

---

## 🔄 How to Use This Checkpoint

### Revert to This Checkpoint

```bash
git checkout v1.2.0-fundamentals-aggregated
```

### Create Branch from This Checkpoint

```bash
git checkout -b feature/next-module v1.2.0-fundamentals-aggregated
```

---

## ✅ What's Working

- Portfolio Performance Details (MotherDuck cache, 24hr)
- Benchmarks (SPY, alpha)
- Portfolio Allocation (4 ECharts pies)
- Stock Price Comparison (normalized returns, time filters, tooltip dedup)
- Portfolio Fundamentals (5 scores, .US-aware)
- Portfolio Aggregated Metrics (Max/Median/Avg/Min)
- Portfolio Input (edit/save)
- SWR caching across modules
- Refresh revalidates performance, benchmarks, allocation

---

## 📝 Documentation Updated for v1.2.0

- CHECKPOINT_v1.2.0.md (this file)
- CHECKPOINTS.md (v1.2.0 as current)
- README.md (endpoints, structure, tech stack)
- ARCHITECTURE.md (structure, endpoints)
- DATA_FLOW.md (overview)
- TECH_STACK.md (full stack breakdown)
- docs/README.md (index and quick links)
- docs/MOTHERDUCK_INTEGRATION.md (PROD_OBQ_Scores, PROD_OBQ_Momentum_Scores)
- docs/PROCEDURES.md (runbooks, rollback, deploy)

---

**Live Site:** https://jcn-tremor.vercel.app  
**GitHub:** https://github.com/alexbernal0/JCN_Vercel_Dashboard  
**Tag:** v1.2.0-fundamentals-aggregated
