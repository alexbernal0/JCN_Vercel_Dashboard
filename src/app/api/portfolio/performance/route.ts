import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PortfolioPosition {
  symbol: string;
  costBasis: number;
  shares: number;
}

interface PerformanceData {
  ticker: string;
  security: string;
  costBasis: number;
  currentPrice: number;
  shares: number;
  portValue: number;
  portPct: number;
  dailyChangePct: number;
  ytdPct: number;
  yoyPct: number;
  portGainPct: number;
  pctBelow52wkHigh: number;
  chanRangePct: number;
  week52High: number;
  week52Low: number;
  sector: string;
  industry: string;
}

// In-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const MOTHERDUCK_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(type: string, ticker?: string): string {
  return ticker ? `${type}:${ticker}` : type;
}

function getFromCache(key: string, ttl: number): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { positions } = body as { positions: PortfolioPosition[] };

    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return NextResponse.json({ error: "Invalid request: positions array required" }, { status: 400 });
    }

    // Get performance data for all positions
    const performanceData = await Promise.all(positions.map((position) => getPositionPerformance(position)));

    // Calculate total portfolio value
    const totalValue = performanceData.reduce((sum, pos) => sum + pos.portValue, 0);

    // Calculate portfolio percentages
    const dataWithPortPct = performanceData.map((pos) => ({
      ...pos,
      portPct: (pos.portValue / totalValue) * 100,
    }));

    return NextResponse.json({
      data: dataWithPortPct,
      lastUpdated: new Date().toISOString(),
      source: "MotherDuck + yfinance",
    });
  } catch (error) {
    console.error("Portfolio performance API error:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio performance data" }, { status: 500 });
  }
}

async function getPositionPerformance(position: PortfolioPosition): Promise<PerformanceData> {
  const { symbol: ticker, costBasis, shares } = position;

  // Get historical data from MotherDuck
  const historicalData = await getMotherDuckData(ticker);

  // Get current price from yfinance (cached)
  const currentPrice = await getCurrentPrice(ticker);

  // Calculate portfolio metrics
  const portValue = currentPrice * shares;
  const portGainPct = ((currentPrice - costBasis) / costBasis) * 100;

  return {
    ticker,
    security: historicalData.security || ticker,
    costBasis,
    currentPrice,
    shares,
    portValue,
    portPct: 0, // Will be calculated after we have total portfolio value
    dailyChangePct: historicalData.dailyChangePct || 0,
    ytdPct: historicalData.ytdPct || 0,
    yoyPct: historicalData.yoyPct || 0,
    portGainPct,
    pctBelow52wkHigh: historicalData.pctBelow52wkHigh || 0,
    chanRangePct: historicalData.chanRangePct || 0,
    week52High: historicalData.week52High || currentPrice,
    week52Low: historicalData.week52Low || currentPrice,
    sector: historicalData.sector || "N/A",
    industry: historicalData.industry || "N/A",
  };
}

async function getMotherDuckData(ticker: string): Promise<any> {
  const cacheKey = getCacheKey("motherduck", ticker);
  const cached = getFromCache(cacheKey, MOTHERDUCK_CACHE_TTL);
  if (cached) {
    return cached;
  }

  try {
    // Call Python script to query MotherDuck
    const { spawn } = require("node:child_process");
    const tickerWithSuffix = `${ticker}.US`;

    const result = await new Promise((resolve, reject) => {
      const python = spawn("python3", [
        "-c",
        `
import duckdb
import os
import json
import sys

os.environ['motherduck_token'] = "${process.env.MOTHERDUCK_TOKEN}"
con = duckdb.connect('md:PROD_EODHD')

ticker = "${tickerWithSuffix}"

query = """
    WITH price_data AS (
        SELECT 
            symbol,
            date,
            close,
            high,
            low,
            gics_sector,
            industry,
            LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date) as prev_close,
            FIRST_VALUE(close) OVER (PARTITION BY symbol, YEAR(date) ORDER BY date) as ytd_start_price,
            LAG(close, 252) OVER (PARTITION BY symbol ORDER BY date) as year_ago_price,
            MAX(high) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 251 PRECEDING AND CURRENT ROW) as week_52_high,
            MIN(low) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 251 PRECEDING AND CURRENT ROW) as week_52_low
        FROM PROD_EOD_Survivorship
        WHERE symbol = ?
          AND date >= CURRENT_DATE - INTERVAL '400 days'
    )
    SELECT 
        symbol,
        close as current_price,
        ROUND(((close - prev_close) / NULLIF(prev_close, 0) * 100)::NUMERIC, 2) as daily_change_pct,
        ROUND(((close - ytd_start_price) / NULLIF(ytd_start_price, 0) * 100)::NUMERIC, 2) as ytd_pct,
        ROUND(((close - year_ago_price) / NULLIF(year_ago_price, 0) * 100)::NUMERIC, 2) as yoy_pct,
        ROUND(((week_52_high - close) / NULLIF(week_52_high, 0) * 100)::NUMERIC, 2) as pct_below_52wk_high,
        ROUND(((close - week_52_low) / NULLIF((week_52_high - week_52_low), 0) * 100)::NUMERIC, 2) as chan_range_pct,
        week_52_high,
        week_52_low,
        gics_sector,
        industry
    FROM price_data
    ORDER BY date DESC
    LIMIT 1
"""

try:
    result = con.execute(query, [ticker]).fetchone()
    con.close()
    
    if result:
        data = {
            "security": result[0].replace('.US', ''),
            "dailyChangePct": float(result[2]) if result[2] is not None else 0,
            "ytdPct": float(result[3]) if result[3] is not None else 0,
            "yoyPct": float(result[4]) if result[4] is not None else 0,
            "pctBelow52wkHigh": float(result[5]) if result[5] is not None else 0,
            "chanRangePct": float(result[6]) if result[6] is not None else 0,
            "week52High": float(result[7]) if result[7] is not None else 0,
            "week52Low": float(result[8]) if result[8] is not None else 0,
            "sector": result[9] if result[9] else "N/A",
            "industry": result[10] if result[10] else "N/A"
        }
        print(json.dumps(data))
    else:
        print(json.dumps({"error": "No data found"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
        `,
      ]);

      let stdout = "";
      let stderr = "";

      python.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      python.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      python.on("close", (code: number) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
        } else {
          try {
            const data = JSON.parse(stdout);
            resolve(data);
          } catch (_e) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
          }
        }
      });
    });

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`MotherDuck query failed for ${ticker}:`, error);
    // Return default values if query fails
    return {
      security: ticker,
      dailyChangePct: 0,
      ytdPct: 0,
      yoyPct: 0,
      pctBelow52wkHigh: 0,
      chanRangePct: 0,
      week52High: 0,
      week52Low: 0,
      sector: "N/A",
      industry: "N/A",
    };
  }
}

async function getCurrentPrice(ticker: string): Promise<number> {
  const cacheKey = getCacheKey("price", ticker);
  const cached = getFromCache(cacheKey, PRICE_CACHE_TTL);
  if (cached) {
    return cached;
  }

  try {
    // Call Python script to fetch from yfinance
    const { spawn } = require("node:child_process");

    const price = await new Promise<number>((resolve, reject) => {
      const python = spawn("python3", [
        "-c",
        `
import yfinance as yf
import json

ticker = "${ticker}"
try:
    stock = yf.Ticker(ticker)
    hist = stock.history(period="1d")
    if not hist.empty:
        price = float(hist['Close'].iloc[-1])
        print(json.dumps({"price": price}))
    else:
        print(json.dumps({"error": "No data"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
        `,
      ]);

      let stdout = "";
      let stderr = "";

      python.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      python.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      python.on("close", (code: number) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
        } else {
          try {
            const data = JSON.parse(stdout);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.price);
            }
          } catch (_e) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
          }
        }
      });
    });

    setCache(cacheKey, price);
    return price;
  } catch (error) {
    console.error(`Failed to fetch current price for ${ticker}:`, error);
    // Fallback: try to get latest price from MotherDuck
    const historicalData = await getMotherDuckData(ticker);
    return historicalData.currentPrice || 0;
  }
}
