#!/usr/bin/env python3
"""
Check if MotherDuck has score data for portfolio symbols.
Run from repo root with MOTHERDUCK_TOKEN in .env.local:

  python3 scripts/check_fundamentals_data.py

This prints, for each table, whether rows exist and the latest score values
we use for the Portfolio Fundamentals table.
"""

import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(root / ".env")
    load_dotenv(root / ".env.local")
except Exception:
    pass

os.environ.setdefault("HOME", "/tmp")

# Same symbols as default portfolio (subset for quicker run; use all if you want)
SYMBOLS = [
    "SPMO", "ASML", "MNST", "MSCI", "COST", "AVGO", "MA", "FICO",
    "SPGI", "IDXX", "ISRG", "V", "CAT", "ORLY", "HEI", "NFLX",
    "WM", "TSLA", "AAPL", "LRCX", "TSM",
]

def main():
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        print("MOTHERDUCK_TOKEN not set. Set it in .env.local and run from repo root.")
        sys.exit(1)

    # OBQ_Scores uses symbols WITHOUT .US; Momentum uses .US
    obq_symbols = [s for s in SYMBOLS]
    obq_str = "', '".join(obq_symbols)
    momentum_tickers = [f"{s}.US" for s in SYMBOLS]
    momentum_str = "', '".join(momentum_tickers)

    import duckdb
    conn = duckdb.connect(f"md:?motherduck_token={token}")

    print("=" * 60)
    print("PROD_EODHD.main.PROD_OBQ_Scores (symbols WITHOUT .US)")
    print("=" * 60)

    try:
        # Count rows per symbol
        q_count = f"""
        SELECT symbol, COUNT(*) as cnt, MAX(month_date) as latest_date
        FROM PROD_EODHD.main.PROD_OBQ_Scores
        WHERE symbol IN ('{obq_str}')
        GROUP BY symbol
        ORDER BY symbol
        """
        rows = conn.execute(q_count).fetchall()
        if not rows:
            print("No rows found for these symbols. This table uses symbols WITHOUT .US (e.g. AAPL).")
            # Sample: what symbols exist?
            sample = conn.execute("""
                SELECT symbol, COUNT(*), MAX(month_date)
                FROM PROD_EODHD.main.PROD_OBQ_Scores
                GROUP BY symbol
                ORDER BY COUNT(*) DESC
                LIMIT 5
            """).fetchall()
            print("Sample symbols in table:", sample)
        else:
            for r in rows:
                print(f"  {r[0]}: {r[1]} rows, latest month_date = {r[2]}")

        # Latest row per symbol with the 5 score columns we use
        q_latest = f"""
        SELECT symbol, month_date,
               value_universe_score, value_historical_score, value_sector_score,
               growth_score, fs_score, quality_score
        FROM PROD_EODHD.main.PROD_OBQ_Scores
        WHERE symbol IN ('{obq_str}')
        QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY month_date DESC) = 1
        ORDER BY symbol
        LIMIT 25
        """
        try:
            latest = conn.execute(q_latest).fetchall()
            print("\nLatest row per symbol (score columns we use):")
            for r in latest:
                print(f"  {r[0]} | month_date={r[1]} | value_uni={r[2]} value_hist={r[3]} value_sec={r[4]} | growth={r[5]} fs={r[6]} quality={r[7]}")
        except Exception as e:
            print("Query for latest scores failed:", e)
            # Maybe QUALIFY not supported or column names wrong - try without QUALIFY
            print("Trying simple SELECT for one symbol...")
            one = conn.execute(f"""
                SELECT * FROM PROD_EODHD.main.PROD_OBQ_Scores
                WHERE symbol = 'AAPL.US'
                ORDER BY month_date DESC
                LIMIT 1
            """).fetchone()
            if one:
                cols = [d[0] for d in conn.execute("SELECT * FROM PROD_EODHD.main.PROD_OBQ_Scores WHERE symbol = 'AAPL.US' LIMIT 1").description]
                print("  Columns:", cols)
                print("  Sample row (AAPL.US):", one)
    except Exception as e:
        print("Error:", e)

    print()
    print("=" * 60)
    print("PROD_EODHD.main.PROD_OBQ_Momentum_Scores")
    print("=" * 60)

    try:
        q_count = f"""
        SELECT symbol, COUNT(*) as cnt, MAX(week_end_date) as latest_date
        FROM PROD_EODHD.main.PROD_OBQ_Momentum_Scores
        WHERE symbol IN ('{momentum_str}')
        GROUP BY symbol
        ORDER BY symbol
        """
        rows = conn.execute(q_count).fetchall()
        if not rows:
            print("No rows found for these symbols.")
            sample = conn.execute("""
                SELECT symbol, COUNT(*), MAX(week_end_date)
                FROM PROD_EODHD.main.PROD_OBQ_Momentum_Scores
                GROUP BY symbol
                ORDER BY COUNT(*) DESC
                LIMIT 5
            """).fetchall()
            print("Sample symbols in table:", sample)
        else:
            for r in rows:
                print(f"  {r[0]}: {r[1]} rows, latest week_end_date = {r[2]}")

        q_mom = f"""
        SELECT symbol, week_end_date, obq_momentum_score, systemscore
        FROM PROD_EODHD.main.PROD_OBQ_Momentum_Scores
        WHERE symbol IN ('{momentum_str}')
        QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY week_end_date DESC) = 1
        ORDER BY symbol
        LIMIT 25
        """
        try:
            latest = conn.execute(q_mom).fetchall()
            print("\nLatest momentum per symbol (obq_momentum_score, systemscore fallback):")
            for r in latest:
                print(f"  {r[0]} | week_end_date={r[1]} | obq_momentum={r[2]} | systemscore={r[3]}")
        except Exception as e:
            print("Momentum latest query failed:", e)
    except Exception as e:
        print("Error:", e)

    conn.close()
    print()
    print("Done. If you see rows above but the app shows no values, check column names and date ordering.")

if __name__ == "__main__":
    main()
