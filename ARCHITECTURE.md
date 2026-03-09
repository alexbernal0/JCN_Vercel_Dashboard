# JCN Financial Dashboard – Architecture

**Status:** ✅ Production Ready  
**Version:** 1.3.0  
**Last Updated:** March 9, 2026

---

## Overview

Serverless portfolio dashboard:

- **Frontend:** Next.js 15, React 19, Tremor, ECharts, Tailwind
- **Backend:** FastAPI (Python), Vercel serverless
- **Database:** MotherDuck (DuckDB) – PROD_EODHD + OBQ/Momentum score tables
- **Caching:** SWR (frontend), 24hr MotherDuck cache in API

---

## Live URLs

- **App:** https://jcn-tremor.vercel.app
- **API health:** https://jcn-tremor.vercel.app/api/health

---

## Project Structure

```
JCN_Vercel_Dashboard/
├── api/                          # Python serverless (FastAPI)
│   ├── index.py                   # All routes
│   ├── portfolio_performance.py   # Performance metrics
│   ├── portfolio_allocation.py    # Allocation for pie charts
│   ├── portfolio_fundamentals.py  # OBQ + Momentum scores
│   ├── benchmarks.py              # SPY comparison
│   ├── stock_prices_module.py     # Historical prices
│   └── cache_manager.py           # MotherDuck 24hr cache
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing
│   │   └── (dashboard)/           # /dashboard, /persistent-value, etc.
│   ├── components/dashboard/     # Tables, charts, inputs
│   └── lib/swr-provider.tsx       # SWR config
├── scripts/                       # DB helpers (describe scores, check fundamentals)
├── docs/                          # Procedures, DB, deploy
├── CHECKPOINT_v1.3.0.md           # Rollback snapshot (data-sync)
├── CHECKPOINTS.md
├── README.md
├── ARCHITECTURE.md                # This file
├── TECH_STACK.md
├── DATA_FLOW.md
├── BUILDING_GUIDE.md
├── vercel.json
├── next.config.mjs
├── requirements.txt
└── package.json
```

---

## 🔧 Configuration Files

### 1. `vercel.json`
```json
{
  "functions": {
    "api/**": {
      "excludeFiles": "{.next,.git,node_modules}/**"
    }
  }
}
```

**Purpose:** Tells Vercel to treat `/api` folder as Python serverless functions.

### 2. `next.config.mjs`
```javascript
{
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination: process.env.NODE_ENV === "development"
          ? "http://127.0.0.1:8000/api/:path*"
          : "/api/",
      },
    ];
  },
}
```

**Purpose:** Routes `/api/*` requests to Python function (dev: local, prod: serverless).

### 3. `api/index.py` (FastAPI)

All routes live in `api/index.py`. Vercel mounts the function at `/api/*`.

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | API info + endpoint list |
| GET | `/api/sync/stage0` | Health and Inventory (8 checks) |
| GET | `/api/sync/stage1` | EODHD Ingest (bulk to DEV) |
| GET | `/api/sync/stage2` | Validate and Promote (DEV to PROD) |
| GET | `/api/sync/stage3` | Audit and Report (integrity + self-healing) |
| GET | `/api/health` | Health; MOTHERDUCK_TOKEN check |
| POST | `/api/portfolio/performance` | Performance (body: `holdings`) |
| POST | `/api/portfolio/allocation` | Allocation (body: `portfolio`) |
| POST | `/api/portfolio/fundamentals` | 5 scores (body: `symbols`) |
| POST | `/api/benchmarks` | SPY comparison (body: `holdings`) |
| POST | `/api/stock/prices` | Historical prices (body: `symbols`) |

---

## API Endpoints (reference)

- **GET /api/health** – Returns `{ status, motherduck_configured, timestamp }`.
- **POST /api/portfolio/performance** – Body: `{ holdings: [{ symbol, cost_basis, shares }] }`. Returns performance metrics from MotherDuck (24hr cache).
- **POST /api/portfolio/allocation** – Same holdings shape. Returns company/category/sector/industry allocation for pie charts.
- **POST /api/portfolio/fundamentals** – Body: `{ symbols: string[] }`. Returns `{ data: [{ symbol, value, growth, financial_strength, quality, momentum }], score_columns }` from PROD_OBQ_Scores + PROD_OBQ_Momentum_Scores.
- **POST /api/benchmarks** – Body: holdings. Returns portfolio vs SPY daily change and alpha.
- **POST /api/stock/prices** – Body: `{ symbols: string[] }`. Returns historical daily close for chart (MotherDuck PROD_EOD_survivorship).

---

## 🔐 Environment Variables

### Required Setup

Go to: https://vercel.com/obsidianquantitative/jcn-tremor/settings/environment-variables

**Add:**
```
Name: MOTHERDUCK_TOKEN
Value: <your_motherduck_token>
Environments: Production, Preview, Development
```

**How to get MotherDuck token:**
1. Go to https://motherduck.com
2. Sign in to your account
3. Go to Settings → API Tokens
4. Copy your token

---

## 🚀 How It Works

### Request Flow

```
User Browser
    ↓
Next.js Frontend (Tremor charts/tables)
    ↓
API Request: /api/portfolio/performance
    ↓
Next.js Rewrite (next.config.mjs)
    ↓
Vercel Python Function (/api/index.py)
    ↓
FastAPI Handler
    ↓
MotherDuck Query (DuckDB)
    ↓
Return JSON Data
    ↓
Tremor Charts Display
```

### Why This Architecture?

1. **Serverless = Cost-effective**
   - Pay only for actual usage
   - Auto-scales to handle traffic spikes
   - No server maintenance

2. **FastAPI = Fast & Modern**
   - Async/await support
   - Automatic API docs
   - Type safety with Pydantic

3. **MotherDuck = Powerful Analytics**
   - SQL queries on cloud data
   - Fast analytical queries
   - No database management

4. **Tremor = Beautiful Charts**
   - Pre-built dashboard components
   - Responsive design
   - Professional look

---

## 📦 Dependencies

### Python (`requirements.txt`)
```
fastapi==0.115.0
uvicorn==0.32.0
pydantic==2.9.2
duckdb==1.1.3
yfinance==0.2.48
pandas==2.2.3
numpy==2.1.3
requests==2.32.3
vercel==0.3.2
vercel-sandbox==0.0.2
vercel-sdk==0.0.8
```

### Node.js (`package.json`)
- Next.js 15
- React 19
- Tremor components
- Tailwind CSS

---

## 🧪 Testing

### Local Development

1. **Install dependencies:**
```bash
pnpm install
pip3 install -r requirements.txt
```

2. **Run FastAPI locally:**
```bash
cd api
uvicorn index:app --reload --port 8000
```

3. **Run Next.js:**
```bash
pnpm dev
```

4. **Test endpoints:**
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/test
```

### Production Testing

```bash
curl https://jcn-tremor.vercel.app/api/health
curl https://jcn-tremor.vercel.app/api/test
curl https://jcn-tremor.vercel.app/api/db-test
```

---

## 🔄 Deployment

### Automatic (GitHub)
Push to `main` branch → Vercel auto-deploys

### Manual (CLI)
```bash
vercel --prod
```

---

## 📊 Next Steps

### 1. Add MotherDuck Token
- Go to Vercel environment variables
- Add `MOTHERDUCK_TOKEN`
- Redeploy

### 2. Build Individual Pages
Each page will:
- Fetch data from Python API
- Display results in Tremor charts/tables
- Allow user inputs (filters, date ranges)

**Example pages:**
- `/overview` - Portfolio summary
- `/screener` - Stock scanner with filters
- `/details` - Individual stock analysis

### 3. Add More API Endpoints
Examples:
- `/api/screen` - Screen stocks by criteria
- `/api/stock/{symbol}` - Get stock details
- `/api/compare` - Compare multiple stocks

---

## 🛡️ Security

- ✅ CORS enabled for frontend
- ✅ Environment variables encrypted
- ✅ No secrets in code
- ✅ HTTPS only
- ✅ Vercel DDoS protection

---

## 📝 Notes

### Why the rewrites were needed

The official Vercel FastAPI template uses rewrites to ensure `/api/*` requests are properly routed to the Python function. Without rewrites, Next.js would try to handle `/api/*` routes itself and return 404.

### Handler Export

Vercel's modern Python runtime (2023+) automatically detects the `app` variable in `/api/index.py`. No need for Mangum or custom handler exports.

### Route Naming

FastAPI routes MUST include `/api` prefix:
```python
@app.get("/api/health")  # ✅ Correct
@app.get("/health")      # ❌ Won't work
```

---

## 🎉 Success Criteria

- [x] Frontend deploys successfully
- [x] Python API responds to requests
- [x] Health check endpoint works
- [x] Test endpoint works
- [ ] MotherDuck connection verified (needs token)
- [ ] Sample page with Tremor charts created
- [ ] User can input filters and see results

**Status: 80% Complete - Ready for development!**

---

## 📞 Support

For issues or questions:
1. Check Vercel deployment logs
2. Test endpoints individually
3. Verify environment variables
4. Check browser console for errors

---

**Built with ❤️ by Manus AI**
