# Building Guide – How to Add New Modules

**Last Updated:** February 18, 2026  
**Current as of:** v1.2.0  
**Skill Level:** Beginner-friendly  
**Time per module:** 15-30 minutes

---

## 🎯 What You'll Learn

1. How to add a new stock screener page
2. How to add a new API endpoint
3. How to add charts and tables
4. How to avoid breaking the site

---

## 📋 Prerequisites

Before you start, make sure:
- ✅ MotherDuck token is set in Vercel
- ✅ Site is deployed and working
- ✅ You can access https://jcn-tremor.vercel.app/api/health

---

## 🚀 Tutorial 1: Add a Simple Stock Screener

### Goal
Create a page where users can filter stocks by P/E ratio and see results in a table.

### Step 1: Add the API Endpoint

**File:** `api/index.py`  
**Add this at the end (before the "Export for Vercel" comment):**

```python
@app.get("/api/screen-stocks")
async def screen_stocks(
    min_pe: float = 0,
    max_pe: float = 50,
    min_market_cap: float = 1000000000  # $1B minimum
):
    """
    Screen stocks by fundamental criteria
    
    Parameters:
    - min_pe: Minimum P/E ratio
    - max_pe: Maximum P/E ratio
    - min_market_cap: Minimum market capitalization
    
    Returns:
    - List of stocks matching criteria
    """
    try:
        # Check cache first
        cache_key = f"screen_{min_pe}_{max_pe}_{min_market_cap}"
        cached = get_from_cache(cache_key, 3600)  # 1 hour cache
        if cached:
            return cached
        
        # Query MotherDuck
        conn = get_motherduck_connection()
        query = f"""
            SELECT 
                symbol,
                company_name,
                pe_ratio,
                market_cap,
                sector,
                industry
            FROM stocks
            WHERE pe_ratio BETWEEN {min_pe} AND {max_pe}
            AND market_cap >= {min_market_cap}
            ORDER BY market_cap DESC
            LIMIT 100
        """
        
        results = conn.execute(query).fetchall()
        conn.close()
        
        # Format results
        stocks = []
        for row in results:
            stocks.append({
                "symbol": row[0],
                "company": row[1],
                "pe_ratio": round(row[2], 2),
                "market_cap": row[3],
                "sector": row[4],
                "industry": row[5]
            })
        
        response = {"stocks": stocks, "count": len(stocks)}
        
        # Cache the results
        set_in_cache(cache_key, response, 3600)
        
        return response
        
    except Exception as e:
        logger.error(f"Stock screening failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 2: Test the Endpoint

**Deploy to Vercel:**
```bash
cd /home/ubuntu/jcn-tremor
git add api/index.py
git commit -m "feat: Add stock screener endpoint"
git push origin main
```

**Test it:**
```bash
curl "https://jcn-tremor.vercel.app/api/screen-stocks?min_pe=10&max_pe=20"
```

**Expected response:**
```json
{
  "stocks": [
    {
      "symbol": "AAPL",
      "company": "Apple Inc.",
      "pe_ratio": 15.2,
      "market_cap": 2800000000000,
      "sector": "Technology",
      "industry": "Consumer Electronics"
    },
    ...
  ],
  "count": 42
}
```

### Step 3: Create the Frontend Page

**File:** `src/app/screener/page.tsx`  
**Create this file:**

```typescript
'use client';

import { useState } from 'react';
import { Card, Title, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Button, TextInput } from '@tremor/react';

interface Stock {
  symbol: string;
  company: string;
  pe_ratio: number;
  market_cap: number;
  sector: string;
  industry: string;
}

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [minPE, setMinPE] = useState('10');
  const [maxPE, setMaxPE] = useState('20');

  const handleScreen = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/screen-stocks?min_pe=${minPE}&max_pe=${maxPE}&min_market_cap=1000000000`
      );
      const data = await response.json();
      setStocks(data.stocks);
    } catch (error) {
      console.error('Screening failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 space-y-6">
      <div>
        <Title>Stock Screener</Title>
        <p className="text-gray-500">Filter stocks by fundamental criteria</p>
      </div>

      <Card>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Min P/E</label>
            <TextInput
              value={minPE}
              onChange={(e) => setMinPE(e.target.value)}
              placeholder="10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max P/E</label>
            <TextInput
              value={maxPE}
              onChange={(e) => setMaxPE(e.target.value)}
              placeholder="20"
            />
          </div>
          <Button onClick={handleScreen} loading={loading}>
            Screen Stocks
          </Button>
        </div>
      </Card>

      {stocks.length > 0 && (
        <Card>
          <Title>Results ({stocks.length} stocks)</Title>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Symbol</TableHeaderCell>
                <TableHeaderCell>Company</TableHeaderCell>
                <TableHeaderCell>P/E Ratio</TableHeaderCell>
                <TableHeaderCell>Market Cap</TableHeaderCell>
                <TableHeaderCell>Sector</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stocks.map((stock) => (
                <TableRow key={stock.symbol}>
                  <TableCell>{stock.symbol}</TableCell>
                  <TableCell>{stock.company}</TableCell>
                  <TableCell>{stock.pe_ratio}</TableCell>
                  <TableCell>
                    ${(stock.market_cap / 1000000000).toFixed(2)}B
                  </TableCell>
                  <TableCell>{stock.sector}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
```

### Step 4: Deploy and Test

```bash
git add src/app/screener/
git commit -m "feat: Add stock screener page"
git push origin main
```

**Visit:** https://jcn-tremor.vercel.app/screener

**You should see:**
- Input fields for Min/Max P/E
- "Screen Stocks" button
- Table with results

---

## 🚀 Tutorial 2: Add a Performance Chart

### Goal
Add a page showing portfolio performance over time with a line chart.

### Step 1: Add API Endpoint

**File:** `api/index.py`

```python
@app.get("/api/portfolio-history")
async def get_portfolio_history(
    symbols: str = "AAPL,GOOGL,MSFT",  # Comma-separated
    days: int = 30
):
    """
    Get historical performance for multiple stocks
    
    Parameters:
    - symbols: Comma-separated list of stock symbols
    - days: Number of days of history
    
    Returns:
    - Daily performance data for each stock
    """
    try:
        symbol_list = symbols.split(',')
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get data from MotherDuck
        conn = get_motherduck_connection()
        
        all_data = []
        for symbol in symbol_list:
            query = f"""
                SELECT 
                    date,
                    close_price
                FROM stock_prices
                WHERE symbol = '{symbol.strip()}'
                AND date BETWEEN '{start_date.date()}' AND '{end_date.date()}'
                ORDER BY date
            """
            
            results = conn.execute(query).fetchall()
            
            # Calculate cumulative return
            if results:
                base_price = results[0][1]
                for date, price in results:
                    return_pct = ((price - base_price) / base_price) * 100
                    all_data.append({
                        "date": str(date),
                        "symbol": symbol.strip(),
                        "return": round(return_pct, 2)
                    })
        
        conn.close()
        return {"data": all_data}
        
    except Exception as e:
        logger.error(f"Portfolio history failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 2: Create the Page

**File:** `src/app/performance/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, Title, LineChart } from '@tremor/react';

interface PerformanceData {
  date: string;
  symbol: string;
  return: number;
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/portfolio-history?symbols=AAPL,GOOGL,MSFT&days=30');
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform data for LineChart
  const chartData = data.reduce((acc: any[], item) => {
    const existing = acc.find(d => d.date === item.date);
    if (existing) {
      existing[item.symbol] = item.return;
    } else {
      acc.push({
        date: item.date,
        [item.symbol]: item.return
      });
    }
    return acc;
  }, []);

  return (
    <main className="p-6 space-y-6">
      <div>
        <Title>Portfolio Performance</Title>
        <p className="text-gray-500">30-day cumulative returns</p>
      </div>

      <Card>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <LineChart
            data={chartData}
            index="date"
            categories={["AAPL", "GOOGL", "MSFT"]}
            colors={["blue", "green", "red"]}
            valueFormatter={(value) => `${value.toFixed(2)}%`}
            yAxisWidth={60}
          />
        )}
      </Card>
    </main>
  );
}
```

### Step 3: Deploy

```bash
git add api/index.py src/app/performance/
git commit -m "feat: Add portfolio performance chart"
git push origin main
```

**Visit:** https://jcn-tremor.vercel.app/performance

---

## 🚀 Tutorial 3: Add Reusable Components

### Goal
Create a reusable stock card component you can use anywhere.

### Step 1: Create Component

**File:** `src/components/StockCard.tsx`

```typescript
import { Card, Metric, Text, Flex, BadgeDelta } from '@tremor/react';

interface StockCardProps {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function StockCard({ symbol, price, change, changePercent }: StockCardProps) {
  return (
    <Card>
      <Flex alignItems="start">
        <div>
          <Text>{symbol}</Text>
          <Metric>${price.toFixed(2)}</Metric>
        </div>
        <BadgeDelta deltaType={change >= 0 ? 'increase' : 'decrease'}>
          {changePercent.toFixed(2)}%
        </BadgeDelta>
      </Flex>
    </Card>
  );
}
```

### Step 2: Use It Anywhere

```typescript
import { StockCard } from '@/components/StockCard';

<div className="grid grid-cols-3 gap-4">
  <StockCard symbol="AAPL" price={175.50} change={2.30} changePercent={1.33} />
  <StockCard symbol="GOOGL" price={142.20} change={-1.10} changePercent={-0.77} />
  <StockCard symbol="MSFT" price={420.15} change={5.60} changePercent={1.35} />
</div>
```

---

## ✅ Checklist Before Adding New Modules

### Before You Code

- [ ] I know what data I need from the API
- [ ] I checked if the data exists in MotherDuck
- [ ] I sketched what the page should look like
- [ ] I know which Tremor components to use

### While Coding

- [ ] API endpoint starts with `/api/`
- [ ] API endpoint uses `async def`
- [ ] API endpoint has try/except error handling
- [ ] API endpoint uses cache for expensive operations
- [ ] Frontend page has `'use client';` at the top
- [ ] Frontend uses TypeScript interfaces for data
- [ ] Frontend handles loading states
- [ ] Frontend handles errors gracefully

### After Coding

- [ ] Tested locally first (`pnpm dev`)
- [ ] Committed with clear message
- [ ] Pushed to GitHub
- [ ] Verified deployment succeeded
- [ ] Tested on production URL
- [ ] Checked browser console for errors

---

## 🛡️ Common Mistakes to Avoid

### ❌ Mistake 1: Forgetting `/api/` prefix
```python
@app.get("/screen-stocks")  # ❌ Wrong - will return 404
```

```python
@app.get("/api/screen-stocks")  # ✅ Correct
```

### ❌ Mistake 2: Not using `'use client'`
```typescript
// Missing 'use client' at top
import { useState } from 'react';  // ❌ Will error
```

```typescript
'use client';  // ✅ Add this first
import { useState } from 'react';
```

### ❌ Mistake 3: Not handling loading states
```typescript
// No loading state
const [data, setData] = useState([]);
return <Table data={data} />;  // ❌ Shows empty table while loading
```

```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

if (loading) return <p>Loading...</p>;  // ✅ Shows loading message
return <Table data={data} />;
```

### ❌ Mistake 4: SQL injection vulnerability
```python
query = f"SELECT * FROM stocks WHERE symbol = '{symbol}'"  # ❌ Dangerous!
```

```python
# ✅ Use parameterized queries (if your library supports it)
# Or at minimum, validate/sanitize input
if not symbol.isalnum():
    raise ValueError("Invalid symbol")
query = f"SELECT * FROM stocks WHERE symbol = '{symbol}'"
```

### ❌ Mistake 5: Not using cache
```python
# Expensive query runs every time
conn = get_motherduck_connection()
results = conn.execute(query).fetchall()  # ❌ Slow!
```

```python
# ✅ Check cache first
cached = get_from_cache(cache_key, 3600)
if cached:
    return cached

# Only query if not cached
conn = get_motherduck_connection()
results = conn.execute(query).fetchall()
set_in_cache(cache_key, results, 3600)
```

---

## 📚 Tremor Component Reference

### Most Useful Components

**Cards & Layout:**
```typescript
import { Card, Grid, Flex } from '@tremor/react';

<Card>Content here</Card>
<Grid numItems={3} className="gap-4">
  <Card>1</Card>
  <Card>2</Card>
  <Card>3</Card>
</Grid>
```

**Charts:**
```typescript
import { LineChart, BarChart, AreaChart, DonutChart } from '@tremor/react';

<LineChart
  data={data}
  index="date"
  categories={["AAPL", "GOOGL"]}
  colors={["blue", "green"]}
/>
```

**Tables:**
```typescript
import { Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@tremor/react';

<Table>
  <TableHead>
    <TableRow>
      <TableHeaderCell>Symbol</TableHeaderCell>
      <TableHeaderCell>Price</TableHeaderCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {stocks.map(stock => (
      <TableRow key={stock.symbol}>
        <TableCell>{stock.symbol}</TableCell>
        <TableCell>${stock.price}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Inputs:**
```typescript
import { TextInput, Button, Select, SelectItem } from '@tremor/react';

<TextInput
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter value"
/>

<Button onClick={handleClick}>Click Me</Button>

<Select value={selected} onValueChange={setSelected}>
  <SelectItem value="1">Option 1</SelectItem>
  <SelectItem value="2">Option 2</SelectItem>
</Select>
```

**Metrics:**
```typescript
import { Metric, Text, BadgeDelta } from '@tremor/react';

<Metric>$175.50</Metric>
<Text>Apple Inc.</Text>
<BadgeDelta deltaType="increase">+2.5%</BadgeDelta>
```

---

## 🎯 Next Steps

Now that you understand the basics, you can:

1. **Add more screener filters** (volume, sector, dividend yield)
2. **Add stock comparison pages** (side-by-side analysis)
3. **Add watchlist functionality** (save favorite stocks)
4. **Add alerts** (notify when conditions are met)
5. **Add portfolio tracking** (track your actual holdings)

---

## 💡 Pro Tips

### Tip 1: Use TypeScript Interfaces
```typescript
interface Stock {
  symbol: string;
  price: number;
  change: number;
}

const [stocks, setStocks] = useState<Stock[]>([]);
```

### Tip 2: Create Utility Functions
```typescript
// src/utils/formatters.ts
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
```

### Tip 3: Use Environment Variables
```typescript
// For API URLs that might change
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
```

### Tip 4: Add Loading Skeletons
```typescript
import { Card } from '@tremor/react';

{loading ? (
  <Card>
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  </Card>
) : (
  <Card>Your content</Card>
)}
```

---

**Happy Building! 🚀**

If you get stuck, check:
1. Browser console for errors
2. Vercel deployment logs
3. `/api/health` endpoint still works
4. ARCHITECTURE.md for reference
