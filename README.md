# JCN Financial Dashboard

**Status:** ✅ Production Ready  
**Version:** 1.4.0  
**Last Updated:** March 11, 2026

Serverless investment dashboard: Next.js frontend, FastAPI backend, MotherDuck (DuckDB) for all market and score data. Features portfolio tracking, stock screener, watchlist, deep fundamental analysis, and automated data pipeline.

---

## Live URLs

- **App:** https://jcn-vercel-dashboardv4.vercel.app
- **API health:** https://jcn-vercel-dashboardv4.vercel.app/api/health
- **Repo:** https://github.com/alexbernal0/JCN_Vercel_Dashboard

---

## Features

| Feature        | Page                                                 | Description                                                      |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Dashboard      | `/dashboard`                                         | TradingView heatmap + 3 daily candle charts (SPY/QQQ/ACWI)       |
| Portfolios     | `/persistent-value`, `/olivia-growth`, `/pure-alpha` | Performance, allocation, benchmarks, JCN scores                  |
| Stock Analysis | `/stock-analysis`                                    | TradingView Company Profile + deep fundamental analysis          |
| Stock Screener | `/screener`                                          | FinViz-style preset filters, 7 tabs, ~65 filters, TanStack Table |
| Watchlist      | `/watchlist`                                         | localStorage CRUD, enriched data, CSV export                     |
| Data Sync      | `/data-sync`                                         | 4-stage EODHD pipeline (ingest, validate, promote, audit)        |
| Wiki           | `/wiki`                                              | Full documentation, methodology, database schema                 |

---

## Tech Stack

| Layer    | Technology                                   | Purpose                           |
| -------- | -------------------------------------------- | --------------------------------- |
| Frontend | Next.js 15, React 19                         | Routing, SSR, UI                  |
| UI       | Tremor, TanStack Table v8                    | Tables, cards, screener           |
| Charts   | TradingView Widgets, ECharts                 | Heatmap, candles, company profile |
| Styling  | Tailwind CSS                                 | Layout, theme                     |
| Backend  | FastAPI (Python 3.x)                         | Serverless API (Vercel)           |
| Database | MotherDuck (DuckDB)                          | Prices, fundamentals, scores      |
| Data     | PROD_EODHD + OBQ/Momentum tables             | No yfinance in production         |
| Caching  | SWR (frontend), /tmp (API), 5-min (screener) | Fast repeat loads                 |
| Hosting  | Vercel                                       | Serverless deploy                 |

See [TECH_STACK.md](./TECH_STACK.md) for a full breakdown.

---

## Docs (onboard another AI or dev)

| Doc                                                                | Purpose                                      |
| ------------------------------------------------------------------ | -------------------------------------------- |
| [CHECKPOINT_v1.4.0.md](./CHECKPOINT_v1.4.0.md)                     | Current release snapshot; rollback point     |
| [CHECKPOINTS.md](./CHECKPOINTS.md)                                 | All checkpoint tags and rollback commands    |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                               | High-level structure, config, endpoints      |
| [DATA_FLOW.md](./DATA_FLOW.md)                                     | How data moves frontend → API → MotherDuck   |
| [TECH_STACK.md](./TECH_STACK.md)                                   | Stack, versions, and responsibilities        |
| [BUILDING_GUIDE.md](./BUILDING_GUIDE.md)                           | How to add pages and API endpoints           |
| [docs/README.md](./docs/README.md)                                 | Index of procedure and reference docs        |
| [docs/MOTHERDUCK_INTEGRATION.md](./docs/MOTHERDUCK_INTEGRATION.md) | DB connection, schema, .US handling, caching |
| [docs/PROCEDURES.md](./docs/PROCEDURES.md)                         | Deploy, rollback, env, scripts               |

---

## Quick Start

```bash
git clone https://github.com/alexbernal0/JCN_Vercel_Dashboard.git
cd JCN_Vercel_Dashboard
pnpm install
```

**Env:** Set `MOTHERDUCK_TOKEN` (e.g. in `.env.local` for local; Vercel env for production).  
**Run:** `pnpm dev` (frontend); API runs via Next rewrites to Python serverless.

For local API testing:

```bash
uvicorn api.index:app --reload --port 8000   # Backend
pnpm dev                                       # Frontend (rewrites /api/* to localhost:8000)
```

---

## API Endpoints

| Method | Path                          | Body                                    | Purpose                        |
| ------ | ----------------------------- | --------------------------------------- | ------------------------------ |
| GET    | `/api/health`                 | —                                       | Health; MOTHERDUCK_TOKEN check |
| GET    | `/api/sync/stage0-3`          | —                                       | Data sync pipeline stages      |
| POST   | `/api/portfolio/performance`  | `{ holdings }`                          | Performance metrics            |
| POST   | `/api/portfolio/allocation`   | `{ portfolio }`                         | Pie-chart allocation           |
| POST   | `/api/portfolio/fundamentals` | `{ symbols }`                           | 5 scores per symbol            |
| POST   | `/api/benchmarks`             | `{ holdings }`                          | SPY comparison, alpha          |
| POST   | `/api/stock/prices`           | `{ symbols }`                           | Historical daily prices        |
| POST   | `/api/stock/analysis`         | `{ symbol }`                            | Deep fundamental analysis      |
| POST   | `/api/screener`               | `{ filters, sort_by, sort_dir, limit }` | Stock screener (NEW v1.4.0)    |

---

## Project Layout

```
├── api/                         # Python serverless (FastAPI)
│   ├── index.py                  # Route registry
│   ├── screener.py               # Stock screener (v1.4.0)
│   ├── stock_analysis.py         # Deep fundamental analysis
│   ├── portfolio_performance.py
│   ├── portfolio_allocation.py
│   ├── portfolio_fundamentals.py
│   ├── benchmarks.py
│   ├── stock_prices_module.py
│   ├── sync_stage0-3.py          # Data pipeline stages
│   └── cache_manager.py
├── src/
│   ├── app/(dashboard)/          # Next.js pages
│   │   ├── dashboard/page.tsx     # Heatmap + charts
│   │   ├── screener/page.tsx      # Stock screener (v1.4.0)
│   │   ├── watchlist/page.tsx     # Watchlist (v1.4.0)
│   │   ├── stock-analysis/page.tsx
│   │   ├── persistent-value/page.tsx
│   │   ├── olivia-growth/page.tsx
│   │   ├── pure-alpha/page.tsx
│   │   ├── data-sync/page.tsx
│   │   └── wiki/page.tsx
│   ├── components/
│   │   ├── dashboard/             # Sidebar, charts, heatmap, company profile
│   │   └── screener/              # Filters, table, presets (v1.4.0)
│   └── lib/
│       ├── watchlist.ts           # Shared watchlist utility (v1.4.0)
│       └── swr-provider.tsx
├── scripts/                       # DB/schema helpers
├── docs/                          # Procedures, DB, deploy
├── CHECKPOINT_v1.4.0.md           # Current rollback snapshot
└── CHECKPOINTS.md
```

---

## Rollback

```bash
git checkout v1.4.0-screener-watchlist    # Current
git checkout v1.3.0-data-sync-pipeline    # Previous
git checkout v1.2.0-fundamentals-aggregated
```

See [CHECKPOINTS.md](./CHECKPOINTS.md) for all tags.

---

## Credits

Next.js, FastAPI, MotherDuck, Vercel, TradingView, TanStack Table, Tremor.
