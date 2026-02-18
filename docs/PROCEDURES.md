# Procedures – JCN Financial Dashboard

**Version:** 1.2.0  
**Last Updated:** February 18, 2026

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

**Checkpoint list:** See root [CHECKPOINTS.md](../CHECKPOINTS.md) and [CHECKPOINT_v1.2.0.md](../CHECKPOINT_v1.2.0.md).

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| MOTHERDUCK_TOKEN | Vercel env, or .env.local | MotherDuck read access (PROD_EODHD) |
| HOME | Set in API code to `/tmp` | DuckDB serverless compatibility |

Never commit tokens. Use Vercel dashboard or `.env.local` (gitignored).

---

## Database connection helpers

- **Connection:** All MotherDuck access goes through `api/cache_manager.py` (or direct `duckdb.connect` in modules that don’t use cache). Token from `os.getenv("MOTHERDUCK_TOKEN")`; connect string `md:?motherduck_token=...`.
- **Symbol format:** PROD_EOD_survivorship and PROD_OBQ_Momentum_Scores use `.US` (e.g. `AAPL.US`). PROD_OBQ_Scores uses **no** `.US` (e.g. `AAPL`). API normalizes and queries both forms where needed.
- **Scripts (local):**
  - `scripts/describe_score_tables.py` – List columns for PROD_OBQ_Scores and PROD_OBQ_Momentum_Scores.
  - `scripts/check_fundamentals_data.py` – Check that score data exists for portfolio symbols (uses .env.local).

Run scripts from repo root with `python3 scripts/...` and MOTHERDUCK_TOKEN set.

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

- [ ] App loads: https://jcn-tremor.vercel.app
- [ ] API health: https://jcn-tremor.vercel.app/api/health (check `motherduck_configured`)
- [ ] Persistent Value page loads and shows Performance, Benchmarks, Allocation, Stock Price Comparison, Fundamentals, Aggregated Metrics
