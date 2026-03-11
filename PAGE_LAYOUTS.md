# JCN Financial Dashboard - Page Layouts Survey

**Source:** https://github.com/alexbernal0/JCN-dashboard (Streamlit app)  
**Target:** Next.js + Tremor dashboard  
**Survey Date:** February 15, 2026

---

## Page Structure Overview

### Navigation (Sidebar)

1. **app** - Home/Landing page
2. **Dashboard** - TradingView heatmap + SPY/QQQ/ACWI charts
3. **📊 Persistent Value** - Portfolio page
4. **🌱 Olivia Growth** - Portfolio page
5. **⚡ Pure Alpha** - Portfolio page
6. **📈 Stock Analysis** - TradingView Company Profile + analysis
7. **🌍 Market Analysis** - Analysis tool
8. **🛡️ Risk Management** - Analysis tool
9. **🔍 Screener** - FinViz-style stock screener (v1.4.0)
10. **⭐ Watchlist** - User watchlist (v1.4.0)
11. **📖 Wiki** - Documentation
12. **ℹ️ About** - About page

---

## Page 1: Home/Landing (app.py)

### Layout Structure:

**Header Section:**

- 2-column layout [1:4 ratio]
  - Column 1: Logo image (200px width)
  - Column 2: Title + Subtitle
    - Title: "JCN Financial & Tax Advisory Group, LLC"
    - Subtitle: "Investment Dashboard"

**Welcome Section:**

- Heading: "Welcome to Your Investment Dashboard"
- Subtext: "Select a portfolio or analysis tool from the sidebar to get started."

**Available Portfolios Section:**

- Heading: "Available Portfolios:"
- Bullet list:
  - 📊 Persistent Value - Description
  - 🌱 Olivia Growth - Description
  - ⚡ Pure Alpha - Description

**Analysis Tools Section:**

- Heading: "Analysis Tools:"
- Bullet list:
  - 📈 Stock Analysis - Description
  - 🌍 Market Analysis - Description
  - 🛡️ Risk Management - Description

**About Section:**

- Heading: "About:"
- Bullet list:
  - ℹ️ About - Description

**Feature Cards:**

- 3-column layout (equal width)
  - Card 1: "Real-time Data" + description
  - Card 2: "Comprehensive Analysis" + description
  - Card 3: "Multi-Portfolio" + description

**Footer:**

- Caption: "JCN Financial & Tax Advisory Group, LLC - Built with Streamlit"

---

## Page 2-4: Portfolio Pages (Persistent Value, Olivia Growth, Pure Alpha)

### Layout Structure:

**Header Section:**

- 3-column layout [1:4:2 ratio]
  - Column 1: Logo (150px)
  - Column 2: Title + Description
    - Title: "📊 [Portfolio Name] Portfolio"
    - Description: Strategy description
  - Column 3: Refresh button + Last refresh time

**Portfolio Summary Section:**

- 3-column metrics layout
  - Metric 1: "Portfolio Est. Daily % Change" (with value)
  - Metric 2: "Benchmark Est. Daily % Change" (with value)
  - Metric 3: "Est. Daily Alpha" (with value)

**Holdings Table:**

- Full-width data table with columns:
  - Ticker
  - Company Name
  - Shares
  - Cost Basis
  - Current Price
  - Market Value
  - Total Gain/Loss
  - Total Gain/Loss %
  - % of Portfolio
  - Daily % Change
  - (Additional columns for fundamentals)
- Styled with:
  - Color-coded gains/losses (green/red)
  - Bold headers
  - Sortable columns
  - Fixed height (800px)

**Benchmarks Section:**

- 3-column metrics layout
  - Portfolio Daily Change
  - Benchmark Daily Change
  - Daily Alpha

**Portfolio Allocation Section:**

- Heading: "📊 Portfolio Allocation"
- Pie charts (side by side):
  - Allocation by Stock
  - Allocation by Sector

**Price Comparison Chart:**

- Heading: "📊 Normalized Stock Price Comparison - [Time Period]"
- Time period selector (buttons):
  - 1 Month, 3 Months, 6 Months, 1 Year, 5 Years, 10 Years, 20 Years
- Line chart:
  - Normalized prices (starting at 1.0)
  - Multiple stock lines
  - Interactive Plotly chart

**Fundamental Metrics Section:**

- Heading: "📊 Fundamental Metrics"
- 7-column layout for metric buttons:
  - P/E Ratio
  - P/B Ratio
  - Dividend Yield
  - ROE
  - Debt/Equity
  - Revenue Growth
  - Profit Margin
- Bar chart comparing selected metric across stocks

**Quality Radar Chart:**

- Heading: "📊 Quality Metrics Radar"
- Radar chart showing:
  - Multiple quality dimensions
  - Comparison across stocks

**Trend Analysis:**

- 2-column layout [3:1 ratio]
  - Column 1: Trend chart (price momentum, etc.)
  - Column 2: Filters/controls

**News Summary:**

- 2-column layout [3:1 ratio]
  - Column 1: News articles (expandable)
  - Column 2: Filters

**Risk Metrics:**

- 2-column layout [3:1 ratio]
  - Column 1: Risk table
  - Column 2: Risk indicators

---

## Page 5: Stock Analysis (4_📈_Stock_Analysis.py)

### Layout Structure:

**Header:**

- Logo + Title

**Stock Selector:**

- Dropdown/input for ticker symbol

**Stock Info Section:**

- Company name, sector, industry
- Current price, market cap

**Price Chart:**

- Historical price chart with time period selector

**Fundamental Metrics:**

- Grid of key metrics (P/E, P/B, etc.)

**News Feed:**

- Recent news articles for the stock

---

## Page 6: Market Analysis (5_🌍_Market_Analysis.py)

### Layout Structure:

**Header:**

- Logo + Title

**Market Indices:**

- S&P 500, Nasdaq, Dow Jones
- Current values and daily changes

**Sector Performance:**

- Table or chart showing sector performance

**Market Trends:**

- Charts showing market trends

---

## Page 7: Risk Management (6_🛡️_Risk_Management.py)

### Layout Structure:

**Header:**

- Logo + Title

**Portfolio Risk Metrics:**

- Volatility, Beta, Sharpe Ratio, etc.

**Risk Indicators:**

- BPSP (Bullish Percent Signal Positive)
- Other risk signals

**Risk Charts:**

- Historical volatility chart
- Drawdown chart

---

## Page 8: About (7_ℹ️_About.py)

### Layout Structure:

**Header:**

- Logo + Title

**About Content:**

- Company information
- Services offered
- Contact information

---

## Common Components Used

### Layout Components:

1. **Columns** - Multi-column layouts (2-col, 3-col, 7-col)
2. **Metrics** - KPI cards with values
3. **Tables** - Data tables with sorting/filtering
4. **Charts** - Plotly charts (line, bar, pie, radar)
5. **Buttons** - Action buttons (Refresh, time period selectors)
6. **Expanders** - Collapsible sections
7. **Tabs** - Tabbed content (if needed)

### Data Display:

1. **Metrics Cards** - st.metric()
2. **Data Tables** - st.dataframe() with styling
3. **Charts** - st.plotly_chart()
4. **Text** - st.markdown(), st.title(), st.subheader()
5. **Images** - st.image()

### Interactive Elements:

1. **Buttons** - st.button()
2. **Selectors** - Time period buttons
3. **Dropdowns** - Stock/portfolio selectors
4. **Refresh** - Manual data refresh button

---

## Tremor Component Mapping

| Streamlit Component | Tremor Component                           |
| ------------------- | ------------------------------------------ |
| `st.metric()`       | `<Card>` with custom metric display        |
| `st.dataframe()`    | `<Table>`                                  |
| `st.plotly_chart()` | `<AreaChart>`, `<BarChart>`, `<LineChart>` |
| `st.columns()`      | `<Grid>` or flex layout                    |
| `st.button()`       | `<Button>`                                 |
| `st.expander()`     | Collapsible `<Card>`                       |
| `st.tabs()`         | `<TabGroup>` + `<TabList>` + `<TabPanels>` |

---

## Implementation Priority

### Phase 1: Core Structure

1. ✅ Home page layout
2. ✅ Navigation structure
3. ✅ Basic page templates

### Phase 2: Portfolio Pages

1. ✅ Header with logo and refresh
2. ✅ Holdings table
3. ✅ Metrics cards
4. ✅ Allocation pie charts
5. ✅ Price comparison chart

### Phase 3: Analysis Pages

1. ✅ Stock Analysis layout
2. ✅ Market Analysis layout
3. ✅ Risk Management layout

### Phase 4: Polish

1. ✅ About page
2. ✅ Styling and theming
3. ✅ Responsive design

---

---

## Page 9: Stock Screener (v1.4.0 — `/screener`)

### Layout Structure:

**Filter Bar:**

- 7 horizontal tabs: Descriptive, JCN Scores, Valuation, Growth, Profitability, Momentum, Fundamentals
- Each tab shows a responsive grid of dropdown selects (2-6 columns depending on screen width)
- Active filters highlighted in blue with badge count on tab
- "Clear All" button when filters are active

**Results Table (TanStack Table v8):**

- Full-width sortable data table (~50 columns available)
- Column picker (show/hide any column)
- Click column header to sort ascending/descending
- Right-click any cell for context menu:
  - Analysis → opens `/stock-analysis?symbol=X` in new tab
  - Add to Watchlist → adds to localStorage watchlist
  - Grok → placeholder (disabled)
- CSV export button
- Row count indicator

**State Persistence:**

- Filter state and table state saved to sessionStorage
- Navigating away and back preserves the screener state (no reload needed)

---

## Page 10: Watchlist (v1.4.0 — `/watchlist`)

### Layout Structure:

**Header:**

- Title: "Watchlist"
- Symbol count indicator

**Action Bar:**

- Manual add ticker input (text input + "Add" button, Enter key supported)
- "Export CSV" button
- "Clear All" button with confirmation dialog

**Watchlist Table (TanStack Table v8):**

- Remove button (X) per row
- Symbol, Company, Sector, Market Cap, Price, Daily %, YTD %, YoY %
- 5 factor scores (Value, Quality, Growth, Momentum, JCN Full)
- Added date
- Analysis link (external link icon → opens in new tab)
- All columns sortable

**Empty State:**

- Star icon + "No symbols yet" message
- Instruction text to add from input or Screener

**Data Enrichment:**

- Fetches full universe from `/api/screener` (no filters)
- Filters client-side to only watchlist symbols
- Shows loading spinner during fetch

---

## Next Steps

1. Market Analysis page — sector performance, macro indicators
2. Risk Management page — portfolio-level risk metrics, VaR, drawdown
3. Additional screener features — saved filter presets, export filtered results
