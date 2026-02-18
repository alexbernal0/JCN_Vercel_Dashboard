# Build Logs Summary – Deployment Status

Generated from Vercel API deployment events. This summarizes where things stand across your projects.

---

## Project: **jcn-vercel-dashboard_v4** (primary – READY)

**Production URL:** https://jcn-vercel-dashboardv4-git-main-obsidianquantitative.vercel.app  
**Latest deployment:** `dpl_2zc6w4uD3Af7QibaHQ69KHgJHEmK`  
**Commit:** `2711e0f` – "fix: Add __init__.py and remove duplicate stock_prices.py to fix API routing"  
**State:** READY (build and deploy succeeded)

### Build flow (latest)

1. **Region:** Washington, D.C. (iad1), Turbo Build Machine (30 cores, 60 GB)
2. **Clone:** `github.com/alexbernal0/JCN_Vercel_Dashboard` (main, 2711e0f) – 218 ms
3. **Cache:** Restored build cache from previous deployment
4. **Package manager:** pnpm (lockfile detected) → **pnpm@10.x** used
5. **Install:** `pnpm install` – "Lockfile is up to date", "Done in 788ms"
6. **Warning:** Ignored build scripts for `unrs-resolver@1.11.1` (optional; run `pnpm approve-builds` if you want to allow scripts)
7. **Framework:** Next.js 14.2.23 detected
8. **Build:** `pnpm run build` → `next build`
   - Compiled successfully
   - Static pages: `/`, `/_not-found`, `/about`, `/dashboard`, `/market-analysis`, `/olivia-growth`, `/persistent-value`, `/pure-alpha`, `/risk-management`, `/stock-analysis`
   - First Load JS shared: 87.3 kB
   - "○ (Static) prerendered as static content"
9. **Python:** No version in `.python-version` / `pyproject.toml` / `Pipfile.lock` → **Python 3.12** used
10. **Python env:** Virtual env at `.vercel/python/.venv`, **uv** used
11. **Python deps:** "Installing required dependencies from requirements.txt..." → success
12. **Result:** "Build Completed in /vercel/output [25s]", "Deployment completed", build cache created (232.58 MB)

### Takeaways (v4)

- Next.js build and Python install both succeed.
- Python 3.12 is used by default; `pydantic`/`pydantic-core` build correctly.
- Only notable message is the pnpm build-scripts warning for `unrs-resolver`; safe to ignore unless you need that script.

---

## Project: **jcn-dashboard-v2** (failing – ERROR)

**Latest deployment:** `dpl_PDpJC7kntbxJqU156ACbmTjiF63B`  
**Same repo & commit as v4:** JCN_Vercel_Dashboard, 2711e0f  
**State:** ERROR  
**Error code:** `BUILD_UTILS_SPAWN_1`  
**Error message:** `Command "uv pip install" exited with 1`

### What fails

- **Python version:** This project uses **CPython 3.14.2** (Vercel default when no version is pinned).
- **Step:** `uv pip install` installing from `requirements.txt` (fastapi, uvicorn, pydantic, duckdb, pandas, numpy, requests, vercel, etc.).
- **Failure:** Building **pydantic-core==2.23.4** (dependency of pydantic 2.9.2).  
  pydantic-core is a Rust extension (PyO3).  
  **PyO3 0.22.2 supports up to Python 3.13.**  
  Error: *"the configured Python interpreter version (3.14) is newer than PyO3's maximum supported version (3.13)"*  
  So the build fails when using Python 3.14.

### Fix for jcn-dashboard-v2

Pin Python to **3.12** (or 3.13) for this project so it matches the working v4 behavior:

1. **Option A – Project root:** Add a `.python-version` file with:
   ```text
   3.12
   ```
   (Commit and push; Vercel will use 3.12 for this repo; v4 already gets 3.12 without the file, but v2 may be using a different default.)
2. **Option B – Vercel project settings:** In the jcn-dashboard-v2 project on Vercel, set the Python version to **3.12** in the build/runtime settings if available.
3. **Option C – Pip:** In `requirements.txt` you can keep pydantic 2.9.2; the fix is the Python version, not the package version.

After pinning to 3.12, redeploy; `uv pip install` and the rest of the build should succeed.

---

## Project: **jcn-tremor** (READY)

Same repo (JCN_Vercel_Dashboard), same commit as v4. Build and deploy succeed; behavior matches jcn-vercel-dashboard_v4 (Next.js + Python 3.12, no Python 3.14 issue observed).

---

## Recent deployments (jcn-vercel-dashboard_v4)

| Deployment ID | Commit     | Message (short)                    | State |
|---------------|------------|------------------------------------|-------|
| dpl_2zc6w4uD3Af7QibaHQ69KHgJHEmK | 2711e0f | __init__.py / stock_prices API fix | READY |
| dpl_9emBE5XTmdUnXDYL3iD3RLGGqbuP | 9af7677  | Reduce stock prices query 5 years  | READY |
| dpl_4HGbbutMVfTaDiLw4NFycLLdfrFX | 8a16d04 | Stock Price Comparison + ECharts   | READY |
| dpl_GCNjbNnk1CK8LZY7QBeP1Aserjxq | 3c24971 | v1.1.0 Portfolio Allocation + SWR   | READY |
| dpl_5qRuyMr2EqQEkkKRuoWffQfaFzBX | 6e04c79 | Portfolio allocation MotherDuck     | READY |

---

## Summary

- **jcn-vercel-dashboard_v4** and **jcn-tremor** are in good shape: builds and deployments succeed; Python 3.12 is used; Next.js and Python deps install and run.
- **jcn-dashboard-v2** fails only because it picks up **Python 3.14**, which is too new for `pydantic-core`’s Rust toolchain (PyO3). Pinning this project to **Python 3.12** (e.g. `.python-version` or Vercel setting) will align it with v4 and should fix the build.

If you want, we can add a `.python-version` file to the repo and/or adjust the plan of action to include this fix for jcn-dashboard-v2.
