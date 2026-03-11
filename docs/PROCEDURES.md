# Procedures – JCN Financial Dashboard

**Version:** 1.3.0  
**Last Updated:** March 9, 2026

Runbooks for deploy, rollback, env, and database helpers.

---

## Deployment

### Vercel (production)

1. Ensure `MOTHERDUCK_TOKEN` is set in Vercel project env (Production + Preview if needed).
2. Push to `main`: `git push origin main`. Vercel auto-deploys.
3. Or: `vercel --prod` from repo root (with Vercel CLI linked).

### Local development

```bash
pnpm install
# Set .env.local with MOTHERDUCK_TOKEN
pnpm dev
```

API runs as serverless on Vercel; locally, Next rewrites can point to a local Python server if configured (see next.config.mjs).

---

## Data Sync Pipeline

### Running a sync (production)

1. Go to https://jcn-vercel-dashboardv4.vercel.app/data-sync
2. Click **RUN ALL** to execute all 4 stages sequentially
3. Or run individual stages by expanding each card and clicking Run

### Stage execution order

| Stage | Name                 | Duration | What it does                                 |
| ----- | -------------------- | -------- | -------------------------------------------- |
| 0     | Health and Inventory | ~13s     | Connectivity, table presence, gap analysis   |
| 1     | Ingest               | ~3-60s   | EODHD bulk download to DEV tables            |
| 2     | Validate and Promote | ~7s      | DQ audit, DEV to PROD promotion, weekly OHLC |
| 3     | Audit and Report     | ~11s     | Cross-table checks, integrity, self-healing  |

### API endpoints (GET, no auth needed)

- `/api/sync/stage0` -- Health check
- `/api/sync/stage1` -- Ingest
- `/api/sync/stage2` -- Validate and Promote
- `/api/sync/stage3` -- Audit and Report

### Manual sync via curl

```bash
curl https://jcn-vercel-dashboardv4.vercel.app/api/sync/stage0
curl https://jcn-vercel-dashboardv4.vercel.app/api/sync/stage1
curl https://jcn-vercel-dashboardv4.vercel.app/api/sync/stage2
curl https://jcn-vercel-dashboardv4.vercel.app/api/sync/stage3
```

### Timeout notes

Vercel Pro default: 60s per function. Stages 1 and 2 may need 300s on heavy sync days (multiple trading days to catch up). Configure maxDuration in Vercel dashboard if needed.

### Environment variables for sync

| Variable         | Required by | Purpose               |
| ---------------- | ----------- | --------------------- |
| MOTHERDUCK_TOKEN | All stages  | MotherDuck cloud DB   |
| EODHD_API_KEY    | Stage 1     | EODHD market data API |

---

## Rollback to a checkpoint

Checkpoints are tagged in git. To revert the app to a known good state:

```bash
# List tags
git tag -l

# Revert to v1.2.0 (current checkpoint)
git checkout v1.2.0-fundamentals-aggregated

# Or create a branch from that point
git checkout -b fix/rollback v1.2.0-fundamentals-aggregated
```

Then redeploy (e.g. push the branch and promote on Vercel, or push to main after reset).

**Checkpoint list:** See root [CHECKPOINTS.md](../CHECKPOINTS.md) and [CHECKPOINT_v1.3.0.md](../CHECKPOINT_v1.3.0.md).

---

## Environment variables

| Variable         | Where                     | Purpose                             |
| ---------------- | ------------------------- | ----------------------------------- |
| MOTHERDUCK_TOKEN | Vercel env, or .env.local | MotherDuck read access (PROD_EODHD) |
| HOME             | Set in API code to `/tmp` | DuckDB serverless compatibility     |

Never commit tokens. Use Vercel dashboard or `.env.local` (gitignored).

---

## Database connection helpers

- **Connection:** All MotherDuck access goes through `api/cache_manager.py` (or direct `duckdb.connect` in modules that don’t use cache). Token from `os.getenv("MOTHERDUCK_TOKEN")`; connect string `md:?motherduck_token=...`.
- **Symbol format:** PROD_EOD_survivorship and all fundamental score tables (Value, Quality, Growth, FinStr) use `.US` (e.g. `AAPL.US`). PROD_OBQ_Momentum_Scores uses **no** `.US` (e.g. `AAPL`) because momentum SQL strips the suffix when computing from price data. The composite table (PROD_JCN_Composite_Scores) uses `.US` format. API normalizes and queries both forms where needed.
- **Scripts (local):**
  - `scripts/describe_score_tables.py` – List columns for PROD_OBQ_Scores and PROD_OBQ_Momentum_Scores.
  - `scripts/check_fundamentals_data.py` – Check that score data exists for portfolio symbols (uses .env.local).

Run scripts from repo root with `python3 scripts/...` and MOTHERDUCK_TOKEN set.

---

## Score Recalculation (OBQ Factor Scores)

### Overview

All OBQ factor scores are computed against an **investable universe** -- the top 3,000 stocks by market cap, reconstituted annually in May (matching Russell 3000 methodology). This prevents micro-cap and OTC data from distorting percentile rankings for investable large-cap stocks.

### Investable Universe (PROD_OBQ_Investable_Universe)

- **Rank Day**: Last trading day of May each year (with >1,000 symbols trading)
- **Effective Period**: July 1 of recon_year through June 30 of next year
- **DQ Filters**: market_cap $10M--$5T, adjusted_close $0.01--$500K
- **Pre-2003**: All stocks scored (no filtering, insufficient market cap data)
- **Table**: `PROD_EODHD.main.PROD_OBQ_Investable_Universe` (~67,500 rows, 2003--2025)

### 5 Factor Scores

| Factor             | Table                    | Script                                           | Symbols/month |
| ------------------ | ------------------------ | ------------------------------------------------ | ------------- |
| Value              | PROD_OBQ_Value_Scores    | `scripts/score_recalculation.py --score value`   | ~2,650        |
| Quality            | PROD_OBQ_Quality_Scores  | `scripts/score_recalculation.py --score quality` | ~2,750        |
| Financial Strength | PROD_OBQ_FinStr_Scores   | `scripts/score_recalculation.py --score finstr`  | ~2,750        |
| Growth             | PROD_OBQ_Growth_Scores   | `scripts/score_recalculation.py --score growth`  | ~2,760        |
| Momentum           | PROD_OBQ_Momentum_Scores | `scripts/momentum_score_recalculation.py`        | ~2,950        |

Each factor has a **3-way scoring** structure: `*_score_universe` (40%) + `*_score_sector` (40%) + `*_score_history` (20%) = `*_score_composite`.

### 8 JCN Composite Blend Presets (PROD_JCN_Composite_Scores)

| Column                      | Preset         | Formula                           |
| --------------------------- | -------------- | --------------------------------- |
| jcn_full_composite          | Full OBQ       | V:20 + Q:20 + G:20 + M:20 + FS:20 |
| jcn_qarp                    | QARP           | Q:40 + V:40 + M:20                |
| jcn_garp                    | GARP           | G:40 + V:40 + M:20                |
| jcn_quality_momentum        | Q+M            | Q:50 + M:50                       |
| jcn_value_momentum          | V+M            | V:50 + M:50                       |
| jcn_growth_quality_momentum | G+Q+M          | G:34 + Q:33 + M:33                |
| jcn_fortress                | Fortress       | Q:40 + FS:40 + V:20               |
| jcn_alpha_trifecta          | Alpha Trifecta | V:34 + Q:33 + M:33                |

Weights re-normalize when some factors are missing for a symbol. Script: `scripts/composite_score_recalculation.py`.

### Running Score Recalculation

**Full rebuild (from 2010):**

```bash
python scripts/score_recalculation.py --score all --full-rebuild
python scripts/momentum_score_recalculation.py --full-rebuild
python scripts/composite_score_recalculation.py --full-rebuild
```

**Monthly update (append latest month only):**

```bash
python scripts/score_recalculation.py --score all
python scripts/momentum_score_recalculation.py
python scripts/composite_score_recalculation.py
```

**Resume after interruption:**

```bash
python scripts/score_recalculation.py --score all --resume
python scripts/momentum_score_recalculation.py --resume
python scripts/composite_score_recalculation.py --resume
```

All scripts use `SCORE_CALC_PROGRESS` table for resume tracking.

### Symbol Format Notes

- Fundamental scores (Value, Quality, Growth, FinStr) store symbols with `.US` suffix (e.g. `AAPL.US`)
- Momentum stores plain symbols (e.g. `AAPL`) -- the SQL strips `.US` when reading from price data
- Composite script normalizes momentum symbols by appending `.US` before the merge
- API endpoints handle both formats: `stock_analysis.py` strips `.US` when querying momentum

### Archived Tables (old full-universe scores)

Old scores computed across all ~10,800 stocks are preserved for reference:

- `PROD_OBQ_Value_Scores_FULL_v1`, `PROD_OBQ_Quality_Scores_FULL_v1`, `PROD_OBQ_Growth_Scores_FULL_v1`
- `PROD_OBQ_FinStr_Scores_FULL_v1`, `PROD_OBQ_Momentum_Scores_FULL_v1`, `PROD_JCN_Composite_Scores_FULL_v1`

### Distribution Verification

After any rebuild, verify:

- Mean ~50, min 0, max 100 for all composite scores
- ~2,700--3,000 symbols per month (post-2003)
- `avg_factors` ~4.6 in composite table (most symbols have all 5 factors)
- Run Stage 3 audit (`/api/sync/stage3`) for automated health check

---

## Documentation map (for AI or new devs)

1. **README.md** – Entry point, quick start, API list, project layout.
2. **CHECKPOINT_v1.2.0.md** – Snapshot of current release; file list, endpoints, MotherDuck tables.
3. **CHECKPOINTS.md** – All checkpoint tags and rollback commands.
4. **ARCHITECTURE.md** – High-level structure, config, API reference.
5. **TECH_STACK.md** – Stack breakdown, versions, data sources.
6. **DATA_FLOW.md** – How requests flow frontend → API → MotherDuck.
7. **BUILDING_GUIDE.md** – How to add pages and API endpoints.
8. **docs/README.md** – Index of docs and procedures.
9. **docs/MOTHERDUCK_INTEGRATION.md** – DB schema, connection pattern, caching, .US handling.
10. **docs/PROCEDURES.md** – This file; deploy, rollback, env, DB helpers.
11. **docs/STREAMLIT_REFERENCE_REBUILD.md** – Rules for porting from Streamlit to this app.
12. **docs/DEPLOYMENT_GUIDE.md** – Detailed Vercel deploy and monitoring.

---

## Verification after deploy

- [ ] App loads: https://jcn-vercel-dashboardv4.vercel.app
- [ ] API health: https://jcn-vercel-dashboardv4.vercel.app/api/health
- [ ] Data Sync page: https://jcn-vercel-dashboardv4.vercel.app/data-sync (RUN ALL completes)
- [ ] Persistent Value page loads and shows Performance, Benchmarks, Allocation, Stock Price Comparison, Fundamentals, Aggregated Metrics
