#!/usr/bin/env python3
"""
OBQ Momentum Score Recalculation
Calculates AF Momentum, FIP Score, and SystemScore for stocks in the
PROD_OBQ_Investable_Universe (top 3000 by market cap, annually reconstituted
in May). For months before 2003-07-01 all available stocks are scored.

Data flow: MotherDuck (SQL CTE) -> Python (3-way scoring) -> MotherDuck (write)
No local files. No temp tables. No OBQ_AI dependency.

Usage:
  python scripts/momentum_score_recalculation.py --full-rebuild
  python scripts/momentum_score_recalculation.py --resume
  python scripts/momentum_score_recalculation.py --dry-run --start-date 2020-01-31
"""

import argparse, logging, sys, time, os
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
import duckdb, numpy as np, pandas as pd
from dotenv import load_dotenv

# Configuration
load_dotenv(os.path.join("C:", os.sep, "Users", "admin", "Desktop", "OBQ_AI", "AI_Hedge_Fund_Local", ".env"))
MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN")
PRICE_TABLE = "PROD_EODHD.main.PROD_EOD_survivorship"
WEEKLY_TABLE = "PROD_EODHD.main.PROD_EOD_survivorship_Weekly"
SCORE_SCHEMA = "PROD_EODHD.main"
MOMENTUM_TABLE = f"{SCORE_SCHEMA}.PROD_OBQ_Momentum_Scores"
# Investable universe: top-3000 by market cap, annually reconstituted in May.
# Momentum scores are restricted to symbols in this table for each scoring month.
UNIVERSE_TABLE = "PROD_EODHD.main.PROD_OBQ_Investable_Universe"
# Universe table starts at the 2003 reconstitution (effective 2003-07-01).
# Months before this date score all available stocks (no filtering).
UNIVERSE_START_DATE = date(2003, 7, 1)
MIN_SECTOR_PEERS = 3
MIN_HISTORY_MONTHS = 8
MIN_SYMBOLS_FOR_MONTH = 100
UNIV_WEIGHT, SECT_WEIGHT, HIST_WEIGHT = 0.40, 0.40, 0.20
MAX_RETRIES, RETRY_DELAY = 3, 5

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("momentum_score_recalc")


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
# SHARED SCORING FUNCTIONS
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

def weighted_composite(row, metric_cols, weights, min_valid=2):
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
    for sector, grp in df.groupby("gics_sector", dropna=True):
        if len(grp) < MIN_SECTOR_PEERS:
            continue
        g = grp.copy()
        for col, asc in zip(metric_cols, asc_flags):
            g[f"rank_{col}"] = percentile_rank(g[col], ascending=asc)
        results = g.apply(lambda r: weighted_composite(r, metric_cols, weights), axis=1)
        out.loc[g.index] = percentile_rank(results.apply(lambda x: x[0]), ascending=True).values
    return out

def compute_history_score(df, history, metric_cols, weights, asc_flags):
    """Rank current value vs own historical distribution (min 8 months)."""
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
            if len(past) < MIN_HISTORY_MONTHS:
                continue
            past_arr = np.array(past)
            rank_val = float(np.mean(past_arr < cur) if asc else np.mean(past_arr > cur)) * 100.0
            ranks.append((rank_val, w))
            total_w += w
            n_valid += 1
        if n_valid >= 2 and total_w > 0:
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
# INVESTABLE UNIVERSE FILTER
# ---------------------------------------------------------------------------
def get_universe_filter(md_str):
    """
    Returns a SQL WHERE clause fragment that restricts scoring to stocks in the
    PROD_OBQ_Investable_Universe table for the given scoring month.

    The universe table holds top-3000 stocks by market cap, reconstituted annually
    in May. Each row has effective_start / effective_end date bounds that define
    which recon year covers a given scoring month.

    For months before UNIVERSE_START_DATE (2003-07-01), returns an empty string
    so all available stocks are scored (backward compatibility for early history).

    For momentum, the filter is applied to the active_symbols CTE where symbols
    have already been stripped of the '.US' suffix via REPLACE(). The universe
    table also stores symbols without '.US', so no additional normalization is
    needed.

    Parameters:
        md_str: date string 'YYYY-MM-DD' representing the scoring month-end

    Returns:
        SQL fragment string (with leading AND) or empty string
    """
    month = date.fromisoformat(md_str)
    if month < UNIVERSE_START_DATE:
        # Universe table does not cover this period -- score all available stocks
        return ""
    # SQL subquery: symbol must be in the active investable universe for this month.
    # Universe table stores symbols WITH '.US' suffix (e.g. 'AAPL.US') but momentum
    # SQL strips the suffix in month_prices CTE, so active_symbols has plain symbols.
    # We strip '.US' in the subquery to match.
    return (
        " AND symbol IN ("
        "SELECT REPLACE(symbol, '.US', '') FROM " + UNIVERSE_TABLE + " "
        "WHERE effective_start <= DATE '" + md_str + "' "
        "AND effective_end >= DATE '" + md_str + "')"
    )


# ---------------------------------------------------------------------------
# SCORE_COMPONENT - 3-way scoring for a single momentum component
# ---------------------------------------------------------------------------
def score_component(raw_values, sector_map, history_dict, prefix):
    """
    Apply 3-way scoring to a single momentum component.
    raw_values: Series (symbol -> raw score)
    sector_map: Series (symbol -> gics_sector)
    history_dict: dict[symbol -> list of past raw values]
    """
    result_cols = [f"{prefix}_universe_score", f"{prefix}_sector_score",
                   f"{prefix}_history_score", f"{prefix}_composite"]
    valid = raw_values.dropna()
    if len(valid) < MIN_SYMBOLS_FOR_MONTH:
        return pd.DataFrame(np.nan, index=raw_values.index, columns=result_cols)

    # Universe score (cross-sectional percentile)
    universe = percentile_rank(raw_values, ascending=True)

    # Sector score (within-sector percentile, min 3 peers)
    sector_scores = pd.Series(np.nan, index=raw_values.index)
    sector_aligned = sector_map.reindex(raw_values.index)
    for sector in sector_aligned.dropna().unique():
        mask = sector_aligned == sector
        group = raw_values[mask].dropna()
        if len(group) >= MIN_SECTOR_PEERS:
            sector_scores[mask] = percentile_rank(raw_values[mask], ascending=True)

    # History score (own-history percentile, min 8 months)
    history_scores = pd.Series(np.nan, index=raw_values.index)
    for sym in raw_values.index:
        if sym not in history_dict:
            continue
        past = [v for v in history_dict[sym] if not np.isnan(v)]
        if len(past) < MIN_HISTORY_MONTHS:
            continue
        cur = raw_values.get(sym)
        if pd.isna(cur):
            continue
        history_scores[sym] = float(np.mean(np.array(past) < cur)) * 100.0

    # Composite: 40% universe + 40% sector + 20% history (reweight for missing)
    dims = pd.DataFrame({"u": universe, "s": sector_scores, "h": history_scores})
    wt = (UNIV_WEIGHT * dims["u"].notna().astype(float) +
          SECT_WEIGHT * dims["s"].notna().astype(float) +
          HIST_WEIGHT * dims["h"].notna().astype(float))
    raw_comp = (UNIV_WEIGHT * dims["u"].fillna(0) +
               SECT_WEIGHT * dims["s"].fillna(0) +
               HIST_WEIGHT * dims["h"].fillna(0))
    composite = raw_comp / wt.where(wt > 0)
    composite[dims.notna().sum(axis=1) == 0] = float("nan")
    composite = percentile_rank(composite, ascending=True)

    return pd.DataFrame({
        f"{prefix}_universe_score": universe,
        f"{prefix}_sector_score": sector_scores,
        f"{prefix}_history_score": history_scores,
        f"{prefix}_composite": composite,
    }, index=raw_values.index)


# ---------------------------------------------------------------------------
# TABLE CREATION SQL
# ---------------------------------------------------------------------------
CREATE_MOMENTUM_SQL = (
    f"CREATE TABLE IF NOT EXISTS {MOMENTUM_TABLE} ("
    " symbol VARCHAR NOT NULL, month_date DATE NOT NULL, gics_sector VARCHAR,"
    " af_r3m DOUBLE, af_r6m DOUBLE, af_r9m DOUBLE, af_r12m DOUBLE, af_momentum DOUBLE,"
    " af_universe_score DOUBLE, af_sector_score DOUBLE, af_history_score DOUBLE, af_composite DOUBLE,"
    " fip_cagr_3m DOUBLE, fip_up_pct_3m DOUBLE, fip_3m DOUBLE,"
    " fip_cagr_6m DOUBLE, fip_up_pct_6m DOUBLE, fip_6m DOUBLE,"
    " fip_cagr_12m DOUBLE, fip_up_pct_12m DOUBLE, fip_12m DOUBLE,"
    " fip_score DOUBLE,"
    " fip_universe_score DOUBLE, fip_sector_score DOUBLE, fip_history_score DOUBLE, fip_composite DOUBLE,"
    " sys_cagr_5yr DOUBLE, sys_r_squared DOUBLE, systemscore DOUBLE,"
    " sys_universe_score DOUBLE, sys_sector_score DOUBLE, sys_history_score DOUBLE, sys_composite DOUBLE,"
    " momentum_score_composite DOUBLE, components_used TINYINT,"
    " calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    " PRIMARY KEY (symbol, month_date))"
)


# ---------------------------------------------------------------------------
# SQL BUILDER - computes AF, FIP, SystemScore SERVER-SIDE in MotherDuck
# Returns ~3000 rows per month (investable universe) instead of ~30-50K
# ---------------------------------------------------------------------------
def build_momentum_sql(md_str, universe_filter=""):
    """
    Build SQL to compute all 3 momentum components server-side.

    universe_filter: SQL fragment from get_universe_filter() applied to the
                     active_symbols CTE to restrict to investable universe stocks.
                     At that point symbols are already stripped of '.US' suffix
                     (via REPLACE in month_prices), matching the universe table format.
    """
    return f"""
    WITH month_prices AS (
        SELECT REPLACE(symbol, '.US', '') AS symbol, date, adjusted_close, gics_sector,
               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
        FROM {PRICE_TABLE}
        WHERE date <= DATE '{md_str}'
          AND date >= DATE '{md_str}' - INTERVAL '2200' DAY
          AND adjusted_close > 0 AND adjusted_close IS NOT NULL
    ),
    active_symbols AS (
        SELECT symbol, MAX(date) AS last_trade
        FROM month_prices
        WHERE rn = 1
        GROUP BY symbol
        HAVING MAX(date) >= DATE '{md_str}' - INTERVAL '5' DAY{universe_filter}
    ),
    af_raw AS (
        SELECT mp.symbol,
               MAX(CASE WHEN mp.rn = 1 THEN mp.gics_sector END) AS gics_sector,
               MAX(CASE WHEN mp.rn = 21 THEN mp.adjusted_close END) AS skip_price,
               MAX(CASE WHEN mp.rn = 84 THEN mp.adjusted_close END) AS p84,
               MAX(CASE WHEN mp.rn = 147 THEN mp.adjusted_close END) AS p147,
               MAX(CASE WHEN mp.rn = 210 THEN mp.adjusted_close END) AS p210,
               MAX(CASE WHEN mp.rn = 273 THEN mp.adjusted_close END) AS p273,
               MAX(mp.rn) AS max_rn
        FROM month_prices mp
        JOIN active_symbols a ON a.symbol = mp.symbol
        GROUP BY mp.symbol
    ),
    af_computed AS (
        SELECT symbol, gics_sector, max_rn,
               CASE WHEN p84 > 0 AND skip_price > 0 THEN skip_price / p84 - 1 END AS af_r3m,
               CASE WHEN p147 > 0 AND skip_price > 0 THEN skip_price / p147 - 1 END AS af_r6m,
               CASE WHEN p210 > 0 AND skip_price > 0 THEN skip_price / p210 - 1 END AS af_r9m,
               CASE WHEN p273 > 0 AND skip_price > 0 THEN skip_price / p273 - 1 END AS af_r12m
        FROM af_raw
        WHERE max_rn >= 84
    ),
    af_final AS (
        SELECT *,
               (COALESCE(af_r3m, 0) + COALESCE(af_r6m, 0) +
                COALESCE(af_r9m, 0) + COALESCE(af_r12m, 0)) /
               NULLIF(
                   (CASE WHEN af_r3m IS NOT NULL THEN 1 ELSE 0 END +
                    CASE WHEN af_r6m IS NOT NULL THEN 1 ELSE 0 END +
                    CASE WHEN af_r9m IS NOT NULL THEN 1 ELSE 0 END +
                    CASE WHEN af_r12m IS NOT NULL THEN 1 ELSE 0 END), 0) AS af_momentum
        FROM af_computed
    ),
    fip_daily AS (
        SELECT mp.symbol, mp.rn, mp.adjusted_close,
               LAG(mp.adjusted_close) OVER (PARTITION BY mp.symbol ORDER BY mp.date) AS prev_close
        FROM month_prices mp
        JOIN active_symbols a ON a.symbol = mp.symbol
        WHERE mp.rn <= 254
    ),
    fip_agg AS (
        SELECT symbol,
               MAX(CASE WHEN rn = 1 THEN adjusted_close END) AS end_price,
               MAX(CASE WHEN rn = 64 THEN adjusted_close END) AS start_3m,
               MAX(CASE WHEN rn = 127 THEN adjusted_close END) AS start_6m,
               MAX(CASE WHEN rn = 253 THEN adjusted_close END) AS start_12m,
               AVG(CASE WHEN rn BETWEEN 1 AND 63 AND prev_close IS NOT NULL AND prev_close > 0
                    THEN CASE WHEN adjusted_close > prev_close THEN 1.0 ELSE 0.0 END END) AS up_pct_3m,
               AVG(CASE WHEN rn BETWEEN 1 AND 126 AND prev_close IS NOT NULL AND prev_close > 0
                    THEN CASE WHEN adjusted_close > prev_close THEN 1.0 ELSE 0.0 END END) AS up_pct_6m,
               AVG(CASE WHEN rn BETWEEN 1 AND 252 AND prev_close IS NOT NULL AND prev_close > 0
                    THEN CASE WHEN adjusted_close > prev_close THEN 1.0 ELSE 0.0 END END) AS up_pct_12m,
               MAX(rn) AS max_rn_fip
        FROM fip_daily
        GROUP BY symbol
    ),
    fip_computed AS (
        SELECT symbol,
               CASE WHEN start_3m > 0 AND end_price > 0
                    THEN POWER(end_price / start_3m, 252.0 / 63.0) - 1 END AS fip_cagr_3m,
               up_pct_3m AS fip_up_pct_3m,
               CASE WHEN start_3m > 0 AND end_price > 0
                    THEN (POWER(end_price / start_3m, 252.0 / 63.0) - 1) * (2 * up_pct_3m - 1) END AS fip_3m,
               CASE WHEN start_6m > 0 AND end_price > 0
                    THEN POWER(end_price / start_6m, 252.0 / 126.0) - 1 END AS fip_cagr_6m,
               up_pct_6m AS fip_up_pct_6m,
               CASE WHEN start_6m > 0 AND end_price > 0
                    THEN (POWER(end_price / start_6m, 252.0 / 126.0) - 1) * (2 * up_pct_6m - 1) END AS fip_6m,
               CASE WHEN start_12m > 0 AND end_price > 0
                    THEN POWER(end_price / start_12m, 252.0 / 252.0) - 1 END AS fip_cagr_12m,
               up_pct_12m AS fip_up_pct_12m,
               CASE WHEN start_12m > 0 AND end_price > 0
                    THEN (POWER(end_price / start_12m, 252.0 / 252.0) - 1) * (2 * up_pct_12m - 1) END AS fip_12m,
               (CASE WHEN start_3m > 0 AND end_price > 0 THEN 1 ELSE 0 END +
                CASE WHEN start_6m > 0 AND end_price > 0 THEN 1 ELSE 0 END +
                CASE WHEN start_12m > 0 AND end_price > 0 THEN 1 ELSE 0 END) AS fip_n_windows
        FROM fip_agg
        WHERE max_rn_fip >= 64
    ),
    fip_final AS (
        SELECT *,
               CASE WHEN fip_n_windows >= 2 THEN
                   (COALESCE(fip_3m * 0.40, 0) + COALESCE(fip_6m * 0.35, 0) +
                    COALESCE(fip_12m * 0.25, 0)) /
                   NULLIF(
                       (CASE WHEN fip_3m IS NOT NULL THEN 0.40 ELSE 0 END +
                        CASE WHEN fip_6m IS NOT NULL THEN 0.35 ELSE 0 END +
                        CASE WHEN fip_12m IS NOT NULL THEN 0.25 ELSE 0 END), 0)
               ELSE NULL END AS fip_score
        FROM fip_computed
    ),
    sys_prices AS (
        SELECT REPLACE(wp.symbol, '.US', '') AS symbol,
               ROW_NUMBER() OVER (PARTITION BY REPLACE(wp.symbol, '.US', '') ORDER BY wp.week_end_date DESC) AS rn,
               LN(wp.adjusted_close) AS log_price
        FROM {WEEKLY_TABLE} wp
        WHERE wp.week_end_date <= DATE '{md_str}'
          AND wp.week_end_date >= DATE '{md_str}' - INTERVAL '2000' DAY
          AND wp.adjusted_close > 0 AND wp.adjusted_close IS NOT NULL
    ),
    sys_stats AS (
        SELECT sp.symbol,
               COUNT(*) AS n,
               MAX(CASE WHEN sp.rn = 1 THEN EXP(sp.log_price) END) AS end_price,
               MAX(CASE WHEN sp.rn = 260 THEN EXP(sp.log_price) END) AS start_price_5yr,
               SUM((260.0 - sp.rn)) AS sum_x,
               SUM((260.0 - sp.rn) * (260.0 - sp.rn)) AS sum_x2,
               SUM(sp.log_price) AS sum_y,
               SUM(sp.log_price * sp.log_price) AS sum_y2,
               SUM((260.0 - sp.rn) * sp.log_price) AS sum_xy
        FROM sys_prices sp
        JOIN active_symbols a ON a.symbol = sp.symbol
        WHERE sp.rn <= 260
        GROUP BY sp.symbol
        HAVING COUNT(*) >= 260
    ),
    sys_final AS (
        SELECT symbol,
               CASE WHEN start_price_5yr > 0 AND end_price > 0
                    THEN POWER(end_price / start_price_5yr, 1.0 / 5.0) - 1 END AS sys_cagr_5yr,
               CASE WHEN (n * sum_x2 - POWER(sum_x, 2)) > 0
                    AND (n * sum_y2 - POWER(sum_y, 2)) > 0
                    THEN LEAST(GREATEST(
                        POWER(n * sum_xy - sum_x * sum_y, 2) /
                        ((n * sum_x2 - POWER(sum_x, 2)) * (n * sum_y2 - POWER(sum_y, 2))),
                        0.0), 1.0)
                    ELSE NULL END AS sys_r_squared
        FROM sys_stats
    ),
    sys_scored AS (
        SELECT symbol, sys_cagr_5yr, sys_r_squared,
               sys_cagr_5yr * sys_r_squared AS systemscore
        FROM sys_final
    )
    SELECT af.symbol, af.gics_sector,
           af.af_r3m, af.af_r6m, af.af_r9m, af.af_r12m, af.af_momentum,
           fp.fip_cagr_3m, fp.fip_up_pct_3m, fp.fip_3m,
           fp.fip_cagr_6m, fp.fip_up_pct_6m, fp.fip_6m,
           fp.fip_cagr_12m, fp.fip_up_pct_12m, fp.fip_12m,
           fp.fip_score,
           sf.sys_cagr_5yr, sf.sys_r_squared, sf.systemscore
    FROM af_final af
    LEFT JOIN fip_final fp ON fp.symbol = af.symbol
    LEFT JOIN sys_scored sf ON sf.symbol = af.symbol
    ORDER BY af.symbol
    """


# ---------------------------------------------------------------------------
# MONTH PROCESSING
# ---------------------------------------------------------------------------
def process_month(mdc, month_end, af_history, fip_history, sys_history, dry_run=False):
    """Process a single month: SQL computes raw metrics, Python does 3-way scoring."""
    md_str = month_end.strftime('%Y-%m-%d')
    t0 = time.time()

    # Determine investable universe filter for this scoring month.
    # Returns SQL IN subquery for months >= 2003-07-01, empty string otherwise.
    universe_filter = get_universe_filter(md_str)
    if universe_filter:
        log.debug(f'{md_str}: Applying investable universe filter.')

    try:
        df = mdc.fetchdf(build_momentum_sql(md_str, universe_filter))
    except Exception as e:
        log.error(f'{md_str}: SQL failed: {e}')
        return 0

    if df.empty or len(df) < MIN_SYMBOLS_FOR_MONTH:
        log.warning(f'{md_str}: Only {len(df)} symbols (need {MIN_SYMBOLS_FOR_MONTH}). Skipping.')
        return 0

    df = df.set_index('symbol', drop=False)
    sector_map = df['gics_sector']

    # Score each component (3-way: universe + sector + history)
    af_vals = df['af_momentum'] if 'af_momentum' in df.columns else pd.Series(np.nan, index=df.index)
    fip_vals = df['fip_score'] if 'fip_score' in df.columns else pd.Series(np.nan, index=df.index)
    sys_vals = df['systemscore'] if 'systemscore' in df.columns else pd.Series(np.nan, index=df.index)

    af_scored = score_component(af_vals, sector_map, af_history, 'af')
    fip_scored = score_component(fip_vals, sector_map, fip_history, 'fip')
    sys_scored = score_component(sys_vals, sector_map, sys_history, 'sys')

    # Build output DataFrame
    out = df[['symbol', 'gics_sector']].copy()
    out['month_date'] = month_end

    # Raw metrics from SQL
    for col in ['af_r3m', 'af_r6m', 'af_r9m', 'af_r12m', 'af_momentum',
                'fip_cagr_3m', 'fip_up_pct_3m', 'fip_3m',
                'fip_cagr_6m', 'fip_up_pct_6m', 'fip_6m',
                'fip_cagr_12m', 'fip_up_pct_12m', 'fip_12m', 'fip_score',
                'sys_cagr_5yr', 'sys_r_squared', 'systemscore']:
        out[col] = df[col] if col in df.columns else np.nan

    # Scored components
    for scored_df in [af_scored, fip_scored, sys_scored]:
        for col in scored_df.columns:
            out[col] = scored_df[col].values

    # Final composite: mean of available component composites, min 2 of 3
    composites = pd.DataFrame({
        'af': out.get('af_composite', pd.Series(np.nan, index=out.index)),
        'fip': out.get('fip_composite', pd.Series(np.nan, index=out.index)),
        'sys': out.get('sys_composite', pd.Series(np.nan, index=out.index)),
    })
    n_components = composites.notna().sum(axis=1)
    mean_comp = composites.mean(axis=1)
    mean_comp[n_components < 2] = np.nan
    out['momentum_score_composite'] = percentile_rank(mean_comp, ascending=True).values
    out['components_used'] = n_components.values

    # Filter to symbols with at least 1 scored component
    out = out[n_components >= 1].copy()
    out = out.reset_index(drop=True)

    # Update history buffers
    for _, row in out.iterrows():
        sym = row['symbol']
        for hist, col in [(af_history, 'af_momentum'),
                          (fip_history, 'fip_score'),
                          (sys_history, 'systemscore')]:
            if sym not in hist:
                hist[sym] = []
            val = row.get(col)
            hist[sym].append(float(val) if pd.notna(val) else float('nan'))

    elapsed = time.time() - t0
    n_composite = int(out['momentum_score_composite'].notna().sum())
    log.info(f'{md_str}: {len(out)} symbols, {n_composite} with composite, {elapsed:.1f}s')

    if dry_run:
        sample = out[out['momentum_score_composite'].notna()].head(5)
        for _, r in sample.iterrows():
            af_c = r.get('af_composite', np.nan)
            fip_c = r.get('fip_composite', np.nan)
            sys_c = r.get('sys_composite', np.nan)
            mom_c = r.get('momentum_score_composite', np.nan)
            log.info(f'  {r["symbol"]}: AF={af_c:.1f} FIP={fip_c:.1f} SYS={sys_c:.1f} MOM={mom_c:.1f}')
        return len(out)

    # Write to MotherDuck (idempotent: delete then insert)
    try:
        mdc.execute(f"DELETE FROM {MOMENTUM_TABLE} WHERE month_date = ?", [month_end])
        mdc.con.register('__mom_batch', out)
        col_list = ', '.join(out.columns.tolist())
        mdc.execute(f'INSERT INTO {MOMENTUM_TABLE} ({col_list}) SELECT {col_list} FROM __mom_batch')
        mdc.con.unregister('__mom_batch')
        return len(out)
    except Exception as e:
        log.error(f'{md_str}: Write failed: {e}')
        try:
            mdc.con.unregister('__mom_batch')
        except Exception:
            pass
        return 0


# ---------------------------------------------------------------------------
# HISTORY PRELOADING
# ---------------------------------------------------------------------------
def preload_momentum_history(mdc, start_date):
    """Pre-load historical raw values for history scoring dimension."""
    af_hist, fip_hist, sys_hist = {}, {}, {}
    try:
        df = mdc.fetchdf(
            f"SELECT symbol, af_momentum, fip_score, systemscore "
            f"FROM {MOMENTUM_TABLE} "
            f"WHERE month_date < '{start_date.strftime('%Y-%m-%d')}' "
            f"ORDER BY month_date ASC")
        for _, row in df.iterrows():
            sym = row['symbol']
            for hist, col in [(af_hist, 'af_momentum'),
                              (fip_hist, 'fip_score'),
                              (sys_hist, 'systemscore')]:
                if sym not in hist:
                    hist[sym] = []
                val = row[col]
                hist[sym].append(float(val) if pd.notna(val) else float('nan'))
        log.info(f'Pre-loaded momentum history: {len(af_hist)} symbols')
    except Exception as e:
        log.warning(f'No existing momentum history: {e}')
    return af_hist, fip_hist, sys_hist


# ---------------------------------------------------------------------------
# FIND EARLIEST VIABLE MONTH
# ---------------------------------------------------------------------------
def find_earliest_month(mdc):
    """Find first month where >= MIN_SYMBOLS_FOR_MONTH symbols have 84+ trading days."""
    sql = (
        f"WITH sym_first_viable AS ("
        f" SELECT REPLACE(symbol, '.US', '') AS sym,"
        f" LAST_DAY(MIN(date) + INTERVAL '300' DAY) AS first_viable"
        f" FROM {PRICE_TABLE}"
        f" WHERE adjusted_close > 0 AND adjusted_close IS NOT NULL"
        f" GROUP BY REPLACE(symbol, '.US', '')"
        f" HAVING COUNT(*) >= 84"
        f") SELECT first_viable FROM sym_first_viable"
        f" ORDER BY first_viable ASC"
        f" LIMIT 1 OFFSET {MIN_SYMBOLS_FOR_MONTH - 1}"
    )
    try:
        r = mdc.fetchdf(sql)
        if not r.empty:
            earliest = pd.to_datetime(r.iloc[0, 0]).date()
            log.info(f'Earliest viable month: {earliest}')
            return earliest
    except Exception as e:
        log.warning(f'Could not determine earliest month: {e}')
    return date(1970, 1, 31)


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='OBQ Momentum Score Recalculation')
    parser.add_argument('--full-rebuild', action='store_true',
        help='Full rebuild from earliest viable date (drops existing table)')
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
        start = find_earliest_month(mdc)
    elif args.resume:
        last = get_last_completed(mdc, 'momentum')
        if last:
            if last.month < 12:
                start = last.replace(month=last.month + 1, day=1)
            else:
                start = last.replace(year=last.year + 1, month=1, day=1)
            log.info(f'Resuming from {start} (last completed: {last})')
        else:
            log.info('No progress found. Starting from earliest viable month.')
            start = find_earliest_month(mdc)
    else:
        start = find_earliest_month(mdc)

    if args.end_date:
        end = date.fromisoformat(args.end_date)
    else:
        end = date.today().replace(day=1) - timedelta(days=1)

    month_dates = get_month_ends(start, end)
    log.info(f'Momentum: {len(month_dates)} months to process ({start} to {end})')

    if not month_dates:
        log.info('No months to process.')
        mdc.close()
        return

    # Full rebuild: drop and recreate
    if args.full_rebuild and not args.dry_run:
        try:
            mdc.execute(f'DROP TABLE IF EXISTS {MOMENTUM_TABLE}')
            log.info(f'Dropped existing table {MOMENTUM_TABLE}')
        except Exception:
            pass

    if not args.dry_run:
        mdc.execute(CREATE_MOMENTUM_SQL)
        log.info(f'Ensured table {MOMENTUM_TABLE} exists.')

    # Pre-load history if resuming
    if args.resume and not args.full_rebuild:
        af_hist, fip_hist, sys_hist = preload_momentum_history(mdc, start)
    else:
        af_hist, fip_hist, sys_hist = {}, {}, {}

    # Process months
    total_written = 0
    for i, month_end in enumerate(month_dates):
        rows = process_month(mdc, month_end, af_hist, fip_hist, sys_hist,
                            dry_run=args.dry_run)
        total_written += rows
        if not args.dry_run and rows > 0:
            update_progress(mdc, 'momentum', month_end, total_written)
        if (i + 1) % 12 == 0:
            log.info(f'Progress: {i+1}/{len(month_dates)} months, {total_written} total rows')

    log.info(f'=== MOMENTUM COMPLETE. {total_written} total rows across {len(month_dates)} months. ===')

    # Verify distribution
    if total_written > 0 and not args.dry_run:
        try:
            stats = mdc.fetchdf(
                f"SELECT COUNT(*) AS total_rows, COUNT(DISTINCT symbol) AS n_symbols, "
                f"MIN(month_date) AS min_date, MAX(month_date) AS max_date, "
                f"AVG(momentum_score_composite) AS mean_score, "
                f"STDDEV(momentum_score_composite) AS std_score "
                f"FROM {MOMENTUM_TABLE} WHERE momentum_score_composite IS NOT NULL")
            for _, r in stats.iterrows():
                log.info(f'STATS: {int(r["total_rows"])} rows, {int(r["n_symbols"])} symbols, '
                         f'{r["min_date"]} to {r["max_date"]}, '
                         f'mean={r["mean_score"]:.2f}, std={r["std_score"]:.2f}')
        except Exception as e:
            log.warning(f'Could not verify stats: {e}')

    mdc.close()


if __name__ == '__main__':
    main()
