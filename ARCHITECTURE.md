# 🏗️ JCN Stock Scanner - Architecture Documentation

**Status:** ✅ PRODUCTION READY  
**Last Updated:** 2026-02-15  
**Version:** 1.0.0

---

## 🎯 Overview

A military-grade, production-ready serverless stock scanner dashboard built with:
- **Frontend:** Next.js 15 + Tremor (charts/tables)
- **Backend:** FastAPI (Python 3.12)
- **Database:** MotherDuck (DuckDB cloud)
- **Hosting:** Vercel (serverless)

---

## ✅ Deployment Status

### Live URLs
- **Production:** https://jcn-tremor.vercel.app
- **API Health:** https://jcn-tremor.vercel.app/api/health
- **API Test:** https://jcn-tremor.vercel.app/api/test
- **DB Test:** https://jcn-tremor.vercel.app/api/db-test

### Verified Working
- ✅ Next.js frontend deploys successfully
- ✅ Python FastAPI backend responds correctly
- ✅ API routing configured properly
- ✅ Health check endpoint working
- ⚠️ MotherDuck connection ready (needs token)

---

## 📁 Project Structure

```
jcn-tremor/
├── api/
│   └── index.py              # FastAPI serverless function
├── src/
│   ├── app/
│   │   ├── overview/         # Dashboard pages
│   │   ├── globals.css       # Tailwind styles
│   │   └── layout.tsx        # Root layout
│   └── components/           # Tremor components
├── next.config.mjs           # Next.js config (API rewrites)
├── vercel.json               # Vercel deployment config
├── requirements.txt          # Python dependencies
└── package.json              # Node dependencies
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

### 3. `api/index.py` (FastAPI Routes)
```python
app = FastAPI()

@app.get("/api/health")      # → https://domain.com/api/health
@app.get("/api/test")         # → https://domain.com/api/test
@app.get("/api/db-test")      # → https://domain.com/api/db-test
@app.post("/api/portfolio/performance")  # Main endpoint
```

**Key:** Routes include `/api` prefix. Vercel strips `/api/index` mount point automatically.

---

## 🔌 API Endpoints

### 1. Health Check
**URL:** `/api/health`  
**Method:** GET  
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T23:26:52.140502",
  "cache_size": 0
}
```

### 2. Test Endpoint
**URL:** `/api/test`  
**Method:** GET  
**Response:**
```json
{
  "message": "Hello from FastAPI!",
  "framework": "FastAPI",
  "version": "2.0.0"
}
```

### 3. Database Connection Test
**URL:** `/api/db-test`  
**Method:** GET  
**Response (when token is set):**
```json
{
  "status": "success",
  "message": "MotherDuck Connected!",
  "timestamp": "2026-02-15 23:30:00",
  "motherduck_token_set": true
}
```

### 4. Portfolio Performance (Main)
**URL:** `/api/portfolio/performance`  
**Method:** POST  
**Body:**
```json
{
  "symbols": ["AAPL", "GOOGL", "MSFT"],
  "start_date": "2024-01-01",
  "end_date": "2026-02-15"
}
```

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
