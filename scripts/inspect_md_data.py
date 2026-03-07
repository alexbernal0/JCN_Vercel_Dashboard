#!/usr/bin/env python3
"""Inspect MotherDuck data for score recalculation planning."""
import duckdb, os, sys
from dotenv import load_dotenv

load_dotenv(r"C:\Users\admin\Desktop\OBQ_AI\AI_Hedge_Fund_Local\.env")
token = os.getenv("MOTHERDUCK_TOKEN")
if not token:
    print("ERROR: No MOTHERDUCK_TOKEN found")
    sys.exit(1)

con = duckdb.connect(f"md:?motherduck_token={token}")

print("=" * 80)
print("1. shares_outstanding vs bs_commonStockSharesOutstanding (AAPL history)")
print("=" * 80)
df = con.execute("""
    SELECT date, filing_date, shares_outstanding, bs_commonStockSharesOutstanding
    FROM PROD_EODHD.main.PROD_EOD_Fundamentals
    WHERE symbol = 'AAPL.US'
    ORDER BY date DESC
    LIMIT 12
""").fetchdf()
print(df.to_string())

print()
print("=" * 80)
print("2. TTM test: sum last 4 quarters for AAPL as of 2025-03-31")
print("=" * 80)
df2 = con.execute("""
    WITH recent AS (
        SELECT date, CAST(filing_date AS DATE) as fdate, is_totalRevenue, is_netIncome,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as q_rank
        FROM PROD_EODHD.main.PROD_EOD_Fundamentals
        WHERE symbol = 'AAPL.US'
          AND CAST(filing_date AS DATE) <= DATE '2025-03-31'
    )
    SELECT q_rank, date, fdate, is_totalRevenue, is_netIncome,
           SUM(is_totalRevenue) OVER () as ttm_revenue,
           SUM(is_netIncome) OVER () as ttm_net_income
    FROM recent
    WHERE q_rank <= 4
    ORDER BY q_rank
""").fetchdf()
print(df2.to_string())
ttm_rev = df2["ttm_revenue"].iloc[0]
print(f"\nComputed TTM revenue: ${ttm_rev/1e9:.1f}B")

print()
print("=" * 80)
print("3. Month-end market_cap from prices (AAPL Mar 2025)")
print("=" * 80)
df3 = con.execute("""
    SELECT date, adjusted_close, market_cap
    FROM PROD_EODHD.main.PROD_EOD_survivorship
    WHERE symbol = 'AAPL.US'
      AND EXTRACT(MONTH FROM date) = 3 AND EXTRACT(YEAR FROM date) = 2025
    ORDER BY date DESC
    LIMIT 1
""").fetchdf()
print(df3.to_string())

print()
print("=" * 80)
print("4. Symbol coverage by quarter count")
print("=" * 80)
r = con.execute("""
    SELECT COUNT(*) as total_symbols,
           SUM(CASE WHEN cnt >= 4 THEN 1 ELSE 0 END) as has_4q,
           SUM(CASE WHEN cnt >= 8 THEN 1 ELSE 0 END) as has_8q
    FROM (
        SELECT symbol, COUNT(*) as cnt
        FROM PROD_EODHD.main.PROD_EOD_Fundamentals
        WHERE CAST(filing_date AS DATE) <= CURRENT_DATE
        GROUP BY symbol
    )
""").fetchone()
print(f"  Total symbols: {r[0]:,}")
print(f"  With >= 4 quarters: {r[1]:,}")
print(f"  With >= 8 quarters: {r[2]:,}")

print()
print("=" * 80)
print("5. GICS sector distribution")
print("=" * 80)
df4 = con.execute("""
    SELECT gic_sector, COUNT(DISTINCT symbol) as symbols
    FROM PROD_EODHD.main.PROD_EOD_Fundamentals
    WHERE gic_sector IS NOT NULL
    GROUP BY gic_sector
    ORDER BY symbols DESC
""").fetchdf()
print(df4.to_string())

print()
print("=" * 80)
print("6. Filing date coverage over time")
print("=" * 80)
df5 = con.execute("""
    SELECT
        MIN(CAST(filing_date AS DATE)) as earliest_filing,
        MAX(CAST(filing_date AS DATE)) as latest_filing,
        COUNT(DISTINCT CASE WHEN CAST(filing_date AS DATE) <= DATE '2010-01-31' THEN symbol END) as symbols_by_2010,
        COUNT(DISTINCT CASE WHEN CAST(filing_date AS DATE) <= DATE '2015-01-31' THEN symbol END) as symbols_by_2015,
        COUNT(DISTINCT CASE WHEN CAST(filing_date AS DATE) <= DATE '2020-01-31' THEN symbol END) as symbols_by_2020,
        COUNT(DISTINCT CASE WHEN CAST(filing_date AS DATE) <= DATE '2025-01-31' THEN symbol END) as symbols_by_2025
    FROM PROD_EODHD.main.PROD_EOD_Fundamentals
""").fetchdf()
print(df5.to_string())

con.close()
print("\nDone.")
