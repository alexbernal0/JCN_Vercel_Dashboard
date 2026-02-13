# JCN Financial Dashboard - Project Overview

**Version:** 2.0.0  
**Date:** February 13, 2026  
**Framework:** Next.js 16 + shadcn/ui  
**Deployment:** Vercel

---

## Project Description

The JCN Financial Dashboard is a high-performance, data-intensive financial analytics platform designed to provide real-time portfolio insights, market analysis, and investment decision support. The dashboard is built with a focus on speed, professional aesthetics, and scalability to support hundreds of concurrent users.

## Core Features

### Portfolio Management
- **Persistent Value Portfolio:** Long-term value investment strategy tracking
- **Olivia Growth Portfolio:** Growth-focused investment monitoring
- **Pure Alpha Portfolio:** Market-neutral strategy analytics

### Market Data
- Real-time market indices display
- Historical performance tracking
- Trend analysis and visualization

### Data Architecture
- **Primary Data Source:** MotherDuck DB (via API)
- **Update Frequency:** Hourly automated refresh via GitHub Actions
- **Caching Strategy:** Pre-generated static data for instant page loads
- **Manual Refresh:** User-triggered on-demand data updates

## Technical Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (Radix UI + Tailwind)
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod validation
- **Tables:** TanStack Table
- **Charts:** Apache ECharts (planned)

### Backend
- **API Routes:** Next.js API Routes
- **Data Source:** MotherDuck DB
- **Automation:** GitHub Actions

### Deployment
- **Platform:** Vercel
- **CDN:** Vercel Edge Network
- **Domain:** TBD

## Design Philosophy

### Aesthetic
- **Style:** Futuristic, minimal, clean (inspired by Ex Machina, Blade Runner, Prometheus)
- **Color Scheme:** Light mode (default) with dark mode toggle
- **Typography:** Modern sans-serif, highly readable
- **Layout:** Card-based, generous whitespace

### Performance
- **Target Load Time:** <100ms (CDN-served static pages)
- **Scalability:** Support for hundreds of concurrent users
- **Data Freshness:** Hourly updates with manual refresh option

## Project Structure

```
jcn-vercel-dashboard/
├── src/
│   ├── app/                    # Next.js pages and layouts
│   ├── components/             # shadcn/ui components
│   ├── config/                 # App configuration
│   ├── data/                   # Static data files
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility functions
│   ├── navigation/             # Navigation configuration
│   ├── server/                 # Server-side code
│   ├── stores/                 # Zustand state stores
│   └── styles/                 # Theme presets
├── types/                      # TypeScript type definitions
├── docs/                       # Project documentation
└── public/                     # Static assets
```

## Development Workflow

1. **Local Development:** `pnpm dev`
2. **Build:** `pnpm build`
3. **Lint/Format:** `pnpm biome check --write`
4. **Deploy:** Automatic via Vercel on push to main

## Future Enhancements

### Planned Features
- Stock screener functionality
- Backtesting engine
- Google OAuth authentication
- Advanced charting with Apache ECharts
- Real-time data feeds (future consideration)

### Scalability Considerations
- Streaming responses for large dataset queries
- Edge caching optimization
- Database query optimization

## Team

- **Development:** Manus AI + Alex Bernal
- **Design:** Collaborative
- **Deployment:** Automated via Vercel

---

**Last Updated:** February 13, 2026
