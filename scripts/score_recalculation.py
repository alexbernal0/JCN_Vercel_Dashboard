#!/usr/bin/env python3
"""
OBQ Score Recalculation - Fundamental Scores
Calculates Value, Quality, Growth, Financial Strength scores for stocks in the
PROD_OBQ_Investable_Universe (top 3000 by market cap, annually reconstituted
in May). For months before 2003-07-01 all available stocks are scored.

Data flow: MotherDuck (SQL CTE) -> Python (3-way scoring) -> MotherDuck (write)
No local files. No temp tables. No OBQ_AI dependency.

Usage:
  python scripts/score_recalculation.py --score value --full-rebuild
  python scripts/score_recalculation.py --score all --full-rebuild --dry-run
  python scripts/score_recalculation.py --score all --resume
"""

import argparse, logging, sys, time, os
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
import duckdb, numpy as np, pandas as pd
from dotenv import load_dotenv

# Configuration
load_dotenv(os.path.join("C:", os.sep, "Users", "admin", "Desktop", "OBQ_AI", "AI_Hedge_Fund_Local", ".env"))
MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN")
FUND_TABLE = "PROD_EODHD.main.PROD_EOD_Fundamentals"
PRICE_TABLE = "PROD_EODHD.main.PROD_EOD_survivorship"
SCORE_SCHEMA = "PROD_EODHD.main"
# Investable universe: top-3000 by market cap, annually reconstituted in May.
# Scores are restricted to symbols in this table for each scoring month.
UNIVERSE_TABLE = "PROD_EODHD.main.PROD_OBQ_Investable_Universe"
# Universe table starts at the 2003 reconstitution (effective 2003-07-01).
# Months before this date score all available stocks (no filtering).
UNIVERSE_START_DATE = date(2003, 7, 1)
STALENESS_DAYS = 548
MIN_VALID_METRICS = 2
MIN_SECTOR_PEERS = 3
MIN_HISTORY_QUARTERS = 8
UNIV_WEIGHT, SECT_WEIGHT, HIST_WEIGHT = 0.40, 0.40, 0.20
MAX_RETRIES, RETRY_DELAY = 3, 5

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("score_recalc")


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
# SHARED SCORING FUNCTIONS (identical to OBQ_AI architecture)
# ---------------------------------------------------------------------------
def percentile_rank(series, ascending=True):
    """Percentile rank 0-100. ascending=True: higher value = higher score."""
    s = series if ascending else -series
    n = s.notna().sum()
    if n == 0:
        return pd.Series(float("nan"), index=series.index)
    ranked = s.rank(method="average", ascending=True, na_option="keep")
    score = (ranked - 1) / (n - 1) * 100.0 if n > 1 else pd.Series(50.0, index=series.index)
    score[series.isna()] = float("nan")
    return score


def weighted_composite(row, metric_cols, weights, min_valid=MIN_VALID_METRICS):
    """Weighted average of ranked metrics, re-normalizing for missing."""
    valid_mask = [not pd.isna(row.get(f"rank_{c}")) for c in metric_cols]
    n_valid = sum(valid_mask)
    if n_valid < min_valid:
        return None, n_valid
    total_w = sum(w for m, w in zip(valid_mask, weights) if m)
    composite = sum(
        row[f"rank_{c}"] * w / total_w
        for c, w, m in zip(metric_cols, weights, valid_mask) if m
    )
    return composite, n_valid


def compute_universe_score(df, metric_cols, weights, asc_flags):
    """Cross-sectional percentile rank across all symbols."""
    df = df.copy()
    for col, asc in zip(metric_cols, asc_flags):
        df[f"rank_{col}"] = percentile_rank(df[col], ascending=asc)
    results = df.apply(lambda r: weighted_composite(r, metric_cols, weights), axis=1)
    composite_raw = results.apply(lambda x: x[0])
    metrics_used = results.apply(lambda x: x[1])
    return percentile_rank(composite_raw, ascending=True), metrics_used


def compute_sector_score(df, metric_cols, weights, asc_flags):
    """Percentile rank within GICS sector (min 3 peers)."""
    df = df.copy()
    out = pd.Series(float("nan"), index=df.index)
    for sector, grp in df.groupby("gic_sector", dropna=True):
        if len(grp) < MIN_SECTOR_PEERS:
            continue
        g = grp.copy()
        for col, asc in zip(metric_cols, asc_flags):
            g[f"rank_{col}"] = percentile_rank(g[col], ascending=asc)
        results = g.apply(lambda r: weighted_composite(r, metric_cols, weights), axis=1)
        out.loc[g.index] = percentile_rank(results.apply(lambda x: x[0]), ascending=True).values
    return out


def compute_history_score(df, history, metric_cols, weights, asc_flags):
    """Rank current value vs own historical distribution (min 8 quarters)."""
    out = pd.Series(float("nan"), index=df.index)
    for idx, row in df.iterrows():
        sym = row["symbol"]
        if sym not in history:
            continue
        ranks, total_w, n_valid = [], 0.0, 0
        for col, w, asc in zip(metric_cols, weights, asc_flags):
            cur = row[col]
            if pd.isna(cur):
                continue
            past = [v for v in history[sym].get(col, []) if not np.isnan(v)]
            if len(past) < MIN_HISTORY_QUARTERS:
                continue
            past_arr = np.array(past)
            rank_val = float(np.mean(past_arr < cur) if asc else np.mean(past_arr > cur)) * 100.0
            ranks.append((rank_val, w))
            total_w += w
            n_valid += 1
        if n_valid >= MIN_VALID_METRICS and total_w > 0:
            out.iloc[df.index.get_loc(idx)] = sum(r * w / total_w for r, w in ranks)
    return out


def compute_composite_score(u, s, h):
    """Weighted composite: Universe(40%) + Sector(40%) + History(20%). Final re-rank."""
    dims = pd.DataFrame({"universe": u, "sector": s, "history": h})
    dims_used = dims.notna().sum(axis=1)
    raw = UNIV_WEIGHT * dims["universe"].fillna(0) + SECT_WEIGHT * dims["sector"].fillna(0) + HIST_WEIGHT * dims["history"].fillna(0)
    wt = UNIV_WEIGHT * dims["universe"].notna().astype(float) + SECT_WEIGHT * dims["sector"].notna().astype(float) + HIST_WEIGHT * dims["history"].notna().astype(float)
    composite = raw / wt.where(wt > 0)
    composite[dims_used == 0] = float("nan")
    return percentile_rank(composite, ascending=True), dims_used


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
        d = d.replace(month=d.month + 1, day=1) if d.month < 12 else d.replace(year=d.year + 1, month=1, day=1)
    return [m for m in months if m <= end]

def prior_month_end(d):
    return d.replace(day=1) - timedelta(days=1)


# ---------------------------------------------------------------------------
# INVESTABLE UNIVERSE FILTER
# ---------------------------------------------------------------------------
def get_universe_filter(md_str):
    """
    Returns a SQL WHERE clause fragment that restricts scoring to stocks in the
    PROD_OBQ_Investable_Universe table for the given scoring month.

    The universe table holds top-3000 stocks by market cap, reconstituted annually
    in May. Each row has effective_start / effective_end date bounds that define
    which recon year covers a given scoring month:
      - month_date 2024-09-30 -> recon 2024 (effective 2024-07-01 to 2025-06-30)
      - month_date 2024-03-31 -> recon 2023 (effective 2023-07-01 to 2024-06-30)

    For months before UNIVERSE_START_DATE (2003-07-01), returns an empty string
    so all available stocks are scored (backward compatibility for early history).

    Usage in SQL builders: add {universe_filter} at the end of the WHERE clause
    in the earliest CTE that reads from FUND_TABLE, e.g.:
        WHERE CAST(filing_date AS DATE) <= DATE '...'
          AND CAST(filing_date AS DATE) >= DATE '...'
          {universe_filter}

    Parameters:
        md_str: date string 'YYYY-MM-DD' representing the scoring month-end

    Returns:
        SQL fragment string (with leading newline + indent) or empty string
    """
    month = date.fromisoformat(md_str)
    if month < UNIVERSE_START_DATE:
        # Universe table does not cover this period -- score all available stocks
        return ""
    # SQL subquery: symbol must be in the active investable universe for this month
    # Using string concatenation avoids any f-string multiline complexity
    return (
        " AND symbol IN ("
        "SELECT symbol FROM " + UNIVERSE_TABLE + " "
        "WHERE effective_start <= DATE '" + md_str + "' "
        "AND effective_end >= DATE '" + md_str + "')"
    )


# ---------------------------------------------------------------------------
# VALUE SCORE - 5 metrics (lower ratio = cheaper = better)
# ---------------------------------------------------------------------------
VALUE_METRICS = [("pfcf_ttm", 0.30, False), ("ev_ebitda_ttm", 0.25, False),
    ("pe_ttm", 0.20, False), ("ps_ttm", 0.15, False), ("pb_mrq", 0.10, False)]
VALUE_COLS = [m[0] for m in VALUE_METRICS]
VALUE_WTS = [m[1] for m in VALUE_METRICS]
VALUE_ASC = [m[2] for m in VALUE_METRICS]
VALUE_TABLE = f"{SCORE_SCHEMA}.PROD_OBQ_Value_Scores"
CREATE_VALUE_SQL = f"""CREATE TABLE IF NOT EXISTS {VALUE_TABLE} (
    symbol VARCHAR NOT NULL, month_date DATE NOT NULL,
    as_of_filing_date DATE, gic_sector VARCHAR,
    pe_ttm DOUBLE, pfcf_ttm DOUBLE, ev_ebitda_ttm DOUBLE, ps_ttm DOUBLE, pb_mrq DOUBLE,
    market_cap DOUBLE, enterprise_value DOUBLE,
    value_score_universe DOUBLE, value_score_sector DOUBLE,
    value_score_history DOUBLE, value_score_composite DOUBLE,
    metrics_used TINYINT, dimensions_used TINYINT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, month_date))"""


def build_value_sql(md_str, universe_filter=""):
    """
    Build SQL query for Value score raw data.

    universe_filter: SQL fragment from get_universe_filter() applied to numbered_filings
                     to restrict to investable universe stocks for this scoring month.
    """
    return f"""
    WITH trading_day AS (
        SELECT MAX(date) as td FROM {PRICE_TABLE}
        WHERE date <= DATE '{md_str}'
          AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM DATE '{md_str}')
          AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM DATE '{md_str}')
          AND adjusted_close IS NOT NULL AND adjusted_close > 0),
    prices AS (
        SELECT p.symbol, p.adjusted_close AS price, p.market_cap, p.gics_sector
        FROM {PRICE_TABLE} p, trading_day t
        WHERE p.date = t.td AND p.adjusted_close > 0 AND p.adjusted_close IS NOT NULL),
    numbered_filings AS (
        SELECT symbol, date AS quarter_date,
               CAST(filing_date AS DATE) AS as_of_filing_date, gic_sector,
               is_totalRevenue, is_netIncome, is_ebitda,
               cf_freeCashFlow,
               bs_totalStockholderEquity, bs_cash,
               COALESCE(bs_longTermDebt, 0.0) AS bs_longTermDebt,
               COALESCE(bs_shortTermDebt, 0.0) AS bs_shortTermDebt,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS q_rank
        FROM {FUND_TABLE}
        WHERE CAST(filing_date AS DATE) <= DATE '{md_str}'
          AND CAST(filing_date AS DATE) >= DATE '{md_str}' - INTERVAL '{STALENESS_DAYS} days'{universe_filter}),
    ttm AS (
        SELECT symbol,
            MAX(CASE WHEN q_rank=1 THEN as_of_filing_date END) AS as_of_filing_date,
            MAX(CASE WHEN q_rank=1 THEN gic_sector END) AS gic_sector,
            SUM(is_totalRevenue) AS ttm_revenue,
            SUM(is_netIncome) AS ttm_net_income,
            SUM(is_ebitda) AS ttm_ebitda,
            SUM(cf_freeCashFlow) AS ttm_free_cashflow,
            MAX(CASE WHEN q_rank=1 THEN bs_totalStockholderEquity END) AS mrq_equity,
            MAX(CASE WHEN q_rank=1 THEN bs_cash END) AS mrq_cash,
            MAX(CASE WHEN q_rank=1 THEN bs_longTermDebt END) AS mrq_lt_debt,
            MAX(CASE WHEN q_rank=1 THEN bs_shortTermDebt END) AS mrq_st_debt,
            COUNT(*) AS quarters_available
        FROM numbered_filings WHERE q_rank <= 4
        GROUP BY symbol HAVING COUNT(*) >= 2),
    ratios AS (
        SELECT t.symbol, DATE '{md_str}' AS month_date,
            t.as_of_filing_date, COALESCE(t.gic_sector, p.gics_sector) AS gic_sector,
            p.market_cap,
            p.market_cap + t.mrq_lt_debt + t.mrq_st_debt - COALESCE(t.mrq_cash, 0.0) AS enterprise_value,
            CASE WHEN t.ttm_net_income > 0 THEN p.market_cap / t.ttm_net_income END AS pe_ttm,
            CASE WHEN t.ttm_free_cashflow > 0 THEN p.market_cap / t.ttm_free_cashflow END AS pfcf_ttm,
            CASE WHEN t.ttm_ebitda > 0
                 AND (p.market_cap + t.mrq_lt_debt + t.mrq_st_debt - COALESCE(t.mrq_cash, 0.0)) > 0
                 THEN (p.market_cap + t.mrq_lt_debt + t.mrq_st_debt - COALESCE(t.mrq_cash, 0.0)) / t.ttm_ebitda END AS ev_ebitda_ttm,
            CASE WHEN t.ttm_revenue > 0 THEN p.market_cap / t.ttm_revenue END AS ps_ttm,
            CASE WHEN t.mrq_equity > 0 THEN p.market_cap / t.mrq_equity END AS pb_mrq
        FROM ttm t JOIN prices p ON p.symbol = t.symbol WHERE p.market_cap > 0)
    SELECT symbol, month_date, as_of_filing_date, gic_sector, market_cap, enterprise_value,
           pe_ttm, pfcf_ttm, ev_ebitda_ttm, ps_ttm, pb_mrq FROM ratios ORDER BY symbol"""


# ---------------------------------------------------------------------------
# GENERIC SCORE RUNNER (shared by all 4 scores)
# ---------------------------------------------------------------------------
def run_score_loop(mdc, score_name, table_name, create_sql, build_sql_fn,
                   metric_cols, weights, asc_flags, output_cols_fn,
                   month_dates, history, dry_run=False, preprocess_fn=None):
    """
    Generic loop: for each month -> query SQL -> 3-way score -> write to MotherDuck.

    Parameters:
        mdc:            MotherDuckConnection
        score_name:     e.g. 'value', 'quality'
        table_name:     full MotherDuck table name
        create_sql:     CREATE TABLE IF NOT EXISTS statement
        build_sql_fn:   fn(md_str) -> SELECT query returning raw data
        metric_cols:    list of metric column names
        weights:        list of metric weights (sum=1.0)
        asc_flags:      list of booleans (True=higher is better)
        output_cols_fn: fn(df_row) -> dict of extra output columns
        month_dates:    list of date objects to process
        history:        mutable dict for history buffer
        dry_run:        if True, skip writes
        preprocess_fn:  optional fn(df) -> df to transform data before scoring
    """
    total_written = 0
    if not dry_run:
        mdc.execute(create_sql)
        log.info(f'Ensured table {table_name} exists.')

    for i, month_date in enumerate(month_dates):
        md_str = month_date.strftime('%Y-%m-%d')
        t0 = time.time()

        # Determine investable universe filter for this scoring month.
        # Returns SQL IN subquery for months >= 2003-07-01, empty string otherwise.
        universe_filter = get_universe_filter(md_str)
        if universe_filter:
            log.debug(f'{score_name} {md_str}: Applying investable universe filter.')

        try:
            df = mdc.fetchdf(build_sql_fn(md_str, universe_filter))
        except Exception as e:
            log.error(f'{score_name} {md_str}: SQL failed: {e}')
            continue

        if df.empty:
            log.warning(f'{score_name} {md_str}: No data returned.')
            continue

        # Optional preprocessing (e.g. growth signal computation)
        if preprocess_fn:
            df = preprocess_fn(df)
            if df.empty:
                log.warning(f'{score_name} {md_str}: Empty after preprocessing.')
                continue

        df = df.set_index('symbol', drop=False)

        # 3-way scoring
        u_score, metrics_used = compute_universe_score(df, metric_cols, weights, asc_flags)
        s_score = compute_sector_score(df, metric_cols, weights, asc_flags)
        h_score = compute_history_score(df, history, metric_cols, weights, asc_flags)
        c_score, dims_used = compute_composite_score(u_score, s_score, h_score)

        # Update history buffer for next month
        for sym in df['symbol'].unique():
            if sym not in history:
                history[sym] = {c: [] for c in metric_cols}
            for col in metric_cols:
                val = df.loc[sym, col] if sym in df.index else float('nan')
                if isinstance(val, pd.Series):
                    val = val.iloc[0]
                history[sym][col].append(float(val) if not pd.isna(val) else float('nan'))

        # Build output DataFrame
        out_rows = []
        for sym in df['symbol'].unique():
            row = df.loc[sym]
            if isinstance(row, pd.DataFrame):
                row = row.iloc[0]
            out = {
                'symbol': sym,
                'month_date': month_date,
            }
            # Add score-specific output columns
            out.update(output_cols_fn(row))
            # Add score columns
            idx = df.index.get_loc(sym)
            if isinstance(idx, slice):
                idx = idx.start
            out[f'{score_name}_score_universe'] = float(u_score.iloc[idx]) if not pd.isna(u_score.iloc[idx]) else None
            out[f'{score_name}_score_sector'] = float(s_score.iloc[idx]) if not pd.isna(s_score.iloc[idx]) else None
            out[f'{score_name}_score_history'] = float(h_score.iloc[idx]) if not pd.isna(h_score.iloc[idx]) else None
            out[f'{score_name}_score_composite'] = float(c_score.iloc[idx]) if not pd.isna(c_score.iloc[idx]) else None
            out['metrics_used'] = int(metrics_used.iloc[idx]) if not pd.isna(metrics_used.iloc[idx]) else 0
            out['dimensions_used'] = int(dims_used.iloc[idx]) if not pd.isna(dims_used.iloc[idx]) else 0
            out_rows.append(out)

        out_df = pd.DataFrame(out_rows)
        elapsed = time.time() - t0
        log.info(f'{score_name} {md_str}: {len(out_df)} symbols scored in {elapsed:.1f}s')

        if dry_run:
            # Show sample in dry run
            sample = out_df.head(5)
            for _, r in sample.iterrows():
                comp = r.get(f'{score_name}_score_composite', None)
                log.info(f'  {r["symbol"]}: composite={comp}')
            continue

        # Write to MotherDuck via INSERT
        if out_df.empty:
            continue
        try:
            # Delete existing rows for this month (idempotent)
            mdc.execute(f"DELETE FROM {table_name} WHERE month_date = ?", [month_date])
            # Register df and INSERT
            mdc.con.register('__score_batch', out_df)
            col_list = ', '.join(out_df.columns.tolist())
            mdc.execute(f'INSERT INTO {table_name} ({col_list}) SELECT {col_list} FROM __score_batch')
            mdc.con.unregister('__score_batch')
            total_written += len(out_df)
            update_progress(mdc, score_name, month_date, total_written)
        except Exception as e:
            log.error(f'{score_name} {md_str}: Write failed: {e}')
            try:
                mdc.con.unregister('__score_batch')
            except Exception:
                pass
            continue

    log.info(f'{score_name}: COMPLETE. {total_written} total rows written across {len(month_dates)} months.')
    return total_written



# ---------------------------------------------------------------------------
# VALUE SCORE - output columns function + runner wrapper
# ---------------------------------------------------------------------------
def value_output_cols(row):
    return {
        'as_of_filing_date': row.get('as_of_filing_date'),
        'gic_sector': row.get('gic_sector'),
        'pe_ttm': row.get('pe_ttm'),
        'pfcf_ttm': row.get('pfcf_ttm'),
        'ev_ebitda_ttm': row.get('ev_ebitda_ttm'),
        'ps_ttm': row.get('ps_ttm'),
        'pb_mrq': row.get('pb_mrq'),
        'market_cap': row.get('market_cap'),
        'enterprise_value': row.get('enterprise_value'),
    }


def run_value_score(mdc, month_dates, history, dry_run=False):
    return run_score_loop(
        mdc, 'value', VALUE_TABLE, CREATE_VALUE_SQL, build_value_sql,
        VALUE_COLS, VALUE_WTS, VALUE_ASC, value_output_cols,
        month_dates, history, dry_run)


# ---------------------------------------------------------------------------
# QUALITY SCORE - 7 metrics (all ascending=True, higher=better)
# GPA: Gross Profit / Total Assets (NULL for Financials)
# ROIC: Op Income / (Equity + LT Debt)
# ROA: Net Income / Total Assets
# FCF Margin: FCF / Revenue
# Gross Margin: Gross Profit / Revenue
# Operating Margin: Op Income / Revenue
# Earnings Quality: MIN(OCF/NI, 5.0) - NULL if NI<=0
# ---------------------------------------------------------------------------
QUALITY_METRICS = [
    ("gpa", 0.20, True),
    ("roic", 0.20, True),
    ("roa", 0.15, True),
    ("fcf_margin", 0.15, True),
    ("gross_margin", 0.10, True),
    ("op_margin", 0.10, True),
    ("earnings_quality", 0.10, True),
]
QUALITY_COLS = [m[0] for m in QUALITY_METRICS]
QUALITY_WTS = [m[1] for m in QUALITY_METRICS]
QUALITY_ASC = [m[2] for m in QUALITY_METRICS]
QUALITY_TABLE = f"{SCORE_SCHEMA}.PROD_OBQ_Quality_Scores"
CREATE_QUALITY_SQL = f"""CREATE TABLE IF NOT EXISTS {QUALITY_TABLE} (
    symbol VARCHAR NOT NULL, month_date DATE NOT NULL,
    as_of_filing_date DATE, gic_sector VARCHAR,
    gpa DOUBLE, roic DOUBLE, roa DOUBLE, fcf_margin DOUBLE,
    gross_margin DOUBLE, op_margin DOUBLE, earnings_quality DOUBLE,
    quality_score_universe DOUBLE, quality_score_sector DOUBLE,
    quality_score_history DOUBLE, quality_score_composite DOUBLE,
    metrics_used TINYINT, dimensions_used TINYINT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, month_date))"""


def build_quality_sql(md_str, universe_filter=""):
    """
    Build SQL query for Quality score raw data.

    universe_filter: SQL fragment from get_universe_filter() applied to numbered_filings
                     to restrict to investable universe stocks for this scoring month.
    """
    return f"""
    WITH numbered_filings AS (
        SELECT symbol, date AS quarter_date,
               CAST(filing_date AS DATE) AS as_of_filing_date, gic_sector,
               is_totalRevenue, is_netIncome, is_grossProfit, is_operatingIncome,
               cf_totalCashFromOperatingActivities, cf_freeCashFlow,
               bs_totalAssets, bs_totalStockholderEquity,
               COALESCE(bs_longTermDebt, 0.0) AS bs_longTermDebt,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS q_rank
        FROM {FUND_TABLE}
        WHERE CAST(filing_date AS DATE) <= DATE '{md_str}'
          AND CAST(filing_date AS DATE) >= DATE '{md_str}' - INTERVAL '{STALENESS_DAYS} days'{universe_filter}),
    ttm AS (
        SELECT symbol,
            MAX(CASE WHEN q_rank=1 THEN as_of_filing_date END) AS as_of_filing_date,
            MAX(CASE WHEN q_rank=1 THEN gic_sector END) AS gic_sector,
            SUM(is_totalRevenue) AS ttm_revenue,
            SUM(is_netIncome) AS ttm_net_income,
            SUM(is_grossProfit) AS ttm_gross_profit,
            SUM(is_operatingIncome) AS ttm_op_income,
            SUM(cf_totalCashFromOperatingActivities) AS ttm_ocf,
            SUM(cf_freeCashFlow) AS ttm_fcf,
            MAX(CASE WHEN q_rank=1 THEN bs_totalAssets END) AS mrq_total_assets,
            MAX(CASE WHEN q_rank=1 THEN bs_totalStockholderEquity END) AS mrq_equity,
            MAX(CASE WHEN q_rank=1 THEN bs_longTermDebt END) AS mrq_lt_debt,
            COUNT(*) AS quarters_available
        FROM numbered_filings WHERE q_rank <= 4
        GROUP BY symbol HAVING COUNT(*) >= 2),
    ratios AS (
        SELECT symbol, DATE '{md_str}' AS month_date,
            as_of_filing_date, gic_sector,
            CASE WHEN gic_sector NOT LIKE '%Financial%' AND mrq_total_assets > 0 AND ttm_gross_profit IS NOT NULL
                 THEN ttm_gross_profit / mrq_total_assets END AS gpa,
            CASE WHEN (mrq_equity + mrq_lt_debt) > 0
                 THEN ttm_op_income / (mrq_equity + mrq_lt_debt) END AS roic,
            CASE WHEN mrq_total_assets > 0
                 THEN ttm_net_income / mrq_total_assets END AS roa,
            CASE WHEN ttm_revenue > 0
                 THEN ttm_fcf / ttm_revenue END AS fcf_margin,
            CASE WHEN ttm_revenue > 0 AND ttm_gross_profit IS NOT NULL
                 THEN ttm_gross_profit / ttm_revenue END AS gross_margin,
            CASE WHEN ttm_revenue > 0
                 THEN ttm_op_income / ttm_revenue END AS op_margin,
            CASE WHEN ttm_net_income > 0 AND ttm_ocf IS NOT NULL
                 THEN LEAST(ttm_ocf / ttm_net_income, 5.0) END AS earnings_quality
        FROM ttm WHERE mrq_total_assets > 0)
    SELECT symbol, month_date, as_of_filing_date, gic_sector,
           gpa, roic, roa, fcf_margin, gross_margin, op_margin, earnings_quality
    FROM ratios ORDER BY symbol"""


def quality_output_cols(row):
    return {
        'as_of_filing_date': row.get('as_of_filing_date'),
        'gic_sector': row.get('gic_sector'),
        'gpa': row.get('gpa'),
        'roic': row.get('roic'),
        'roa': row.get('roa'),
        'fcf_margin': row.get('fcf_margin'),
        'gross_margin': row.get('gross_margin'),
        'op_margin': row.get('op_margin'),
        'earnings_quality': row.get('earnings_quality'),
    }


def run_quality_score(mdc, month_dates, history, dry_run=False):
    return run_score_loop(
        mdc, 'quality', QUALITY_TABLE, CREATE_QUALITY_SQL, build_quality_sql,
        QUALITY_COLS, QUALITY_WTS, QUALITY_ASC, quality_output_cols,
        month_dates, history, dry_run)


# ---------------------------------------------------------------------------
# FINANCIAL STRENGTH SCORE - 6 metrics (mixed ascending)
# Interest Coverage: EBITDA/Interest Expense (ascending=True, higher=better)
# FCF/Debt: FCF / Total Debt (ascending=True, higher=better)
# NetDebt/EBITDA: (ascending=False, lower=better)
# Debt/Assets: (ascending=False, lower=better)
# Cash/Assets: (ascending=True, higher=better)
# WC/Assets: Working Capital / Assets (ascending=True, higher=better)
# Debt-free companies get sentinel high values for debt metrics
# ---------------------------------------------------------------------------
FINSTR_METRICS = [
    ('interest_coverage', 1.0/6.0, True),
    ('fcf_debt', 1.0/6.0, True),
    ('net_debt_ebitda', 1.0/6.0, False),
    ('debt_assets', 1.0/6.0, False),
    ('cash_assets', 1.0/6.0, True),
    ('wc_assets', 1.0/6.0, True),
]
FINSTR_COLS = [m[0] for m in FINSTR_METRICS]
FINSTR_WTS = [m[1] for m in FINSTR_METRICS]
FINSTR_ASC = [m[2] for m in FINSTR_METRICS]
FINSTR_TABLE = f'{SCORE_SCHEMA}.PROD_OBQ_FinStr_Scores'
CREATE_FINSTR_SQL = f"""CREATE TABLE IF NOT EXISTS {FINSTR_TABLE} (
    symbol VARCHAR NOT NULL, month_date DATE NOT NULL,
    as_of_filing_date DATE, gic_sector VARCHAR,
    interest_coverage DOUBLE, fcf_debt DOUBLE,
    net_debt_ebitda DOUBLE, debt_assets DOUBLE,
    cash_assets DOUBLE, wc_assets DOUBLE,
    finstr_score_universe DOUBLE, finstr_score_sector DOUBLE,
    finstr_score_history DOUBLE, finstr_score_composite DOUBLE,
    metrics_used TINYINT, dimensions_used TINYINT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, month_date))"""


def build_finstr_sql(md_str, universe_filter=""):
    """
    Build SQL query for Financial Strength score raw data.

    universe_filter: SQL fragment from get_universe_filter() applied to numbered_filings
                     to restrict to investable universe stocks for this scoring month.
    """
    return f"""
    WITH numbered_filings AS (
        SELECT symbol, date AS quarter_date,
               CAST(filing_date AS DATE) AS as_of_filing_date, gic_sector,
               is_ebitda, is_interestExpense,
               cf_freeCashFlow,
               bs_totalAssets,
               COALESCE(bs_longTermDebt, 0.0) AS bs_longTermDebt,
               COALESCE(bs_shortTermDebt, 0.0) AS bs_shortTermDebt,
               bs_cash, bs_netDebt, bs_netWorkingCapital,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS q_rank
        FROM {FUND_TABLE}
        WHERE CAST(filing_date AS DATE) <= DATE '{md_str}'
          AND CAST(filing_date AS DATE) >= DATE '{md_str}' - INTERVAL '{STALENESS_DAYS} days'{universe_filter}),
    ttm AS (
        SELECT symbol,
            MAX(CASE WHEN q_rank=1 THEN as_of_filing_date END) AS as_of_filing_date,
            MAX(CASE WHEN q_rank=1 THEN gic_sector END) AS gic_sector,
            SUM(is_ebitda) AS ttm_ebitda,
            SUM(is_interestExpense) AS ttm_interest,
            SUM(cf_freeCashFlow) AS ttm_fcf,
            MAX(CASE WHEN q_rank=1 THEN bs_totalAssets END) AS mrq_total_assets,
            MAX(CASE WHEN q_rank=1 THEN bs_longTermDebt END) AS mrq_lt_debt,
            MAX(CASE WHEN q_rank=1 THEN bs_shortTermDebt END) AS mrq_st_debt,
            MAX(CASE WHEN q_rank=1 THEN bs_cash END) AS mrq_cash,
            MAX(CASE WHEN q_rank=1 THEN bs_netDebt END) AS mrq_net_debt,
            MAX(CASE WHEN q_rank=1 THEN bs_netWorkingCapital END) AS mrq_wc,
            COUNT(*) AS quarters_available
        FROM numbered_filings WHERE q_rank <= 4
        GROUP BY symbol HAVING COUNT(*) >= 2),
    ratios AS (
        SELECT symbol, DATE '{md_str}' AS month_date,
            as_of_filing_date, gic_sector,
            -- Interest Coverage: EBITDA / Interest Expense (sentinel 50 for no interest)
            CASE WHEN ttm_interest IS NULL OR ttm_interest = 0 THEN 50.0
                 WHEN ttm_interest > 0 AND ttm_ebitda IS NOT NULL
                 THEN LEAST(GREATEST(ttm_ebitda / ttm_interest, -10.0), 50.0)
                 END AS interest_coverage,
            -- FCF/Debt: FCF / Total Debt (sentinel 2.0 for no debt)
            CASE WHEN (mrq_lt_debt + mrq_st_debt) = 0 THEN 2.0
                 WHEN (mrq_lt_debt + mrq_st_debt) > 0 AND ttm_fcf IS NOT NULL
                 THEN LEAST(GREATEST(ttm_fcf / (mrq_lt_debt + mrq_st_debt), -2.0), 2.0)
                 END AS fcf_debt,
            -- NetDebt/EBITDA (lower=better; sentinel -1.0 for net-cash)
            CASE WHEN mrq_net_debt IS NOT NULL AND mrq_net_debt < 0 THEN -1.0
                 WHEN ttm_ebitda IS NOT NULL AND ttm_ebitda > 0 AND mrq_net_debt IS NOT NULL
                 THEN LEAST(GREATEST(mrq_net_debt / ttm_ebitda, -5.0), 20.0)
                 END AS net_debt_ebitda,
            -- Debt/Assets (lower=better)
            CASE WHEN mrq_total_assets > 0
                 THEN (mrq_lt_debt + mrq_st_debt) / mrq_total_assets END AS debt_assets,
            -- Cash/Assets (higher=better)
            CASE WHEN mrq_total_assets > 0 AND mrq_cash IS NOT NULL
                 THEN mrq_cash / mrq_total_assets END AS cash_assets,
            -- Working Capital / Assets (higher=better)
            CASE WHEN mrq_total_assets > 0 AND mrq_wc IS NOT NULL
                 THEN mrq_wc / mrq_total_assets END AS wc_assets
        FROM ttm WHERE mrq_total_assets > 0)
    SELECT symbol, month_date, as_of_filing_date, gic_sector,
           interest_coverage, fcf_debt, net_debt_ebitda, debt_assets, cash_assets, wc_assets
    FROM ratios ORDER BY symbol"""


def finstr_output_cols(row):
    return {
        'as_of_filing_date': row.get('as_of_filing_date'),
        'gic_sector': row.get('gic_sector'),
        'interest_coverage': row.get('interest_coverage'),
        'fcf_debt': row.get('fcf_debt'),
        'net_debt_ebitda': row.get('net_debt_ebitda'),
        'debt_assets': row.get('debt_assets'),
        'cash_assets': row.get('cash_assets'),
        'wc_assets': row.get('wc_assets'),
    }


def run_finstr_score(mdc, month_dates, history, dry_run=False):
    return run_score_loop(
        mdc, 'finstr', FINSTR_TABLE, CREATE_FINSTR_SQL, build_finstr_sql,
        FINSTR_COLS, FINSTR_WTS, FINSTR_ASC, finstr_output_cols,
        month_dates, history, dry_run)


# ---------------------------------------------------------------------------
# GROWTH SCORE v3 - 4 metrics x 3 periods, period-weighted composites
# Revenue/Share Growth (25%), EPS Growth (25%), FCF/Share Growth (25%),
# Equity/Share Growth (25%)
# Period weights: 1Y(40%) + 3Y(35%) + 5Y(25%)
# Sentinel: +2.01 (turnaround), -2.01 (deterioration)
# ---------------------------------------------------------------------------
GROWTH_METRICS = [
    ('revenue_ps_growth', 0.25, True),
    ('eps_growth', 0.25, True),
    ('fcf_ps_growth', 0.25, True),
    ('equity_ps_growth', 0.25, True),
]
GROWTH_COLS = [m[0] for m in GROWTH_METRICS]
GROWTH_WTS = [m[1] for m in GROWTH_METRICS]
GROWTH_ASC = [m[2] for m in GROWTH_METRICS]
GROWTH_TABLE = f'{SCORE_SCHEMA}.PROD_OBQ_Growth_Scores'

PERIOD_WEIGHTS = {'1Y': 0.40, '3Y': 0.35, '5Y': 0.25}
POSITIVE_SENTINEL = 2.01
NEGATIVE_SENTINEL = -2.01
WINSORIZE_LIMIT = 2.0

GROWTH_PERIOD_COLS = [
    'revenue_ps_cagr_1y', 'revenue_ps_cagr_3y', 'revenue_ps_cagr_5y',
    'eps_cagr_1y', 'eps_cagr_3y', 'eps_cagr_5y',
    'fcf_ps_cagr_1y', 'fcf_ps_cagr_3y', 'fcf_ps_cagr_5y',
    'equity_ps_cagr_1y', 'equity_ps_cagr_3y', 'equity_ps_cagr_5y',
]
CREATE_GROWTH_SQL = f"""CREATE TABLE IF NOT EXISTS {GROWTH_TABLE} (
    symbol VARCHAR NOT NULL, month_date DATE NOT NULL,
    as_of_filing_date DATE, gic_sector VARCHAR,
    revenue_ps_cagr_1y DOUBLE, revenue_ps_cagr_3y DOUBLE, revenue_ps_cagr_5y DOUBLE,
    eps_cagr_1y DOUBLE, eps_cagr_3y DOUBLE, eps_cagr_5y DOUBLE,
    fcf_ps_cagr_1y DOUBLE, fcf_ps_cagr_3y DOUBLE, fcf_ps_cagr_5y DOUBLE,
    equity_ps_cagr_1y DOUBLE, equity_ps_cagr_3y DOUBLE, equity_ps_cagr_5y DOUBLE,
    revenue_ps_growth DOUBLE, eps_growth DOUBLE,
    fcf_ps_growth DOUBLE, equity_ps_growth DOUBLE,
    growth_score_universe DOUBLE, growth_score_sector DOUBLE,
    growth_score_history DOUBLE, growth_score_composite DOUBLE,
    metrics_used TINYINT, dimensions_used TINYINT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, month_date))"""


def safe_cagr(prior, current, years):
    """4-case negative-value CAGR. Returns clamped float in [-2.01, +2.01] or None."""
    if prior is None or current is None:
        return None
    if isinstance(prior, float) and np.isnan(prior):
        return None
    if isinstance(current, float) and np.isnan(current):
        return None
    if prior > 0 and current > 0:
        raw = (current / prior) ** (1.0 / years) - 1.0
        return max(-WINSORIZE_LIMIT, min(WINSORIZE_LIMIT, raw))
    elif prior <= 0 and current > 0:
        return POSITIVE_SENTINEL
    elif prior > 0 and current <= 0:
        return NEGATIVE_SENTINEL
    else:
        return None  # Both <= 0, no signal


def compute_metric_periods(row, cur_col, p1y_col, p3y_col, p5y_col):
    """Compute 1Y, 3Y, 5Y CAGRs for one metric. Returns dict with period keys."""
    cur = row.get(cur_col)
    if cur is None or (isinstance(cur, float) and np.isnan(cur)):
        return {}
    results = {}
    for period_key, col, years in [('1Y', p1y_col, 1.0), ('3Y', p3y_col, 3.0), ('5Y', p5y_col, 5.0)]:
        v = row.get(col)
        if v is not None and not (isinstance(v, float) and np.isnan(v)):
            g = safe_cagr(v, cur, years)
            if g is not None:
                results[period_key] = g
    return results


def weighted_composite_from_periods(periods):
    """Combine period CAGRs into one period-weighted composite. Requires 1Y."""
    if '1Y' not in periods:
        return None
    total_w = sum(PERIOD_WEIGHTS[p] for p in periods)
    return sum(periods[p] * PERIOD_WEIGHTS[p] / total_w for p in periods)


def build_growth_signals(df):
    """Preprocess fn: compute 12 period CAGRs + 4 weighted composites from raw SQL data."""
    rows = df.to_dict('records')
    out_rows = []
    for r in rows:
        rev_periods = compute_metric_periods(
            r, 'cur_rev_ps', 'rev_ps_1y', 'rev_ps_3y', 'rev_ps_5y')
        eps_periods = compute_metric_periods(
            r, 'cur_eps_ps', 'eps_ps_1y', 'eps_ps_3y', 'eps_ps_5y')
        fcf_periods = compute_metric_periods(
            r, 'cur_fcf_ps', 'fcf_ps_1y', 'fcf_ps_3y', 'fcf_ps_5y')
        eq_periods = compute_metric_periods(
            r, 'cur_equity_ps', 'equity_ps_1y', 'equity_ps_3y', 'equity_ps_5y')
        out_rows.append({
            'symbol': r['symbol'],
            'month_date': r['month_date'],
            'as_of_filing_date': r['as_of_filing_date'],
            'gic_sector': r['gic_sector'],
            'revenue_ps_cagr_1y': rev_periods.get('1Y'),
            'revenue_ps_cagr_3y': rev_periods.get('3Y'),
            'revenue_ps_cagr_5y': rev_periods.get('5Y'),
            'eps_cagr_1y': eps_periods.get('1Y'),
            'eps_cagr_3y': eps_periods.get('3Y'),
            'eps_cagr_5y': eps_periods.get('5Y'),
            'fcf_ps_cagr_1y': fcf_periods.get('1Y'),
            'fcf_ps_cagr_3y': fcf_periods.get('3Y'),
            'fcf_ps_cagr_5y': fcf_periods.get('5Y'),
            'equity_ps_cagr_1y': eq_periods.get('1Y'),
            'equity_ps_cagr_3y': eq_periods.get('3Y'),
            'equity_ps_cagr_5y': eq_periods.get('5Y'),
            'revenue_ps_growth': weighted_composite_from_periods(rev_periods),
            'eps_growth': weighted_composite_from_periods(eps_periods),
            'fcf_ps_growth': weighted_composite_from_periods(fcf_periods),
            'equity_ps_growth': weighted_composite_from_periods(eq_periods),
        })
    return pd.DataFrame(out_rows)


def build_growth_sql(md_str, universe_filter=""):
    """
    Build SQL query for Growth score raw data.

    universe_filter: SQL fragment from get_universe_filter() applied to all 4 filing
                     CTEs (numbered_filings, prior_1y_filings, prior_3y_filings,
                     prior_5y_filings) to restrict to investable universe stocks.
                     Applied at each CTE for maximum query efficiency.
    """
    return f"""
    WITH numbered_filings AS (
        SELECT symbol, date AS quarter_date,
               CAST(filing_date AS DATE) AS as_of_filing_date, gic_sector,
               is_totalRevenue, is_netIncome, cf_freeCashFlow,
               bs_totalStockholderEquity,
               bs_commonStockSharesOutstanding AS shares_out,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS q_rank
        FROM {FUND_TABLE}
        WHERE CAST(filing_date AS DATE) <= DATE '{md_str}'
          AND CAST(filing_date AS DATE) >= DATE '{md_str}' - INTERVAL '{STALENESS_DAYS} days'
          AND bs_commonStockSharesOutstanding IS NOT NULL
          AND bs_commonStockSharesOutstanding > 0{universe_filter}),
    cur_ttm AS (
        SELECT symbol,
            MAX(CASE WHEN q_rank=1 THEN as_of_filing_date END) AS as_of_filing_date,
            MAX(CASE WHEN q_rank=1 THEN gic_sector END) AS gic_sector,
            SUM(is_totalRevenue) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS cur_rev_ps,
            SUM(is_netIncome) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS cur_eps_ps,
            SUM(cf_freeCashFlow) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS cur_fcf_ps,
            MAX(CASE WHEN q_rank=1 THEN bs_totalStockholderEquity END)
                / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS cur_equity_ps
        FROM numbered_filings WHERE q_rank <= 4
        GROUP BY symbol HAVING COUNT(*) >= 2),
    -- 1-year prior TTM (filings from ~15 to ~9 months before the current rebalance)
    prior_1y_filings AS (
        SELECT symbol, date AS quarter_date,
               is_totalRevenue, is_netIncome, cf_freeCashFlow,
               bs_totalStockholderEquity, bs_commonStockSharesOutstanding AS shares_out,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS q_rank
        FROM {FUND_TABLE}
        WHERE CAST(filing_date AS DATE) <= DATE '{md_str}' - INTERVAL '9 months'
          AND CAST(filing_date AS DATE) >= DATE '{md_str}' - INTERVAL '27 months'
          AND bs_commonStockSharesOutstanding IS NOT NULL
          AND bs_commonStockSharesOutstanding > 0{universe_filter}),
    p1y AS (
        SELECT symbol,
            SUM(is_totalRevenue) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS rev_ps_1y,
            SUM(is_netIncome) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS eps_ps_1y,
            SUM(cf_freeCashFlow) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS fcf_ps_1y,
            MAX(CASE WHEN q_rank=1 THEN bs_totalStockholderEquity END)
                / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS equity_ps_1y
        FROM prior_1y_filings WHERE q_rank <= 4
        GROUP BY symbol HAVING COUNT(*) >= 2),
    -- 3-year prior TTM (filings from ~39 to ~33 months before)
    prior_3y_filings AS (
        SELECT symbol, date AS quarter_date,
               is_totalRevenue, is_netIncome, cf_freeCashFlow,
               bs_totalStockholderEquity, bs_commonStockSharesOutstanding AS shares_out,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS q_rank
        FROM {FUND_TABLE}
        WHERE CAST(filing_date AS DATE) <= DATE '{md_str}' - INTERVAL '33 months'
          AND CAST(filing_date AS DATE) >= DATE '{md_str}' - INTERVAL '51 months'
          AND bs_commonStockSharesOutstanding IS NOT NULL
          AND bs_commonStockSharesOutstanding > 0{universe_filter}),
    p3y AS (
        SELECT symbol,
            SUM(is_totalRevenue) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS rev_ps_3y,
            SUM(is_netIncome) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS eps_ps_3y,
            SUM(cf_freeCashFlow) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS fcf_ps_3y,
            MAX(CASE WHEN q_rank=1 THEN bs_totalStockholderEquity END)
                / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS equity_ps_3y
        FROM prior_3y_filings WHERE q_rank <= 4
        GROUP BY symbol HAVING COUNT(*) >= 2),
    -- 5-year prior TTM (filings from ~63 to ~57 months before)
    prior_5y_filings AS (
        SELECT symbol, date AS quarter_date,
               is_totalRevenue, is_netIncome, cf_freeCashFlow,
               bs_totalStockholderEquity, bs_commonStockSharesOutstanding AS shares_out,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS q_rank
        FROM {FUND_TABLE}
        WHERE CAST(filing_date AS DATE) <= DATE '{md_str}' - INTERVAL '57 months'
          AND CAST(filing_date AS DATE) >= DATE '{md_str}' - INTERVAL '75 months'
          AND bs_commonStockSharesOutstanding IS NOT NULL
          AND bs_commonStockSharesOutstanding > 0{universe_filter}),
    p5y AS (
        SELECT symbol,
            SUM(is_totalRevenue) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS rev_ps_5y,
            SUM(is_netIncome) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS eps_ps_5y,
            SUM(cf_freeCashFlow) / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS fcf_ps_5y,
            MAX(CASE WHEN q_rank=1 THEN bs_totalStockholderEquity END)
                / MAX(CASE WHEN q_rank=1 THEN shares_out END) AS equity_ps_5y
        FROM prior_5y_filings WHERE q_rank <= 4
        GROUP BY symbol HAVING COUNT(*) >= 2)
    SELECT c.symbol, DATE '{md_str}' AS month_date,
           c.as_of_filing_date, c.gic_sector,
           c.cur_rev_ps, c.cur_eps_ps, c.cur_fcf_ps, c.cur_equity_ps,
           p1y.rev_ps_1y, p1y.eps_ps_1y, p1y.fcf_ps_1y, p1y.equity_ps_1y,
           p3y.rev_ps_3y, p3y.eps_ps_3y, p3y.fcf_ps_3y, p3y.equity_ps_3y,
           p5y.rev_ps_5y, p5y.eps_ps_5y, p5y.fcf_ps_5y, p5y.equity_ps_5y
    FROM cur_ttm c
    LEFT JOIN p1y ON p1y.symbol = c.symbol
    LEFT JOIN p3y ON p3y.symbol = c.symbol
    LEFT JOIN p5y ON p5y.symbol = c.symbol
    ORDER BY c.symbol"""


def growth_output_cols(row):
    return {
        'as_of_filing_date': row.get('as_of_filing_date'),
        'gic_sector': row.get('gic_sector'),
        'revenue_ps_cagr_1y': row.get('revenue_ps_cagr_1y'),
        'revenue_ps_cagr_3y': row.get('revenue_ps_cagr_3y'),
        'revenue_ps_cagr_5y': row.get('revenue_ps_cagr_5y'),
        'eps_cagr_1y': row.get('eps_cagr_1y'),
        'eps_cagr_3y': row.get('eps_cagr_3y'),
        'eps_cagr_5y': row.get('eps_cagr_5y'),
        'fcf_ps_cagr_1y': row.get('fcf_ps_cagr_1y'),
        'fcf_ps_cagr_3y': row.get('fcf_ps_cagr_3y'),
        'fcf_ps_cagr_5y': row.get('fcf_ps_cagr_5y'),
        'equity_ps_cagr_1y': row.get('equity_ps_cagr_1y'),
        'equity_ps_cagr_3y': row.get('equity_ps_cagr_3y'),
        'equity_ps_cagr_5y': row.get('equity_ps_cagr_5y'),
        'revenue_ps_growth': row.get('revenue_ps_growth'),
        'eps_growth': row.get('eps_growth'),
        'fcf_ps_growth': row.get('fcf_ps_growth'),
        'equity_ps_growth': row.get('equity_ps_growth'),
    }


def run_growth_score(mdc, month_dates, history, dry_run=False):
    return run_score_loop(
        mdc, 'growth', GROWTH_TABLE, CREATE_GROWTH_SQL, build_growth_sql,
        GROWTH_COLS, GROWTH_WTS, GROWTH_ASC, growth_output_cols,
        month_dates, history, dry_run, preprocess_fn=build_growth_signals)


# ---------------------------------------------------------------------------
# SCORE REGISTRY & MAIN
# ---------------------------------------------------------------------------
SCORE_RUNNERS = {
    'value':   (run_value_score,   CREATE_VALUE_SQL,   VALUE_TABLE,   VALUE_COLS),
    'quality': (run_quality_score,  CREATE_QUALITY_SQL, QUALITY_TABLE, QUALITY_COLS),
    'finstr':  (run_finstr_score,   CREATE_FINSTR_SQL,  FINSTR_TABLE,  FINSTR_COLS),
    'growth':  (run_growth_score,   CREATE_GROWTH_SQL,  GROWTH_TABLE,  GROWTH_COLS),
}


def preload_history(mdc, table_name, metric_cols, start_date):
    """Pre-load historical data for history scoring dimension."""
    history = {}
    try:
        # Load all rows before start_date for history buffer
        hist_df = mdc.fetchdf(
            f"SELECT symbol, {', '.join(metric_cols)} FROM {table_name} "
            f"WHERE month_date < '{start_date.strftime('%Y-%m-%d')}' "
            f"ORDER BY month_date ASC")
        for _, row in hist_df.iterrows():
            sym = row['symbol']
            if sym not in history:
                history[sym] = {c: [] for c in metric_cols}
            for col in metric_cols:
                val = row[col]
                history[sym][col].append(float(val) if not pd.isna(val) else float('nan'))
        log.info(f'Pre-loaded history: {len(history)} symbols, up to {start_date}')
    except Exception as e:
        log.warning(f'No existing history to pre-load: {e}')
    return history


def determine_date_range(mdc, score_name, full_rebuild, start_date_str, resume):
    """Figure out what month range to process."""
    if start_date_str:
        start = date.fromisoformat(start_date_str)
    elif full_rebuild:
        # Start from earliest filing date with reasonable data
        start = date(2010, 1, 1)
    elif resume:
        last = get_last_completed(mdc, score_name)
        if last:
            # Start from month after last completed
            if last.month < 12:
                start = last.replace(month=last.month + 1, day=1)
            else:
                start = last.replace(year=last.year + 1, month=1, day=1)
            log.info(f'{score_name}: Resuming from {start} (last completed: {last})')
        else:
            log.info(f'{score_name}: No progress found. Starting full rebuild from 2010.')
            start = date(2010, 1, 1)
    else:
        start = date(2010, 1, 1)

    end = date.today().replace(day=1) - timedelta(days=1)  # Last day of previous month
    return start, end


def main():
    parser = argparse.ArgumentParser(description='OBQ Score Recalculation')
    parser.add_argument('--score', required=True,
        choices=['value', 'quality', 'finstr', 'growth', 'all'],
        help='Which score to recalculate (or all)')
    parser.add_argument('--full-rebuild', action='store_true',
        help='Rebuild from 2010 (drops existing data for this score)')
    parser.add_argument('--start-date', default=None,
        help='Override start date (YYYY-MM-DD)')
    parser.add_argument('--resume', action='store_true',
        help='Resume from last completed month')
    parser.add_argument('--dry-run', action='store_true',
        help='Score but do not write to MotherDuck')
    args = parser.parse_args()

    if not MOTHERDUCK_TOKEN:
        log.error('MOTHERDUCK_TOKEN not found. Check .env file.')
        sys.exit(1)

    mdc = MotherDuckConnection(MOTHERDUCK_TOKEN)
    # Ensure progress table exists
    mdc.execute(CREATE_PROGRESS_SQL)

    scores_to_run = list(SCORE_RUNNERS.keys()) if args.score == 'all' else [args.score]

    grand_total = 0
    for score_name in scores_to_run:
        log.info(f'=== Starting {score_name.upper()} score recalculation ===')
        runner_fn, create_sql, table_name, metric_cols = SCORE_RUNNERS[score_name]

        # Determine date range
        start, end = determine_date_range(
            mdc, score_name, args.full_rebuild, args.start_date, args.resume)
        month_dates = get_month_ends(start, end)
        log.info(f'{score_name}: {len(month_dates)} months to process ({start} to {end})')

        if not month_dates:
            log.info(f'{score_name}: No months to process.')
            continue

        # Full rebuild: drop and recreate
        if args.full_rebuild and not args.dry_run:
            try:
                mdc.execute(f'DROP TABLE IF EXISTS {table_name}')
                log.info(f'Dropped existing table {table_name}')
            except Exception:
                pass

        # Pre-load history buffer if table exists and we are resuming
        if args.resume and not args.full_rebuild:
            history = preload_history(mdc, table_name, metric_cols, start)
        else:
            history = {}

        # Run the score
        rows_written = runner_fn(mdc, month_dates, history, dry_run=args.dry_run)
        grand_total += rows_written
        log.info(f'{score_name}: {rows_written} rows written.')

    log.info(f'=== ALL DONE. Grand total: {grand_total} rows written. ===')
    mdc.close()


if __name__ == '__main__':
    main()
