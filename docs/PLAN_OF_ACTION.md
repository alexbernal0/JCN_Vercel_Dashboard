# Plan of Action – JCN Vercel Dashboard

**Latest deployment:** https://jcn-vercel-dashboardv4-git-main-obsidianquantitative.vercel.app  
**Project name:** jcn-vercel-dashboard_v4  
**Project ID:** `prj_oCzI8kxYFKXeGKlk92Js2a8YyQnf`  
**Team:** obsidianquantitative  
**Status (from API):** READY – production deployment is live.

---

## Connecting to Vercel (token)

- Use your Vercel token only via **environment variable** (never commit it):
  - `export VERCEL_TOKEN="your_token"` then run `vercel` or API calls.
- To list projects: `curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects?teamId=obsidianquantitative"`
- If the token was ever exposed, rotate it in Vercel: Account → Tokens → Revoke and create new.  

### Other projects (same repo)

| Project              | Status  | URL |
|----------------------|---------|-----|
| jcn-vercel-dashboard_v4 | READY   | jcn-vercel-dashboardv4.vercel.app |
| jcn-tremor           | READY   | jcn-tremor.vercel.app |
| jcn-dashboard-v2     | ERROR   | (fix build to use) |

---

## 1. Verify deployment and connectivity

- [ ] **Confirm project in Vercel**
  - Dashboard: https://vercel.com/obsidianquantitative/jcn-vercel-dashboardv4 (or your actual project name)
  - Check: Deployments → latest (main) → build logs and runtime logs

- [ ] **Test live URLs**
  - Frontend: https://jcn-vercel-dashboardv4-git-main-obsidianquantitative.vercel.app
  - API health: https://jcn-vercel-dashboardv4-git-main-obsidianquantitative.vercel.app/api/health
  - If health fails: check env vars (`MOTHERDUCK_TOKEN`), Python runtime, and function logs

- [ ] **Confirm Git link**
  - Vercel project → Settings → Git: ensure it’s connected to the correct repo and branch (e.g. `main`).

---

## 2. Fix build and run locally

- [ ] **Install and build**
  - `pnpm install` (or `npm install` if no pnpm)
  - `pnpm build` or `npx next build`
  - Resolve any TypeScript, ESLint, or missing dependency errors.

- [ ] **Align config with Vercel**
  - Build command in Vercel should match: `pnpm build` (or `npm run build`).
  - Install command: `pnpm install` (or `npm install`).
  - Root directory: `.` (unless you use a monorepo layout).

- [ ] **Python API (Vercel serverless)**
  - Root `api/` is used for serverless (see `vercel.json`).
  - `next.config.mjs` rewrites `/api/:path*` to the Python handler in production.
  - Ensure `api/index.py` and its imports (e.g. `portfolio_performance`, `benchmarks`, `portfolio_allocation`, `stock_prices_module`) are in the repo and that `requirements.txt` lists all needed packages (e.g. `fastapi`, `uvicorn`, `duckdb`, `pandas`, etc.).

---

## 3. Environment and API

- [ ] **Environment variables (Vercel)**
  - `MOTHERDUCK_TOKEN` set for Production (and Preview if you use previews).
  - No secrets in code or in client-side env (use server-side or Vercel env only for API keys).

- [ ] **API routes**
  - All FastAPI routes use the `/api/` prefix (e.g. `/api/health`, `/api/portfolio/performance`).
  - After deploy, test: `/api/health`, then one POST (e.g. portfolio/performance) from browser or curl.

- [ ] **CORS**
  - Already configured in `api/index.py`; if you add a custom domain or new origin, update `allow_origins` if needed.

---

## 4. Common issues and fixes

| Issue | What to do |
|-------|------------|
| Build fails on Vercel | Run `pnpm build` / `npx next build` locally; fix TS/ESLint errors and match Node version (e.g. 22.x in Vercel). |
| `next` not found | Use `npx next build` or ensure `node_modules/.bin` in PATH; in Vercel, “Build Command” should run the same (e.g. `pnpm build`). |
| API 404 / 500 | Check rewrites in `next.config.mjs`, `vercel.json` `api/**` config, and that the deployed branch contains the same `api/` and `next.config.mjs`. |
| MotherDuck errors | Verify `MOTHERDUCK_TOKEN` in Vercel, then check function logs for connection/timeout errors. |
| Old deployment URL | Your current deployment is `jcn-vercel-dashboardv4-git-main-obsidianquantitative.vercel.app`; production domain may differ (e.g. custom domain or default `.vercel.app`). |

---

## 5. Next steps (priority order)

1. **Connect and verify**
   - Open the Vercel project for `jcn-vercel-dashboardv4` (or the exact name under obsidianquantitative).
   - Open latest deployment → build and function logs; note any red errors.

2. **Reproduce build locally**
   - Clone repo (if needed), `pnpm install`, `pnpm build` (or `npx next build`).
   - Fix any errors until build is green; commit and push to trigger a new deployment.

3. **Validate production**
   - Visit the deployment URL and `/api/health`; fix env vars and API code based on logs if needed.

4. **Optional**
   - Add a simple status page or doc that lists: deployment URL, health URL, and “last checked” so the team always uses the latest deployment.

---

**Doc purpose:** Get connected to the right Vercel project and deployment (`jcn-vercel-dashboardv4-git-main-obsidianquantitative.vercel.app`), fix build and env issues, and have a clear checklist for future deploys.
