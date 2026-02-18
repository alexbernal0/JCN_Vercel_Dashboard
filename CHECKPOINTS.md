# Project Checkpoints

This document tracks stable checkpoints for rollback and branch-from points.

---

## v1.2.0-fundamentals-aggregated (Current)

**Date:** February 18, 2026  
**Tag:** `v1.2.0-fundamentals-aggregated`

### What's Working

- ✅ Portfolio Performance Details (MotherDuck, 24hr cache)
- ✅ Benchmarks (SPY comparison, alpha)
- ✅ Portfolio Allocation (4 ECharts pie charts)
- ✅ Normalized Stock Price Comparison (ECharts, time-period filters)
- ✅ Portfolio Fundamentals table (5 scores: Value, Growth, Financial Strength, Quality, Momentum)
- ✅ Portfolio Aggregated Metrics table (Max / Median / Average / Min)
- ✅ Portfolio Input (edit/save holdings)
- ✅ SWR caching; refresh revalidates performance, benchmarks, allocation
- ✅ MotherDuck: PROD_EOD_survivorship, PROD_EOD_ETFs, PROD_OBQ_Scores, PROD_OBQ_Momentum_Scores

### Removed in v1.2.0

- Placeholder sections below Aggregated Metrics (Holdings duplicate, Allocation placeholder, Price Comparison placeholder, Fundamental Metrics, Quality Radar) removed so next modules can be built one at a time.

### Rollback

```bash
git checkout v1.2.0-fundamentals-aggregated
```

### Full Changelog

See [CHECKPOINT_v1.2.0.md](./CHECKPOINT_v1.2.0.md).

---

## v1.1.0-portfolio-allocation

**Date:** February 17, 2026  
**Tag:** `v1.1.0-portfolio-allocation`

### What's Working

- ✅ Portfolio Performance Details, Benchmarks, Portfolio Allocation (4 pies)
- ✅ SWR caching; Under Construction pages
- ❌ No Fundamentals, Aggregated Metrics, or Stock Price Comparison yet

### Rollback

```bash
git checkout v1.1.0-portfolio-allocation
```

---

## v1.0.0

**Date:** February 15, 2026  
**Tag:** `v1.0.0`

### What's Working

- ✅ Next.js + FastAPI + MotherDuck foundation
- ✅ Portfolio Performance Details, documentation
- ❌ No allocation, fundamentals, or charts

### Rollback

```bash
git checkout v1.0.0
```

---

## Creating a New Checkpoint

1. Implement and test the feature set.
2. Create `CHECKPOINT_vX.Y.Z.md` with date, tag, file structure, API list, and rollback instructions.
3. Update this file (CHECKPOINTS.md) with the new version as current.
4. Update README, ARCHITECTURE, and docs as needed.
5. Commit all changes, then tag: `git tag vX.Y.Z-short-name`
6. Push: `git push origin main && git push origin vX.Y.Z-short-name`
