# 🚀 JCN Stock Scanner Dashboard

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** February 15, 2026

A military-grade, serverless stock scanner dashboard built with Next.js, FastAPI, and MotherDuck.

---

## 🌐 Live URLs

- **Production:** https://jcn-tremor.vercel.app
- **API Health:** https://jcn-tremor.vercel.app/api/health
- **GitHub:** https://github.com/alexbernal0/JCN_Vercel_Dashboard

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15 + React 19 | Server-side rendering, routing |
| **UI Components** | Tremor | Charts, tables, dashboards |
| **Styling** | Tailwind CSS | Responsive design |
| **Backend** | FastAPI (Python 3.12) | Serverless API |
| **Database** | MotherDuck (DuckDB) | Cloud analytics database |
| **Data Source** | yfinance | Real-time stock prices |
| **Hosting** | Vercel | Serverless deployment |

---

## 📚 Documentation

### 📖 Essential Reading

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture
2. **[DATA_FLOW.md](./DATA_FLOW.md)** - Data flow & architecture explained
3. **[BUILDING_GUIDE.md](./BUILDING_GUIDE.md)** - Step-by-step tutorials

### 🎯 Quick Links

- [How data flows through the system](./DATA_FLOW.md#-visual-data-flow-diagram)
- [How to add new pages](./BUILDING_GUIDE.md#-tutorial-1-add-a-simple-stock-screener)
- [How to add new API endpoints](./BUILDING_GUIDE.md#step-1-add-the-api-endpoint)
- [Common mistakes to avoid](./BUILDING_GUIDE.md#-common-mistakes-to-avoid)

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/alexbernal0/JCN_Vercel_Dashboard.git
cd JCN_Vercel_Dashboard
pnpm install
```

### 2. Set Environment Variables

Add `MOTHERDUCK_TOKEN` in Vercel:  
https://vercel.com/obsidianquantitative/jcn-tremor/settings/environment-variables

### 3. Deploy

```bash
git push origin main  # Auto-deploys to Vercel
```

---

## 📁 Project Structure

```
jcn-tremor/
├── api/index.py              # 🐍 All Python backend logic
├── src/app/                  # ⚛️ Next.js pages
├── src/components/           # 🎨 Reusable components
├── ARCHITECTURE.md           # 📖 System architecture
├── DATA_FLOW.md              # 🔄 How data flows
└── BUILDING_GUIDE.md         # 🔨 Building tutorials
```

---

## 🔌 API Endpoints

### Health Check
```bash
curl https://jcn-tremor.vercel.app/api/health
```

### Database Test
```bash
curl https://jcn-tremor.vercel.app/api/db-test
```

### Portfolio Performance
```bash
curl -X POST https://jcn-tremor.vercel.app/api/portfolio/performance \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL", "GOOGL"], "start_date": "2024-01-01", "end_date": "2026-02-15"}'
```

---

## ➕ Adding New Features

### Add API Endpoint
```python
# In api/index.py
@app.get("/api/your-endpoint")
async def your_function():
    return {"data": "result"}
```

### Add Page
```bash
# Create file
src/app/your-page/page.tsx

# Visit
https://jcn-tremor.vercel.app/your-page
```

**Full tutorials:** See [BUILDING_GUIDE.md](./BUILDING_GUIDE.md)

---

## ✅ Verification

After deployment:

- [ ] Frontend loads: https://jcn-tremor.vercel.app
- [ ] API works: https://jcn-tremor.vercel.app/api/health
- [ ] Database connects: https://jcn-tremor.vercel.app/api/db-test

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| API returns 404 | Add `/api/` prefix to route |
| MotherDuck fails | Set `MOTHERDUCK_TOKEN` in Vercel |
| Build fails | Run `pnpm build` locally |
| Charts don't show | Check data format |

**Full guide:** See [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📈 Roadmap

- [x] Foundation (Next.js + FastAPI + MotherDuck)
- [x] Deployment to Vercel
- [x] Comprehensive documentation
- [ ] Stock screener page
- [ ] Portfolio tracker
- [ ] Performance charts
- [ ] Watchlist functionality

---

## 🙏 Credits

Built with:
- [Tremor](https://tremor.so) - Dashboard components
- [Next.js](https://nextjs.org) - React framework
- [FastAPI](https://fastapi.tiangolo.com) - Python API
- [MotherDuck](https://motherduck.com) - Cloud database
- [Vercel](https://vercel.com) - Hosting

**Original Tremor template:** [README.tremor-original.md](./README.tremor-original.md)

---

**Built with ❤️ by Manus AI**  
**Last Updated:** February 15, 2026
