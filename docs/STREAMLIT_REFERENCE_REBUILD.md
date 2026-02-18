# Streamlit Reference & Rebuild Rules

**Purpose:** Reference the original JCN Streamlit beta when rebuilding each page in the Next.js/Vercel app. All data for the rebuild comes **only** from MotherDuck, and **only** from the **PROD_EODHD** database and its tables (no external APIs, no other DBs).

---

## Source repo (Streamlit beta)

- **Repo:** [alexbernal0/JCN-dashboard](https://github.com/alexbernal0/JCN-dashboard)
- **Stack:** Streamlit, FastAPI backend, React frontend (later), MotherDuck + yfinance
- **Deploy attempt:** Railway (did not work); we are rebuilding on **Vercel** with **MotherDuck only**

---

## Rebuild rules (must follow)

1. **Data source:** **MotherDuck only.** No yfinance, Alpha Vantage, or any other live API for the rebuilt pages.
2. **Database:** Use **only** the **PROD_EODHD** database (and its tables). Do **not** use:
   - `gurufocus_with_momentum`
   - `OBQ_Scores`
   - `NDR_BP_SP_history`
   or any other non–PROD_EODHD tables for page logic.
3. **PROD_EODHD tables we use (this app):**
   - `PROD_EODHD.main.PROD_EOD_survivorship` – daily prices (symbol, date, open, high, low, close, adjusted_close, volume, etc.)
   - `PROD_EODHD.main.PROD_EOD_ETFs` – ETF data (e.g. SPY for benchmarks)
   - `PROD_EODHD.main.PROD_Fundamentals` – quarterly fundamentals (if needed)
4. **Symbol format:** MotherDuck uses `.US` suffix (e.g. `AAPL.US`). Normalize in API: add `.US` for queries, strip for display.

---

## Streamlit page → Python file mapping

Use these Streamlit **pages** as the reference for logic and components when rebuilding each route in this app.

| Vercel route (this app)     | Streamlit page file (reference)        | Notes |
|-----------------------------|----------------------------------------|--------|
| `/persistent-value`         | `pages/1_📊_Persistent_Value.py`        | ~103 KB; main portfolio table / metrics |
| `/olivia-growth`            | `pages/2_🌱_Olivia_Growth.py`          | ~104 KB |
| `/pure-alpha`               | `pages/3_⚡_Pure_Alpha.py`              | ~632 B; likely placeholder |
| `/stock-analysis`          | `pages/4_📈_Stock_Analysis.py`          | ~107 KB; stock-level analysis |
| `/market-analysis`         | `pages/5_🌍_Market_Analysis.py`        | ~637 B |
| `/risk-management`         | `pages/6_🛡️_Risk_Management.py`         | ~24 KB |
| `/about`                    | `pages/7_ℹ️_About.py`                   | ~638 B |

**Other in repo:**  
- `app.py` – Streamlit home (welcome, nav).  
- `pages/1_backup.py` – backup/reference only.  
- **Backend:** `backend/app/` – `main.py`, and folders `api/`, `core/`, `data/`, `models/`, `services/`, `utils/` for FastAPI and data/cache logic. When porting logic, prefer **PROD_EODHD**-based queries only.

---

## Where logic lives in this repo (Vercel app)

- **API (data):** `api/` – `index.py`, `portfolio_performance.py`, `portfolio_allocation.py`, `benchmarks.py`, `stock_prices_module.py`, `cache_manager.py`, `cache_utils.py`. All MotherDuck access should target **PROD_EODHD** and the tables above.
- **Frontend (UI):** `src/app/(dashboard)/*/page.tsx` and `src/components/dashboard/`. Call the API; no direct DB or external APIs in the frontend.
- **Docs:** `docs/MOTHERDUCK_INTEGRATION.md` – connection pattern, schema, symbol handling.

---

## Quick reference: PROD_EODHD tables

| Table                       | Use |
|----------------------------|-----|
| `PROD_EODHD.main.PROD_EOD_survivorship` | Daily OHLCV, adjusted_close, volume, sector/industry/market_cap. Primary source for prices and time series. |
| `PROD_EODHD.main.PROD_EOD_ETFs`         | ETF data (e.g. SPY for benchmarks). |
| `PROD_EODHD.main.PROD_Fundamentals`      | Quarterly fundamentals (balance sheet, income, cash flow) when needed. |

When we reference “specific Python files” from the Streamlit repo for a page, we port their **logic and calculations** into this app’s API/frontend using **only** these PROD_EODHD data sources.
