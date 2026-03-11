#!/usr/bin/env python3
"""
OBQ JCN Composite Score Recalculation
Computes 8 JCN Composite blend presets from the 5 individual factor score tables.
Each preset is a weighted average of factor *_score_composite values, with weights
re-normalized when some factors are missing for a given symbol.

Reads from:
  - PROD_OBQ_Value_Scores     -> value_score_composite
  - PROD_OBQ_Quality_Scores   -> quality_score_composite
  - PROD_OBQ_FinStr_Scores    -> finstr_score_composite
  - PROD_OBQ_Growth_Scores    -> growth_score_composite
  - PROD_OBQ_Momentum_Scores  -> momentum_score_composite

Writes to:
  - PROD_JCN_Composite_Scores (one row per symbol per month, 8 preset columns)

Usage:
  python scripts/composite_score_recalculation.py --full-rebuild
  python scripts/composite_score_recalculation.py --resume
  python scripts/composite_score_recalculation.py --dry-run --start-date 2020-01-31
"""

import argparse, logging, sys, time, os
from datetime import date, timedelta
from typing import Dict, List, Optional
import duckdb, numpy as np, pandas as pd
from dotenv import load_dotenv

# Configuration
load_dotenv(os.path.join("C:", os.sep, "Users", "admin", "Desktop", "OBQ_AI", "AI_Hedge_Fund_Local", ".env"))
MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN")
SCORE_SCHEMA = "PROD_EODHD.main"
COMPOSITE_TABLE = f"{SCORE_SCHEMA}.PROD_JCN_Composite_Scores"
MAX_RETRIES, RETRY_DELAY = 3, 5

# ---------------------------------------------------------------------------
# Factor source tables: factor_key -> (table_name, composite_column, sector_column)
# ---------------------------------------------------------------------------
FACTOR_SOURCES = {
    "Value":    (f"{SCORE_SCHEMA}.PROD_OBQ_Value_Scores",    "value_score_composite",    "gic_sector"),
    "Quality":  (f"{SCORE_SCHEMA}.PROD_OBQ_Quality_Scores",  "quality_score_composite",  "gic_sector"),
    "FinStr":   (f"{SCORE_SCHEMA}.PROD_OBQ_FinStr_Scores",   "finstr_score_composite",   "gic_sector"),
    "Growth":   (f"{SCORE_SCHEMA}.PROD_OBQ_Growth_Scores",   "growth_score_composite",   "gic_sector"),
    "Momentum": (f"{SCORE_SCHEMA}.PROD_OBQ_Momentum_Scores", "momentum_score_composite", "gics_sector"),
}

# ---------------------------------------------------------------------------
# 8 JCN Composite Blend Presets
# Each preset: {factor_key: weight}
# Weights sum to 1.0; re-normalized at runtime if some factors are NULL.
# ---------------------------------------------------------------------------
COMPOSITE_PRESETS = {
    "jcn_full_composite":          {"Value": 0.20, "Quality": 0.20, "Growth": 0.20, "Momentum": 0.20, "FinStr": 0.20},
    "jcn_qarp":                    {"Quality": 0.40, "Value": 0.40, "Momentum": 0.20},
    "jcn_garp":                    {"Growth": 0.40, "Value": 0.40, "Momentum": 0.20},
    "jcn_quality_momentum":        {"Quality": 0.50, "Momentum": 0.50},
    "jcn_value_momentum":          {"Value": 0.50, "Momentum": 0.50},
    "jcn_growth_quality_momentum": {"Growth": 0.34, "Quality": 0.33, "Momentum": 0.33},
    "jcn_fortress":                {"Quality": 0.40, "FinStr": 0.40, "Value": 0.20},
    "jcn_alpha_trifecta":          {"Value": 0.34, "Quality": 0.33, "Momentum": 0.33},
}

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("composite_score_recalc")


# ---------------------------------------------------------------------------
# CONNECTION MANAGER
# ---------------------------------------------------------------------------
class MotherDuckConnection:
    def __init__(self, token):
        self.token = token
        self.con = None
        self._connect()

    def _connect(self):
        for attempt in range(MAX_RETRIES):
            try:
                self.con = duckdb.connect(f"md:?motherduck_token={self.token}")
                log.info("Connected to MotherDuck.")
                return
            except Exception as e:
                log.warning(f"Connection attempt {attempt+1}/{MAX_RETRIES} failed: {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
        raise ConnectionError("Failed to connect to MotherDuck after retries.")

    def execute(self, sql, params=None):
        for attempt in range(MAX_RETRIES):
            try:
                return self.con.execute(sql, params) if params else self.con.execute(sql)
            except (duckdb.IOException, duckdb.CatalogException) as e:
                log.warning(f"Query failed (attempt {attempt+1}): {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    self._connect()
                else:
                    raise

    def fetchdf(self, sql, params=None):
        return self.execute(sql, params).fetchdf()

    def close(self):
        if self.con:
            self.con.close()
            self.con = None


# ---------------------------------------------------------------------------
# PROGRESS TRACKING
# ---------------------------------------------------------------------------
PROGRESS_TABLE = f"{SCORE_SCHEMA}.SCORE_CALC_PROGRESS"
CREATE_PROGRESS_SQL = f"""CREATE TABLE IF NOT EXISTS {PROGRESS_TABLE} (
    score_type VARCHAR NOT NULL, last_completed_month DATE,
    total_rows_written BIGINT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (score_type))"""

def get_last_completed(mdc, score_type):
    try:
        r = mdc.execute(f"SELECT last_completed_month FROM {PROGRESS_TABLE} WHERE score_type = ?", [score_type]).fetchone()
        return r[0] if r and r[0] else None
    except Exception:
        return None

def update_progress(mdc, score_type, month, total_rows):
    mdc.execute(f"INSERT OR REPLACE INTO {PROGRESS_TABLE} (score_type, last_completed_month, total_rows_written, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", [score_type, month, total_rows])


# ---------------------------------------------------------------------------
# TABLE CREATION
# ---------------------------------------------------------------------------
CREATE_COMPOSITE_SQL = f"""CREATE TABLE IF NOT EXISTS {COMPOSITE_TABLE} (
    symbol VARCHAR NOT NULL,
    month_date DATE NOT NULL,
    gic_sector VARCHAR,
    value_score DOUBLE,
    quality_score DOUBLE,
    growth_score DOUBLE,
    momentum_score DOUBLE,
    finstr_score DOUBLE,
    jcn_full_composite DOUBLE,
    jcn_qarp DOUBLE,
    jcn_garp DOUBLE,
    jcn_quality_momentum DOUBLE,
    jcn_value_momentum DOUBLE,
    jcn_growth_quality_momentum DOUBLE,
    jcn_fortress DOUBLE,
    jcn_alpha_trifecta DOUBLE,
    factors_available TINYINT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, month_date))"""


# ---------------------------------------------------------------------------
# DATE UTILITIES
# ---------------------------------------------------------------------------
def get_month_ends(start, end):
    months, d = [], start.replace(day=1)
    while d <= end:
        if d.month < 12:
            last = d.replace(month=d.month + 1, day=1) - timedelta(days=1)
        else:
            last = d.replace(day=31)
        if last >= start:
            months.append(last)
        d = (d.replace(month=d.month + 1, day=1) if d.month < 12
             else d.replace(year=d.year + 1, month=1, day=1))
    return [m for m in months if m <= end]


# ---------------------------------------------------------------------------
# BLEND COMPUTATION
# ---------------------------------------------------------------------------
def compute_blend(row, preset_weights):
    """
    Compute a single blend score for one symbol.
    preset_weights: dict {factor_key: weight} e.g. {"Value": 0.20, "Quality": 0.20, ...}
    row: dict-like with factor keys mapped to their composite scores.

    Returns: weighted average (re-normalized for missing) or NaN.
    """
    available = {}
    for factor_key, weight in preset_weights.items():
        val = row.get(factor_key)
        if val is not None and not (isinstance(val, float) and np.isnan(val)):
            available[factor_key] = (val, weight)

    if not available:
        return np.nan

    total_w = sum(w for _, w in available.values())
    return sum(v * w / total_w for v, w in available.values())


def process_month(mdc, month_end, dry_run=False):
    """
    For a single month:
    1. Query all 5 factor score tables for composite scores
    2. Merge into one DataFrame (outer join on symbol)
    3. Compute 8 blend presets
    4. Write to PROD_JCN_Composite_Scores
    """
    md_str = month_end.strftime('%Y-%m-%d')
    t0 = time.time()

    # Step 1: Read composite scores from each factor table
    merged = None
    factor_col_map = {}  # factor_key -> column name in merged df

    for factor_key, (table, col, sector_col) in FACTOR_SOURCES.items():
        try:
            # Momentum stores plain symbols (AAPL); fundamentals use .US suffix (AAPL.US).
            # Normalize momentum symbols to .US format so the outer join merges correctly.
            if factor_key == "Momentum":
                symbol_expr = "symbol || '.US' AS symbol"
            else:
                symbol_expr = "symbol"
            df = mdc.fetchdf(
                f"SELECT {symbol_expr}, {col} AS {factor_key}, {sector_col} AS gic_sector "
                f"FROM {table} "
                f"WHERE month_date = DATE '{md_str}'"
            )
        except Exception as e:
            log.warning(f'{md_str}: Could not read {factor_key} from {table}: {e}')
            continue

        if df.empty:
            log.debug(f'{md_str}: No {factor_key} data.')
            continue

        factor_col_map[factor_key] = factor_key

        if merged is None:
            merged = df
        else:
            # Merge on symbol; keep gic_sector from first non-null source
            merged = merged.merge(
                df[['symbol', factor_key]],
                on='symbol', how='outer'
            )

    if merged is None or merged.empty:
        log.warning(f'{md_str}: No factor data available. Skipping.')
        return 0

    # Step 2: Compute 8 blend presets
    for preset_name, weights in COMPOSITE_PRESETS.items():
        merged[preset_name] = merged.apply(
            lambda row: compute_blend(row, weights), axis=1
        )

    # Step 3: Build output DataFrame
    # Map factor keys to output column names
    factor_output_map = {
        "Value": "value_score",
        "Quality": "quality_score",
        "Growth": "growth_score",
        "Momentum": "momentum_score",
        "FinStr": "finstr_score",
    }

    out = pd.DataFrame()
    out['symbol'] = merged['symbol']
    out['month_date'] = month_end
    out['gic_sector'] = merged.get('gic_sector')

    # Individual factor composite scores
    for factor_key, out_col in factor_output_map.items():
        out[out_col] = merged.get(factor_key, pd.Series(np.nan, index=merged.index))

    # 8 blend preset columns
    for preset_name in COMPOSITE_PRESETS:
        out[preset_name] = merged[preset_name]

    # Count how many factors are available per symbol
    factor_cols = list(factor_output_map.values())
    out['factors_available'] = out[factor_cols].notna().sum(axis=1).astype(int)

    # Filter: require at least 1 factor score
    out = out[out['factors_available'] >= 1].copy()
    out = out.reset_index(drop=True)

    elapsed = time.time() - t0
    n_blends = int(out['jcn_full_composite'].notna().sum())
    log.info(f'{md_str}: {len(out)} symbols, {n_blends} with full composite, {elapsed:.1f}s')

    if dry_run:
        sample = out.head(5)
        for _, r in sample.iterrows():
            log.info(
                f'  {r["symbol"]}: V={r.get("value_score", np.nan):.1f} '
                f'Q={r.get("quality_score", np.nan):.1f} '
                f'G={r.get("growth_score", np.nan):.1f} '
                f'M={r.get("momentum_score", np.nan):.1f} '
                f'FS={r.get("finstr_score", np.nan):.1f} '
                f'Full={r.get("jcn_full_composite", np.nan):.1f} '
                f'QARP={r.get("jcn_qarp", np.nan):.1f}'
            )
        return len(out)

    # Step 4: Write to MotherDuck (idempotent: delete then insert)
    if out.empty:
        return 0

    try:
        mdc.execute(f"DELETE FROM {COMPOSITE_TABLE} WHERE month_date = ?", [month_end])
        mdc.con.register('__comp_batch', out)
        col_list = ', '.join(out.columns.tolist())
        mdc.execute(f'INSERT INTO {COMPOSITE_TABLE} ({col_list}) SELECT {col_list} FROM __comp_batch')
        mdc.con.unregister('__comp_batch')
        return len(out)
    except Exception as e:
        log.error(f'{md_str}: Write failed: {e}')
        try:
            mdc.con.unregister('__comp_batch')
        except Exception:
            pass
        return 0


# ---------------------------------------------------------------------------
# FIND AVAILABLE MONTHS
# ---------------------------------------------------------------------------
def find_available_months(mdc, start_date, end_date):
    """
    Find all month_dates that have data in ANY of the 5 factor tables.
    We only compute composites for months where at least 2 factors exist.
    """
    all_months = set()
    for factor_key, (table, col, _) in FACTOR_SOURCES.items():
        try:
            df = mdc.fetchdf(
                f"SELECT DISTINCT month_date FROM {table} "
                f"WHERE month_date >= DATE '{start_date.strftime('%Y-%m-%d')}' "
                f"AND month_date <= DATE '{end_date.strftime('%Y-%m-%d')}' "
                f"ORDER BY month_date"
            )
            for _, row in df.iterrows():
                md = row['month_date']
                if hasattr(md, 'date'):
                    md = md.date()
                elif isinstance(md, str):
                    md = date.fromisoformat(md)
                all_months.add(md)
        except Exception as e:
            log.warning(f'Could not read months from {table}: {e}')

    months = sorted(all_months)
    log.info(f'Found {len(months)} months with factor data ({start_date} to {end_date})')
    return months


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='OBQ JCN Composite Score Recalculation')
    parser.add_argument('--full-rebuild', action='store_true',
        help='Full rebuild from 2010 (drops existing composite table)')
    parser.add_argument('--start-date', default=None,
        help='Override start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', default=None,
        help='Override end date (YYYY-MM-DD)')
    parser.add_argument('--resume', action='store_true',
        help='Resume from last completed month')
    parser.add_argument('--dry-run', action='store_true',
        help='Compute but do not write to MotherDuck')
    args = parser.parse_args()

    if not MOTHERDUCK_TOKEN:
        log.error('MOTHERDUCK_TOKEN not found. Check .env file.')
        sys.exit(1)

    mdc = MotherDuckConnection(MOTHERDUCK_TOKEN)
    mdc.execute(CREATE_PROGRESS_SQL)

    # Determine date range
    if args.start_date:
        start = date.fromisoformat(args.start_date)
    elif args.full_rebuild:
        start = date(2010, 1, 1)
    elif args.resume:
        last = get_last_completed(mdc, 'composite')
        if last:
            if last.month < 12:
                start = last.replace(month=last.month + 1, day=1)
            else:
                start = last.replace(year=last.year + 1, month=1, day=1)
            log.info(f'Resuming from {start} (last completed: {last})')
        else:
            log.info('No progress found. Starting full rebuild from 2010.')
            start = date(2010, 1, 1)
    else:
        start = date(2010, 1, 1)

    if args.end_date:
        end = date.fromisoformat(args.end_date)
    else:
        end = date.today().replace(day=1) - timedelta(days=1)

    # Find months that have factor data
    month_dates = find_available_months(mdc, start, end)
    log.info(f'Composite: {len(month_dates)} months to process ({start} to {end})')

    if not month_dates:
        log.info('No months to process.')
        mdc.close()
        return

    # Full rebuild: drop and recreate
    if args.full_rebuild and not args.dry_run:
        try:
            mdc.execute(f'DROP TABLE IF EXISTS {COMPOSITE_TABLE}')
            log.info(f'Dropped existing table {COMPOSITE_TABLE}')
        except Exception:
            pass

    if not args.dry_run:
        mdc.execute(CREATE_COMPOSITE_SQL)
        log.info(f'Ensured table {COMPOSITE_TABLE} exists.')

    # Process months
    total_written = 0
    for i, month_end in enumerate(month_dates):
        rows = process_month(mdc, month_end, dry_run=args.dry_run)
        total_written += rows
        if not args.dry_run and rows > 0:
            update_progress(mdc, 'composite', month_end, total_written)
        if (i + 1) % 12 == 0:
            log.info(f'Progress: {i+1}/{len(month_dates)} months, {total_written} total rows')

    log.info(f'=== COMPOSITE COMPLETE. {total_written} total rows across {len(month_dates)} months. ===')

    # Verify distribution
    if total_written > 0 and not args.dry_run:
        try:
            stats = mdc.fetchdf(
                f"SELECT COUNT(*) AS total_rows, COUNT(DISTINCT symbol) AS n_symbols, "
                f"MIN(month_date) AS min_date, MAX(month_date) AS max_date, "
                f"AVG(jcn_full_composite) AS mean_full, "
                f"AVG(jcn_qarp) AS mean_qarp, "
                f"AVG(jcn_garp) AS mean_garp, "
                f"AVG(factors_available) AS avg_factors "
                f"FROM {COMPOSITE_TABLE} WHERE jcn_full_composite IS NOT NULL")
            for _, r in stats.iterrows():
                log.info(
                    f'STATS: {int(r["total_rows"])} rows, {int(r["n_symbols"])} symbols, '
                    f'{r["min_date"]} to {r["max_date"]}, '
                    f'mean_full={r["mean_full"]:.2f}, mean_qarp={r["mean_qarp"]:.2f}, '
                    f'mean_garp={r["mean_garp"]:.2f}, avg_factors={r["avg_factors"]:.1f}'
                )
        except Exception as e:
            log.warning(f'Could not verify stats: {e}')

    mdc.close()


if __name__ == '__main__':
    main()
