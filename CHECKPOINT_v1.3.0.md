# Checkpoint v1.3.0 - Data Sync Pipeline (Live Production)

**Date:** March 9, 2026
**Status:** Production Ready - All 4 Stages Live
**Tag:** `v1.3.0-data-sync-pipeline`

---

## What's New in v1.3.0

### Major Features Added

1. **Data Sync Pipeline - 4-Stage Production Backend**
   - Stage 0: Health and Inventory (8 diagnostic checks)
   - Stage 1: EODHD Bulk Ingest (prices, ETFs, fundamentals to DEV)
   - Stage 2: Validate and Promote (6-point DQ audit, DEV to PROD, weekly OHLC, SYNC_LOG)
   - Stage 3: Audit and Report (cross-table, integrity, self-healing, recommendations)

2. **Data Sync Dashboard Page** (`/data-sync`)
   - 4 expandable StageCards with verbose console output
   - RUN ALL / RERUN button runs stages sequentially with gate checks
   - Dynamic header shows PROD data freshness
   - Dry Run toggle for stages 1-2
   - Real-time formatters parse API JSON into terminal-style output

3. **Database Normalization (121.7M+ rows certified)**
   - All tables normalized to .US symbol format (PD-03)
   - Zero duplicates across all tables
   - 74.3M+ survivorship, 8.7M ETFs, 977K fundamentals
   - 5 score tables + JCN Composite Scores (8 presets, 4.48M rows)
   - DEV/PROD perfectly aligned

### Prime Directive v1.0

| ID | Rule |
|---|---|
| PD-01 | NEVER DELETE HISTORICAL DATA (append-only) |
| PD-02 | POINT-IN-TIME COMPLIANCE (filing_date not quarter_date) |
| PD-03 | SYMBOL FORMAT CANONICAL (all TICKER.US) |
| PD-04 | NO PARTIAL WRITES TO PROD (DEV first, gate >= 95%) |
| PD-05 | ADJUSTED_CLOSE ONLY |
| PD-06 | SYMBOL CONTAMINATION ZERO TOLERANCE (filter MF/OTC) |
| PD-07 | IDEMPOTENT STAGES (safe to re-run) |
| PD-08 | CURSOR PERSISTENCE (long-running write progress) |

---

## API Endpoints (v1.3.0)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/sync/stage0` | Health and Inventory (8 checks) |
| GET | `/api/sync/stage1` | EODHD Ingest (bulk download to DEV) |
| GET | `/api/sync/stage2` | Validate and Promote (DQ audit to PROD) |
| GET | `/api/sync/stage3` | Audit and Report (integrity + self-healing) |
| POST | `/api/portfolio/performance` | Portfolio performance metrics |
| POST | `/api/portfolio/allocation` | Pie-chart allocation |
| POST | `/api/portfolio/fundamentals` | 5 scores per symbol |
| POST | `/api/benchmarks` | SPY comparison, alpha |
| POST | `/api/stock/prices` | Historical daily prices |

---

## MotherDuck Tables (v1.3.0)

### PROD_EODHD.main (15 tables, 121.7M+ rows)

| Table | Rows | Purpose |
|-------|------|---------|
| PROD_EOD_survivorship | 74,347,674 | Daily OHLC + adjusted_close (1962-present) |
| PROD_EOD_survivorship_Weekly | 17,317,535 | Weekly OHLC aggregated |
| PROD_EOD_ETFs | 8,675,392 | ETF daily prices |
| PROD_EOD_Fundamentals | 977,727 | Quarterly fundamentals |
| PROD_OBQ_Value_Scores | 1,697,502 | Value factor scores |
| PROD_OBQ_Quality_Scores | 2,604,988 | Quality factor scores |
| PROD_OBQ_FinStr_Scores | 2,604,988 | Financial strength scores |
| PROD_OBQ_Growth_Scores | 2,738,502 | Growth factor scores |
| PROD_OBQ_Momentum_Scores | 3,685,626 | Momentum factor scores |
| PROD_JCN_Composite_Scores | 4,482,945 | 8-preset composite scores |
| PROD_Sector_Index_Membership | 2,536,912 | Sector/index mapping |
| PROD_Symbol_Universe | 44,211 | Master symbol list |
| PROD_SYNC_LOG | 6+ | Sync execution log |

---

## Verified Pipeline Execution (March 9, 2026)

All 4 stages executed successfully on live Vercel:
- Stage 0: PASS (12.7s) -- all systems healthy
- Stage 1: PASS (2.5s) -- weekend, no new data (expected)
- Stage 2: PASS (6.9s) -- +9,928 rows promoted, DEV=PROD
- Stage 3: WARN (10.6s) -- 11/12 passed, 1 real data gap (ETF)

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| MOTHERDUCK_TOKEN | Vercel env + .env.local | MotherDuck cloud DB |
| EODHD_API_KEY | Vercel env | EODHD market data API |
| HOME | Set in API code to /tmp | DuckDB serverless compat |

---

## Rollback

```bash
# Revert to this checkpoint
git checkout v1.3.0-data-sync-pipeline

# Revert to previous (pre-pipeline)
git checkout checkpoint-pre-sync-pipeline

# Revert to v1.2.0
git checkout v1.2.0-fundamentals-aggregated
```

---

**Live Site:** https://jcn-vercel-dashboardv4.vercel.app
**GitHub:** https://github.com/alexbernal0/JCN_Vercel_Dashboard
**Tag:** v1.3.0-data-sync-pipeline