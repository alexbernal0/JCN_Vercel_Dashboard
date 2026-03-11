# Checkpoint v1.4.0 - Stock Screener, Watchlist & Dashboard Enhancements

**Date:** March 11, 2026
**Status:** Production Ready - All Features Live
**Tag:** `v1.4.0-screener-watchlist`

---

## What's New in v1.4.0

### Major Features Added

1. **Dashboard Redesign**
   - TradingView-powered stock heatmap (OpenStock/TradingView widget)
   - Three daily candle charts (SPY, QQQ, ACWI) with white background, no volume
   - TradingView Company Profile widget on Stock Analysis page (replaces old info card)

2. **Stock Screener** (`/screener`)
   - FinViz-style preset dropdown filters (no manual input — only preset ranges)
   - 7 filter tabs: Descriptive, JCN Scores, Valuation, Growth, Profitability, Momentum, Fundamentals
   - ~65 preset filter options across all tabs
   - TanStack Table v8 results with sortable columns, show/hide columns, CSV export
   - Cell context menu: Analysis (opens in new tab), Add to Watchlist, Grok (placeholder)
   - State persisted in sessionStorage (survives navigation)
   - Screener API queries ~3,000 stock universe (excludes ETFs)

3. **Watchlist** (`/watchlist`)
   - localStorage-based CRUD (no database writes)
   - Manual add/remove symbols, clear all with confirmation
   - TanStack Table with enriched data from screener API
   - Sortable columns, CSV export, open analysis in new tab
   - Cross-component sync via custom `watchlist-change` event
   - Shared utility: `src/lib/watchlist.ts`

4. **Screener API** (`POST /api/screener`)
   - Dynamic SQL query builder with whitelisted field mapping (prevents SQL injection)
   - Inline subqueries (NOT CTEs — MotherDuck-compatible)
   - JOINs across 8 tables: PROD_DASHBOARD_SNAPSHOT, 5 factor score tables, JCN Composites, Momentum, Fundamentals
   - /tmp cache with 5-min TTL
   - 100% read-only

### Bug Fixes

- **CTE queries crashed on MotherDuck** — Rewrote all screener SQL to use inline subqueries (matches stock_analysis.py pattern)
- **Sector filter missed ~50% of stocks** — Database has dual naming conventions (e.g., "Technology" vs "Information Technology"). Fixed with `IN` operator matching both
- **Growth filter matched nothing** — Presets used whole numbers (5, 10) but DB stores decimals (0.05, 0.10). Fixed to decimal scale
- **pnpm lockfile mismatch** — @tanstack/react-table added to package.json but lockfile not regenerated. Fixed with `pnpm install`

---

## API Endpoints (v1.4.0)

| Method   | Path                          | Purpose                                       |
| -------- | ----------------------------- | --------------------------------------------- |
| GET      | `/api/health`                 | Health check                                  |
| GET      | `/api/sync/stage0`            | Health and Inventory (8 checks)               |
| GET      | `/api/sync/stage1`            | EODHD Ingest (bulk to DEV)                    |
| GET      | `/api/sync/stage2`            | Validate and Promote (DEV to PROD)            |
| GET      | `/api/sync/stage3`            | Audit and Report (integrity + self-healing)   |
| POST     | `/api/portfolio/performance`  | Portfolio performance metrics                 |
| POST     | `/api/portfolio/allocation`   | Pie-chart allocation                          |
| POST     | `/api/portfolio/fundamentals` | 5 scores per symbol                           |
| POST     | `/api/benchmarks`             | SPY comparison, alpha                         |
| POST     | `/api/stock/prices`           | Historical daily prices                       |
| POST     | `/api/stock/analysis`         | Single-stock deep analysis                    |
| **POST** | **`/api/screener`**           | **Stock screener with dynamic filters (NEW)** |

### Screener API Details

**Request:**

```json
{
  "filters": [
    {
      "field": "gics_sector",
      "op": "in",
      "value": ["Technology", "Information Technology"]
    },
    { "field": "jcn_full_composite", "op": "gte", "value": 70 },
    { "field": "market_cap", "op": "gte", "value": 10000000000 }
  ],
  "sort_by": "jcn_full_composite",
  "sort_dir": "desc",
  "limit": 100,
  "offset": 0
}
```

**Supported operators:** `gte`, `lte`, `eq`, `in`, `between`

**Response:** Array of stock objects with ~50 fields (price, scores, fundamentals, momentum sub-components).

---

## MotherDuck Tables Queried by Screener

| Table                     | Alias | Fields Used                                                                                               |
| ------------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| PROD_DASHBOARD_SNAPSHOT   | snap  | symbol, market_cap, gics_sector, industry, adjusted_close, daily_change_pct, ytd_pct, yoy_pct, 52wk range |
| PROD_OBQ_Value_Scores     | val   | value_score_composite                                                                                     |
| PROD_OBQ_Quality_Scores   | qual  | quality_score_composite                                                                                   |
| PROD_OBQ_FinStr_Scores    | fin   | finstr_score_composite                                                                                    |
| PROD_OBQ_Growth_Scores    | grow  | growth_score_composite                                                                                    |
| PROD_OBQ_Momentum_Scores  | mom   | 14 sub-components + momentum_score_composite                                                              |
| PROD_JCN_Composite_Scores | jcn   | 8 blend composites                                                                                        |
| PROD_EOD_Fundamentals     | fund  | P/E, PEG, P/B, P/S, EV/EBITDA, margins, ROE, ROA, debt ratios, growth                                     |

### Symbol Normalization in Screener JOINs

- PROD_DASHBOARD_SNAPSHOT: `.US` suffix → stripped with `REPLACE(snap.symbol, '.US', '')`
- Score tables (val, qual, fin, grow, jcn): `.US` suffix → JOIN on `snap.symbol = table.symbol`
- Momentum table: NO `.US` suffix → JOIN on `REPLACE(snap.symbol, '.US', '') = mom.symbol`
- Fundamentals: `.US` suffix → JOIN on `snap.symbol = fund.symbol`

---

## New Files Added in v1.4.0

### API

- `api/screener.py` — Screener query engine (446 lines)

### Frontend Pages

- `src/app/(dashboard)/screener/page.tsx` — Screener page orchestrator
- `src/app/(dashboard)/watchlist/page.tsx` — Watchlist page

### Components

- `src/components/screener/filterPresets.ts` — 7 tabs, ~65 preset filters
- `src/components/screener/ScreenerFilters.tsx` — Filter tab UI
- `src/components/screener/ScreenerTable.tsx` — TanStack Table + context menu
- `src/components/dashboard/StockHeatmap.tsx` — TradingView heatmap widget
- `src/components/dashboard/AdvancedChart.tsx` — TradingView candle chart widget
- `src/components/dashboard/CompanyProfile.tsx` — TradingView company profile widget

### Shared Utilities

- `src/lib/watchlist.ts` — localStorage CRUD, cross-component sync

### Modified Files

- `api/index.py` — Screener route registered
- `src/app/(dashboard)/dashboard/page.tsx` — Heatmap + 3 charts
- `src/app/(dashboard)/stock-analysis/page.tsx` — Company Profile widget
- `src/components/dashboard/Sidebar.tsx` — Watchlist entry added
- `package.json` — @tanstack/react-table added
- `pnpm-lock.yaml` — Updated

---

## Technical Decisions & Discoveries

1. **CTEs DO NOT WORK on MotherDuck** — `WITH latest AS (...)` causes "Table does not exist" error. Must use inline subqueries: `LEFT JOIN (SELECT ... FROM ...) alias ON ...`

2. **Vercel uses pnpm** — `pnpm-lock.yaml` must be committed. `pnpm install --frozen-lockfile` fails if lockfile doesn't match package.json.

3. **PROD_DASHBOARD_SNAPSHOT** has ~10,299 symbols. `is_etf = false` narrows to ~3,000 stocks.

4. **Dual sector naming** — Some symbols have "Technology", others "Information Technology". Both must be matched. Same for Healthcare/Health Care, Financial Services/Financials, etc.

5. **Growth values stored as decimals** — `revenue_growth = 0.157` means 15.7%. Filter presets must use decimal scale.

6. **ESLint has no @typescript-eslint plugin** — Cannot use `// eslint-disable-next-line @typescript-eslint/no-explicit-any`. Use `unknown` type instead.

7. **TypeScript target doesn't support `for...of` on Sets** — Use `Array.from(set)`.

8. **TradingView widgets require `ssr: false`** — Must use Next.js dynamic import: `dynamic(() => import("..."), { ssr: false })`

---

## Environment Variables

| Variable         | Where                   | Purpose                  |
| ---------------- | ----------------------- | ------------------------ |
| MOTHERDUCK_TOKEN | Vercel env + .env.local | MotherDuck cloud DB      |
| EODHD_API_KEY    | Vercel env              | EODHD market data API    |
| HOME             | Set in API code to /tmp | DuckDB serverless compat |

---

## Build & Test Results

- **Production build:** 17 pages, 0 errors, 0 warnings
- **Screener API:** 9 filter scenarios tested (sector, JCN score, market cap, valuation, profitability, momentum, fundamentals, growth, multi-filter combo) — ALL PASS
- **Pages verified:** Dashboard, Stock Analysis, Screener, Watchlist, Persistent Value — all load correctly

---

## Rollback

```bash
# Revert to this checkpoint
git checkout v1.4.0-screener-watchlist

# Revert to previous (pre-screener)
git checkout v1.3.0-data-sync-pipeline

# Revert to v1.2.0
git checkout v1.2.0-fundamentals-aggregated
```

---

**Live Site:** https://jcn-vercel-dashboardv4.vercel.app
**GitHub:** https://github.com/alexbernal0/JCN_Vercel_Dashboard
**Tag:** v1.4.0-screener-watchlist
