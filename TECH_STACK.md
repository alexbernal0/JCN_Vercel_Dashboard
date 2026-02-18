# Tech Stack – JCN Financial Dashboard

**Version:** 1.2.0  
**Last Updated:** February 18, 2026

---

## Overview

| Layer | Technology | Version / notes | Responsibility |
|-------|------------|----------------|----------------|
| **Frontend runtime** | Node.js | 18+ | Next.js, build, dev server |
| **Framework** | Next.js | 15 | Routing, SSR, API rewrites |
| **UI** | React | 19 | Components |
| **Charts/Tables** | Tremor | 3.x | Tables, cards |
| **Charts** | ECharts + echarts-for-react | 5.x / 3.x | Line charts (e.g. normalized price comparison) |
| **Styling** | Tailwind CSS | 3.x | Layout, theme, dark mode |
| **Data fetching** | SWR | 2.x | Caching, revalidation, dedupe |
| **Backend runtime** | Python | 3.9+ (Vercel) | FastAPI, DuckDB |
| **API** | FastAPI | 0.115+ | Serverless handlers |
| **Database** | MotherDuck (DuckDB) | Cloud | All market and score data |
| **Hosting** | Vercel | — | Serverless functions + static |

---

## Data sources (MotherDuck only)

- **PROD_EODHD.main.PROD_EOD_survivorship** – Daily OHLCV, sector, industry; symbol format `.US`.
- **PROD_EODHD.main.PROD_EOD_ETFs** – SPY for benchmarks.
- **PROD_EODHD.main.PROD_OBQ_Scores** – Value, Growth, Financial Strength, Quality; symbol format **no** `.US`.
- **PROD_EODHD.main.PROD_OBQ_Momentum_Scores** – Momentum; symbol format `.US`.

No yfinance or other live APIs in production; all data from MotherDuck.

---

## Key dependencies

**Frontend (package.json):**  
next, react, tremor, @tremor/react, echarts, echarts-for-react, swr, tailwindcss.

**Backend (requirements.txt):**  
fastapi, duckdb, pandas, python-dotenv, pydantic.

---

## Environment

- **MOTHERDUCK_TOKEN** – Required for production; set in Vercel env.
- **HOME** – Set to `/tmp` in API before importing DuckDB (serverless).
- **.env / .env.local** – Optional for local dev (dotenv loaded in api/index.py).

---

## Build and run

- **Install:** `pnpm install` (frontend), `pip install -r requirements.txt` (API if run locally).
- **Dev:** `pnpm dev` (Next rewrites /api to Python when configured).
- **Build:** `pnpm build`.
- **Deploy:** Push to main (Vercel) or `vercel --prod`.

See [docs/PROCEDURES.md](./docs/PROCEDURES.md) and [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for full procedures.
