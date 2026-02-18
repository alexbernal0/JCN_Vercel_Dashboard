#!/usr/bin/env python3
"""
Describe PROD_OBQ_Scores and PROD_OBQ_Momentum_Scores column counts.
Run from repo root with MOTHERDUCK_TOKEN in .env.local:
  python scripts/describe_score_tables.py
"""

import os
import sys
from pathlib import Path

# Load .env.local from project root
root = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(root / ".env")
    load_dotenv(root / ".env.local")
except Exception:
    pass

os.environ.setdefault("HOME", "/tmp")

def is_date_column(name: str) -> bool:
    n = (name or "").lower()
    return n in ("date", "as_of_date", "report_date", "updated_at", "asof")

def score_columns_from_describe(rows: list) -> list:
    """Column names from DESCRIBE output, excluding symbol and date-like."""
    names = [r[0] for r in rows] if rows else []
    return [n for n in names if (n or "").lower() != "symbol" and not is_date_column(n)]

def main():
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        print("MOTHERDUCK_TOKEN not set. Set it in .env.local and run from repo root.")
        sys.exit(1)

    import duckdb
    conn = duckdb.connect(f"md:?motherduck_token={token}")

    tables = [
        "PROD_EODHD.main.PROD_OBQ_Scores",
        "PROD_EODHD.main.PROD_OBQ_Momentum_Scores",
    ]

    all_scores = []
    for table in tables:
        try:
            rows = conn.execute(f"DESCRIBE {table}").fetchall()
            # DESCRIBE returns (column_name, type, null, key, default, extra)
            col_names = [r[0] for r in rows]
            scores = score_columns_from_describe([(c,) for c in col_names])
            all_scores.extend(scores)
            print(f"\n{table}")
            print(f"  All columns: {col_names}")
            print(f"  Score columns (excl. symbol/date): {scores}")
            print(f"  Count: {len(scores)}")
        except Exception as e:
            print(f"\n{table}: ERROR - {e}")

    conn.close()

    distinct = list(dict.fromkeys(all_scores))
    print(f"\n--- Combined ---")
    print(f"Distinct score column names across both tables: {len(distinct)}")
    print(f"Names: {distinct}")

if __name__ == "__main__":
    main()
