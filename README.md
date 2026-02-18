# JCN Financial Dashboard (Persistent Value)

**Status:** ✅ Production Ready  
**Version:** 1.2.0  
**Last Updated:** February 18, 2026

Serverless portfolio dashboard: Next.js frontend, FastAPI backend, MotherDuck (DuckDB) for all market and score data.

---

## Live URLs

- **App:** https://jcn-tremor.vercel.app
- **API health:** https://jcn-tremor.vercel.app/api/health
- **Repo:** https://github.com/alexbernal0/JCN_Vercel_Dashboard

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15, React 19 | Routing, SSR, UI |
| UI | Tremor, ECharts | Tables, charts |
| Styling | Tailwind CSS | Layout, theme |
| Backend | FastAPI (Python 3.x) | Serverless API (Vercel) |
| Database | MotherDuck (DuckDB) | Prices, fundamentals, scores |
| Data | PROD_EODHD + OBQ/Momentum tables | No yfinance in production |
| Caching | SWR (frontend), 24hr (MotherDuck) | Fast repeat loads |
| Hosting | Vercel | Serverless deploy |

See [TECH_STACK.md](./TECH_STACK.md) for a full breakdown.

---

## Docs (onboard another AI or dev)

| Doc | Purpose |
|-----|---------|
| [CHECKPOINT_v1.2.0.md](./CHECKPOINT_v1.2.0.md) | Current release snapshot; rollback point |
| [CHECKPOINTS.md](./CHECKPOINTS.md) | All checkpoint tags and rollback commands |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level structure, config, endpoints |
| [DATA_FLOW.md](./DATA_FLOW.md) | How data moves frontend → API → MotherDuck |
| [TECH_STACK.md](./TECH_STACK.md) | Stack, versions, and responsibilities |
| [BUILDING_GUIDE.md](./BUILDING_GUIDE.md) | How to add pages and API endpoints |
| [docs/README.md](./docs/README.md) | Index of procedure and reference docs |
| [docs/MOTHERDUCK_INTEGRATION.md](./docs/MOTHERDUCK_INTEGRATION.md) | DB connection, schema, .US handling, caching |
| [docs/PROCEDURES.md](./docs/PROCEDURES.md) | Deploy, rollback, env, scripts |
| [docs/STREAMLIT_REFERENCE_REBUILD.md](./docs/STREAMLIT_REFERENCE_REBUILD.md) | Streamlit → Vercel rebuild rules |

---

## Quick Start

```bash
git clone https://github.com/alexbernal0/JCN_Vercel_Dashboard.git
cd JCN_Vercel_Dashboard
pnpm install
```

**Env:** Set `MOTHERDUCK_TOKEN` (e.g. in `.env.local` for local; Vercel env for production).  
**Run:** `pnpm dev` (frontend); API runs via Next rewrites to Python serverless.

---

## API Endpoints

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | — | Health; MOTHERDUCK_TOKEN check |
| POST | `/api/portfolio/performance` | `{ holdings }` | Performance metrics |
| POST | `/api/portfolio/allocation` | `{ portfolio }` | Pie-chart allocation |
| POST | `/api/portfolio/fundamentals` | `{ symbols }` | 5 scores per symbol |
| POST | `/api/benchmarks` | `{ holdings }` | SPY comparison, alpha |
| POST | `/api/stock/prices` | `{ symbols }` | Historical daily prices |

---

## Project Layout

```
├── api/                    # Python serverless (FastAPI)
│   ├── index.py            # Routes
│   ├── portfolio_performance.py
│   ├── portfolio_allocation.py
│   ├── portfolio_fundamentals.py
│   ├── benchmarks.py
│   ├── stock_prices_module.py
│   └── cache_manager.py
├── src/
│   ├── app/                # Next.js pages
│   │   └── (dashboard)/persistent-value/page.tsx
│   ├── components/dashboard/
│   └── lib/swr-provider.tsx
├── scripts/                # DB/schema helpers (describe_score_tables, check_fundamentals_data)
├── docs/                   # Procedures, DB, deploy, Streamlit reference
├── CHECKPOINT_v1.2.0.md    # Rollback snapshot
└── CHECKPOINTS.md
```

---

## Rollback to v1.2.0

```bash
git checkout v1.2.0-fundamentals-aggregated
```

See [CHECKPOINTS.md](./CHECKPOINTS.md) for other tags.

---

## Credits

Tremor, Next.js, FastAPI, MotherDuck, Vercel.
