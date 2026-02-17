# Deployment Guide

**Status:** ✅ Production-Ready  
**Version:** 1.0.0  
**Last Updated:** February 17, 2026

---

## Overview

This guide provides step-by-step instructions for deploying the JCN Financial Investment Dashboard to Vercel, including environment configuration, build settings, and troubleshooting.

**Production URL:** https://jcn-tremor.vercel.app

---

## Prerequisites

### Required Accounts
- **GitHub Account** - For code repository
- **Vercel Account** - For hosting (linked to GitHub)
- **MotherDuck Account** - For database access

### Required Tools
- **Git** - Version control
- **Node.js** - v22.13.0 or higher
- **pnpm** - Latest version
- **Python** - v3.11 or higher (for local testing)

---

## Initial Setup

### 1. GitHub Repository

**Repository:** https://github.com/alexbernal0/JCN_Vercel_Dashboard

```bash
# Clone repository
git clone https://github.com/alexbernal0/JCN_Vercel_Dashboard.git
cd JCN_Vercel_Dashboard

# Install dependencies
pnpm install
```

### 2. Vercel Project

**Project URL:** https://vercel.com/obsidianquantitative/jcn-tremor

**Setup Steps:**
1. Go to https://vercel.com/new
2. Import Git Repository → Select `JCN_Vercel_Dashboard`
3. Configure project:
   - **Project Name:** jcn-tremor
   - **Framework Preset:** Next.js
   - **Root Directory:** ./
   - **Build Command:** `pnpm build`
   - **Output Directory:** `.next`
   - **Install Command:** `pnpm install`
4. Click "Deploy"

---

## Environment Variables

### Required Variables

**Location:** https://vercel.com/obsidianquantitative/jcn-tremor/settings/environment-variables

| Variable Name | Value | Purpose |
|---------------|-------|---------|
| `MOTHERDUCK_TOKEN` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | MotherDuck database authentication |
| `ALPHA_VANTAGE_API_KEY` | `KAGC2VEED1JTAETN` | (Optional) For future real-time price integration |

### How to Add Environment Variables

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Click "Add New"
3. Enter:
   - **Key:** `MOTHERDUCK_TOKEN`
   - **Value:** Your MotherDuck token
   - **Environments:** Production, Preview, Development (select all)
4. Click "Save"
5. **Important:** Redeploy after adding variables

### How to Get MotherDuck Token

1. Log in to MotherDuck: https://app.motherduck.com
2. Click your profile → Settings
3. Go to "API Tokens" tab
4. Click "Create Token"
5. Name: "JCN Vercel Dashboard"
6. Permissions: Read access to `PROD_EODHD` database
7. Copy token and add to Vercel

---

## Build Configuration

### Vercel Settings

**Location:** https://vercel.com/obsidianquantitative/jcn-tremor/settings

#### General Settings
- **Framework Preset:** Next.js
- **Node.js Version:** 22.x
- **Build Command:** `pnpm build`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install`
- **Development Command:** `pnpm dev`

#### Function Settings
- **Serverless Function Region:** Washington, D.C., USA (iad1)
- **Serverless Function Timeout:** 30 seconds
- **Edge Function Timeout:** 30 seconds

#### Python Runtime
- **Runtime:** Python 3.11
- **Requirements File:** `requirements.txt`
- **Handler:** `api/index.py` exports `app` (FastAPI instance)

### Next.js Configuration

**File:** `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure API routes are treated as serverless functions
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Optimize for production
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization
  images: {
    domains: [],
  },
};

export default nextConfig;
```

### Python Requirements

**File:** `requirements.txt`

```txt
fastapi==0.115.6
duckdb==1.1.3
pandas==2.2.3
```

---

## Deployment Process

### Automatic Deployment (Recommended)

**Trigger:** Push to `main` branch

```bash
# Make changes
git add .
git commit -m "feat: Add new feature"
git push origin main
```

**What Happens:**
1. Vercel detects push to `main`
2. Starts build process
3. Installs Node.js dependencies (`pnpm install`)
4. Installs Python dependencies (`pip install -r requirements.txt`)
5. Builds Next.js app (`pnpm build`)
6. Deploys to production
7. Updates https://jcn-tremor.vercel.app

**Build Time:** ~2-3 minutes

### Manual Deployment

**Via Vercel Dashboard:**
1. Go to https://vercel.com/obsidianquantitative/jcn-tremor
2. Click "Deployments" tab
3. Click "Redeploy" on latest deployment
4. Confirm redeploy

**Via Vercel CLI:**
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### Preview Deployments

**Trigger:** Push to any branch (not `main`)

```bash
git checkout -b feature/new-table
git push origin feature/new-table
```

**Result:** Vercel creates preview deployment at:
`https://jcn-tremor-git-feature-new-table-obsidianquantitative.vercel.app`

---

## Verification

### Post-Deployment Checklist

After each deployment, verify:

- [ ] **Frontend loads:** https://jcn-tremor.vercel.app
- [ ] **API health check:** https://jcn-tremor.vercel.app/api/health
- [ ] **MotherDuck connection:** Check health response shows `motherduck_configured: true`
- [ ] **Portfolio Performance table:** https://jcn-tremor.vercel.app/persistent-value
- [ ] **Data loads correctly:** Table shows 20 stocks with metrics
- [ ] **No console errors:** Open browser DevTools (F12) → Console tab
- [ ] **No build warnings:** Check Vercel deployment logs

### Testing Endpoints

```bash
# Health check
curl https://jcn-tremor.vercel.app/api/health

# Expected response:
# {"status":"healthy","motherduck_configured":true,"timestamp":"2026-02-17"}

# Portfolio performance
curl -X POST https://jcn-tremor.vercel.app/api/portfolio/performance \
  -H "Content-Type: application/json" \
  -d '{
    "holdings": [
      {"symbol": "AAPL", "cost_basis": 181.40, "shares": 2865}
    ]
  }'

# Expected: JSON response with portfolio data
```

---

## Monitoring

### Vercel Analytics

**Location:** https://vercel.com/obsidianquantitative/jcn-tremor/analytics

**Metrics:**
- Page views
- Unique visitors
- Top pages
- Top referrers
- Device types
- Geographic distribution

### Function Logs

**Location:** https://vercel.com/obsidianquantitative/jcn-tremor/logs

**What to Monitor:**
- API response times
- Error rates
- MotherDuck query performance
- Cache hit/miss rates
- Function cold starts

**Log Filters:**
- **Errors only:** Filter by "error" or "exception"
- **Slow queries:** Filter by "MotherDuck" and look for >3s times
- **Cache performance:** Filter by "Cache HIT" or "Cache MISS"

### Uptime Monitoring

**Recommended Tools:**
- **UptimeRobot** - https://uptimerobot.com
- **Pingdom** - https://www.pingdom.com
- **Better Uptime** - https://betteruptime.com

**Endpoints to Monitor:**
- https://jcn-tremor.vercel.app (Frontend)
- https://jcn-tremor.vercel.app/api/health (API)

---

## Rollback

### Rollback to Previous Deployment

**Via Vercel Dashboard:**
1. Go to https://vercel.com/obsidianquantitative/jcn-tremor/deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"
4. Confirm

**Result:** Previous deployment becomes production in ~30 seconds

### Rollback to Specific Git Commit

```bash
# Find commit hash
git log --oneline

# Revert to specific commit
git revert <commit-hash>
git push origin main

# Or reset (destructive)
git reset --hard <commit-hash>
git push origin main --force
```

### Emergency Rollback

If production is completely broken:

1. **Immediate:** Promote last working deployment via Vercel Dashboard
2. **Fix:** Identify issue in logs
3. **Test:** Fix locally and test thoroughly
4. **Deploy:** Push fix to main branch

---

## Troubleshooting

### Issue: Build Fails

**Error:** `Build failed with exit code 1`

**Common Causes:**
1. TypeScript errors
2. Missing dependencies
3. Environment variables not set

**Solutions:**
```bash
# Test build locally
pnpm build

# Check for TypeScript errors
pnpm tsc --noEmit

# Check for missing dependencies
pnpm install

# Verify environment variables in Vercel dashboard
```

### Issue: API Returns 500 Error

**Error:** `Internal Server Error`

**Common Causes:**
1. MotherDuck token not set
2. Python dependencies not installed
3. DuckDB home directory error

**Solutions:**
1. Verify `MOTHERDUCK_TOKEN` in Vercel environment variables
2. Check `requirements.txt` is in project root
3. Verify `os.environ['HOME'] = '/tmp'` is set before importing duckdb

**Check Logs:**
https://vercel.com/obsidianquantitative/jcn-tremor/logs

### Issue: MotherDuck Connection Timeout

**Error:** `Connection timeout` or `Authentication failed`

**Solutions:**
1. Verify MotherDuck token is valid (not expired)
2. Check MotherDuck service status: https://status.motherduck.com
3. Test connection locally:
   ```python
   import duckdb
   conn = duckdb.connect('md:PROD_EODHD?motherduck_token=YOUR_TOKEN')
   conn.execute("SELECT 1").fetchone()
   ```

### Issue: Table Shows "Loading..." Forever

**Common Causes:**
1. API not responding
2. JavaScript error in frontend
3. CORS issue

**Solutions:**
1. Check browser console (F12) for errors
2. Test API directly: `curl https://jcn-tremor.vercel.app/api/health`
3. Check Vercel function logs for errors

### Issue: Slow Performance

**Common Causes:**
1. Cold start (first request after idle)
2. Cache miss (MotherDuck query required)
3. Large data volume

**Solutions:**
1. **Cold starts:** Accept 1-2s delay on first request (normal)
2. **Cache miss:** Ensure caching is working (check logs)
3. **Large data:** Optimize queries (see MOTHERDUCK_INTEGRATION.md)

---

## Performance Optimization

### Frontend Optimization

1. **Code Splitting:**
   ```typescript
   // Use dynamic imports for large components
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <Skeleton />,
   });
   ```

2. **Image Optimization:**
   ```typescript
   import Image from 'next/image';
   
   <Image 
     src="/logo.png" 
     width={200} 
     height={100} 
     alt="Logo"
     priority // For above-the-fold images
   />
   ```

3. **React Query Caching:**
   ```typescript
   const { data } = useQuery({
     queryKey: ['portfolio'],
     queryFn: fetchPortfolio,
     staleTime: 5 * 60 * 1000, // 5 minutes
     cacheTime: 30 * 60 * 1000, // 30 minutes
   });
   ```

### Backend Optimization

1. **MotherDuck Query Optimization:**
   - Use single query for multiple stocks
   - Filter early in SQL, not in Python
   - Use window functions for time-based queries
   - See MOTHERDUCK_INTEGRATION.md for details

2. **Caching:**
   - 24-hour cache for historical data
   - Ticker-level cache validation
   - See cache_manager.py for implementation

3. **Function Configuration:**
   - Increase memory if needed (Vercel settings)
   - Increase timeout for heavy queries (max 30s)

---

## Security

### Environment Variables

- ✅ **Never commit** `.env` files to Git
- ✅ **Use Vercel dashboard** to set production variables
- ✅ **Rotate tokens** every 90 days
- ✅ **Use read-only tokens** when possible

### API Security

- ✅ **CORS:** Configured in FastAPI (api/index.py)
- ✅ **Rate Limiting:** Consider adding if abuse detected
- ✅ **Input Validation:** All API inputs validated
- ✅ **Error Messages:** Don't expose sensitive info

### Database Security

- ✅ **Read-only access:** MotherDuck token has read-only permissions
- ✅ **No user data:** Database contains only public stock data
- ✅ **Connection security:** Token-based authentication

---

## Backup and Recovery

### Code Backup

**Primary:** GitHub repository (https://github.com/alexbernal0/JCN_Vercel_Dashboard)

**Backup Strategy:**
- All code in Git
- Multiple branches for features
- Tags for releases

### Database Backup

**MotherDuck handles backups automatically.**

**Recovery:**
- MotherDuck provides point-in-time recovery
- Contact MotherDuck support if needed

### Vercel Deployment History

**All deployments preserved for 30 days.**

**Access:**
https://vercel.com/obsidianquantitative/jcn-tremor/deployments

**Can rollback to any deployment within 30 days.**

---

## Scaling

### Current Limits

| Resource | Limit | Current Usage |
|----------|-------|---------------|
| Serverless Functions | 100 GB-hours/month | <1 GB-hour |
| Bandwidth | 100 GB/month | <5 GB |
| Build Minutes | 6000 min/month | <100 min |
| Function Executions | Unlimited | ~1000/day |

### Scaling Strategy

**If usage grows:**

1. **Upgrade Vercel Plan:**
   - Pro: $20/month (400 GB-hours, 1 TB bandwidth)
   - Enterprise: Custom pricing

2. **Optimize Caching:**
   - Increase cache duration
   - Use Redis instead of file-based cache
   - Implement CDN for static assets

3. **Database Optimization:**
   - Create materialized views in MotherDuck
   - Pre-aggregate common queries
   - Use MotherDuck query caching

---

## Continuous Integration

### GitHub Actions (Optional)

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '22'
    
    - name: Install pnpm
      run: npm install -g pnpm
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Run TypeScript check
      run: pnpm tsc --noEmit
    
    - name: Build
      run: pnpm build
    
    - name: Run tests
      run: pnpm test
```

---

## Version Tagging

### Creating Release Tags

```bash
# Tag current commit
git tag -a v1.0.0 -m "Portfolio Performance Table Complete"

# Push tag to GitHub
git push origin v1.0.0

# List all tags
git tag -l
```

### Semantic Versioning

**Format:** `vMAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes (v1.0.0 → v2.0.0)
- **MINOR:** New features (v1.0.0 → v1.1.0)
- **PATCH:** Bug fixes (v1.0.0 → v1.0.1)

**Example:**
- v1.0.0 - Portfolio Performance Table Complete
- v1.1.0 - Add Olivia Growth Portfolio Page
- v1.1.1 - Fix sector/industry display bug

---

## Support

### Vercel Support

- **Documentation:** https://vercel.com/docs
- **Support:** https://vercel.com/support
- **Status:** https://www.vercel-status.com

### MotherDuck Support

- **Documentation:** https://motherduck.com/docs
- **Support:** support@motherduck.com
- **Status:** https://status.motherduck.com

### Project Support

- **GitHub Issues:** https://github.com/alexbernal0/JCN_Vercel_Dashboard/issues
- **Email:** ben@obsidianquantitative.com

---

## Checklist: New Deployment

Before deploying new features:

- [ ] Test locally (`pnpm dev`)
- [ ] Run TypeScript check (`pnpm tsc --noEmit`)
- [ ] Build successfully (`pnpm build`)
- [ ] Test API endpoints locally
- [ ] Update documentation if needed
- [ ] Commit with clear message
- [ ] Push to feature branch first
- [ ] Test preview deployment
- [ ] Merge to main for production
- [ ] Verify production deployment
- [ ] Check Vercel logs for errors
- [ ] Test all critical features
- [ ] Tag release if major update

---

**Last Updated:** February 17, 2026  
**Documentation Version:** 1.0.0  
**Deployment Status:** ✅ Production-Ready
