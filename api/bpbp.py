"""
BPBP (Bull Power / Bear Pressure) Indicator + Backtest

Computes a market regime indicator from the survivorship-bias-free universe:
- For each stock each week: classify volume as "up" or "down" based on weekly close vs prev close
- Bull Power = SUM(up_vol) / SUM(total_vol), smoothed with 21-week SMA
- Bear Pressure = SUM(down_vol) / SUM(total_vol), smoothed with 21-week SMA
- Signal: BP > SP = bullish (hold SPY), else bearish (go to cash)
- Backtest: weekly SPY returns × lagged signal (1-week lag to prevent look-ahead)

Data sources:
- PROD_EOD_survivorship (stocks — daily OHLCV)
- PROD_EOD_ETFs (SPY — benchmark)

When volume is NULL (pre-backfill), falls back to equal-weight stock counts
(advancing stocks / total stocks) instead of volume-weighted.

Display anchor: equity curve starts from 1995-01-01 for viewing.
"""

import os
import json
import time
import math
import logging
from pathlib import Path as FilePath
from typing import Optional, Dict, Any, List

import duckdb
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

BPBP_CACHE_DIR = FilePath("/tmp/jcn_bpbp")
BPBP_CACHE_TTL = 5 * 60  # 5 minutes

DISPLAY_START = "1995-01-01"  # Anchor date for equity curve display

PERIOD_WEEKS = {"1y": 52, "3y": 156, "5y": 260, "10y": 520, "all": 99999}


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def _get_connection() -> duckdb.DuckDBPyConnection:
    token = os.getenv("MOTHERDUCK_TOKEN", "")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN not set")
    return duckdb.connect(f"md:?motherduck_token={token}")


def _safe_float(v, decimals: int = 4) -> Optional[float]:
    """Convert to float, return None if NaN/inf."""
    if v is None:
        return None
    try:
        f = float(v)
        if math.isnan(f) or not math.isfinite(f):
            return None
        return round(f, decimals)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def _compute_bpbp() -> Dict[str, Any]:
    """Compute full BPBP history from survivorship table.
    
    Returns a dict with:
      - bpbp_df: DataFrame with weekly BP/SP/signal
      - spy_df: DataFrame with weekly SPY OHLC
      - aligned: DataFrame with backtest results
      - metrics: performance metrics dict
    """
    t0 = time.time()
    conn = _get_connection()

    try:
        # Step 1: Weekly aggregation from survivorship table
        # When volume is available, use volume-weighted BP/SP
        # When volume is NULL, fall back to stock-count weighting
        weekly_sql = """
        SELECT week_start, bp_raw, sp_raw, n_stocks
        FROM (
            SELECT
                week_start,
                CAST(
                    CASE WHEN SUM(COALESCE(week_volume, 1.0)) > 0
                         THEN SUM(CASE WHEN week_close > prev_close
                                       THEN COALESCE(week_volume, 1.0) ELSE 0 END)
                              / SUM(COALESCE(week_volume, 1.0))
                         ELSE 0.5
                    END AS DOUBLE
                ) AS bp_raw,
                CAST(
                    CASE WHEN SUM(COALESCE(week_volume, 1.0)) > 0
                         THEN SUM(CASE WHEN week_close < prev_close
                                       THEN COALESCE(week_volume, 1.0) ELSE 0 END)
                              / SUM(COALESCE(week_volume, 1.0))
                         ELSE 0.5
                    END AS DOUBLE
                ) AS sp_raw,
                COUNT(*) AS n_stocks
            FROM (
                SELECT
                    symbol, week_start, week_close, week_volume,
                    LAG(week_close) OVER (PARTITION BY symbol ORDER BY week_start) AS prev_close
                FROM (
                    SELECT
                        symbol,
                        DATE_TRUNC('week', date) AS week_start,
                        LAST(adjusted_close ORDER BY date) AS week_close,
                        SUM(volume)::DOUBLE AS week_volume
                    FROM PROD_EODHD.main.PROD_EOD_survivorship
                    WHERE adjusted_close > 0
                    GROUP BY symbol, DATE_TRUNC('week', date)
                )
            )
            WHERE prev_close IS NOT NULL AND prev_close > 0
            GROUP BY week_start
            HAVING COUNT(*) >= 100
        )
        ORDER BY week_start
        """
        bpbp_rows = conn.execute(weekly_sql).fetchall()

        # Step 2: SPY weekly OHLC from ETFs table
        spy_sql = """
        SELECT
            DATE_TRUNC('week', date) AS week_start,
            FIRST(open ORDER BY date) AS week_open,
            MAX(high) AS week_high,
            MIN(low) AS week_low,
            LAST(adjusted_close ORDER BY date) AS week_close
        FROM PROD_EODHD.main.PROD_EOD_ETFs
        WHERE symbol = 'SPY.US' AND adjusted_close IS NOT NULL AND adjusted_close > 0
        GROUP BY DATE_TRUNC('week', date)
        ORDER BY week_start
        """
        spy_rows = conn.execute(spy_sql).fetchall()

    finally:
        conn.close()

    query_ms = round((time.time() - t0) * 1000)
    logger.info(f"BPBP queries: {len(bpbp_rows)} weeks, {len(spy_rows)} SPY weeks ({query_ms}ms)")

    if not bpbp_rows or not spy_rows:
        raise ValueError("Insufficient data for BPBP computation")

    # Step 3: Pandas — 21-week SMA
    df = pd.DataFrame(bpbp_rows, columns=["week_start", "bp_raw", "sp_raw", "n_stocks"])
    df["week_start"] = pd.to_datetime(df["week_start"])
    df = df.sort_values("week_start").reset_index(drop=True)
    df["buying_power"] = df["bp_raw"].rolling(21, min_periods=10).mean()
    df["selling_pressure"] = df["sp_raw"].rolling(21, min_periods=10).mean()
    df["bpsp_ratio"] = df["buying_power"] / df["selling_pressure"].replace(0, float("nan"))
    df["signal"] = (df["buying_power"] > df["selling_pressure"]).astype(int)
    df = df.dropna(subset=["buying_power", "selling_pressure"]).reset_index(drop=True)

    # Step 4: SPY weekly DataFrame
    spy = pd.DataFrame(spy_rows, columns=["week_start", "open", "high", "low", "close"])
    spy["week_start"] = pd.to_datetime(spy["week_start"])
    spy = spy.sort_values("week_start").set_index("week_start")

    # Step 5: Backtest — weekly SPY returns, strategy = hold when BP > SP (signal lagged 1 week)
    bpbp_indexed = df.set_index("week_start")
    aligned = spy.join(
        bpbp_indexed[["buying_power", "selling_pressure", "signal", "bpsp_ratio"]],
        how="inner",
    )
    aligned = aligned.dropna(subset=["close"])
    aligned["spx_ret"] = aligned["close"].pct_change()
    aligned["signal_lag"] = aligned["signal"].shift(1)
    aligned["strat_ret"] = aligned["spx_ret"] * aligned["signal_lag"].fillna(0)
    aligned = aligned.dropna(subset=["spx_ret"])

    # Filter to display anchor
    display_mask = aligned.index >= pd.Timestamp(DISPLAY_START)
    aligned = aligned[display_mask].copy()

    if len(aligned) < 10:
        raise ValueError("Insufficient data after display anchor filter")

    # Equity curves (start at $100 from display anchor)
    aligned["spx_equity"] = 100 * (1 + aligned["spx_ret"]).cumprod()
    aligned["strat_equity"] = 100 * (1 + aligned["strat_ret"]).cumprod()

    # Drawdowns
    def _dd(eq):
        roll_max = eq.cummax()
        return ((eq / roll_max) - 1) * 100

    aligned["spx_dd"] = _dd(aligned["spx_equity"])
    aligned["strat_dd"] = _dd(aligned["strat_equity"])

    # Performance metrics
    weeks = len(aligned)
    years = weeks / 52.0

    def _metrics(eq_series, ret_series):
        total_ret = (eq_series.iloc[-1] / 100 - 1) * 100
        cagr = ((eq_series.iloc[-1] / 100) ** (1 / max(years, 0.1)) - 1) * 100
        vol = ret_series.std() * np.sqrt(52) * 100
        sharpe = (
            (ret_series.mean() * 52) / (ret_series.std() * np.sqrt(52))
            if ret_series.std() > 0
            else 0
        )
        max_dd = _dd(eq_series).min()
        win_rate = (ret_series > 0).sum() / max(len(ret_series), 1) * 100
        return {
            "total_return": _safe_float(total_ret, 2),
            "cagr": _safe_float(cagr, 2),
            "volatility": _safe_float(vol, 2),
            "sharpe": _safe_float(sharpe, 2),
            "max_drawdown": _safe_float(max_dd, 2),
            "win_rate": _safe_float(win_rate, 2),
            "final_equity": _safe_float(eq_series.iloc[-1], 2),
        }

    time_in_market = aligned["signal_lag"].fillna(0).mean() * 100

    metrics = {
        "strategy": _metrics(aligned["strat_equity"], aligned["strat_ret"]),
        "benchmark": _metrics(aligned["spx_equity"], aligned["spx_ret"]),
        "time_in_market": _safe_float(time_in_market, 2),
        "years": round(years, 1),
        "weeks": weeks,
        "start_date": str(aligned.index[0].date()),
        "end_date": str(aligned.index[-1].date()),
    }

    compute_ms = round((time.time() - t0) * 1000)
    logger.info(f"BPBP compute complete: {weeks} weeks, {years:.1f}y ({compute_ms}ms)")

    return {
        "bpbp_df": df,
        "spy_df": spy,
        "aligned": aligned,
        "metrics": metrics,
        "compute_ms": compute_ms,
    }


# ---------------------------------------------------------------------------
# Public API functions
# ---------------------------------------------------------------------------

def get_bpbp_indicator(period: str = "5y") -> Dict[str, Any]:
    """Get BPBP indicator data for charts.
    
    Returns:
      - dates, buying_power, selling_pressure, bpsp_ratio, signal, n_stocks
      - spy OHLC aligned to BPBP dates
      - latest values
    """
    # Check cache
    BPBP_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = BPBP_CACHE_DIR / "bpbp_full.json"
    
    cache = None
    if cache_file.exists():
        try:
            raw = json.loads(cache_file.read_text())
            if time.time() - raw.get("_ts", 0) < BPBP_CACHE_TTL:
                cache = raw
        except Exception:
            pass

    if cache is None:
        # Compute fresh
        result = _compute_bpbp()
        df = result["bpbp_df"]
        spy = result["spy_df"]
        aligned = result["aligned"]
        
        # Serialize to cache
        cache = {
            "_ts": time.time(),
            "indicator": {
                "dates": [str(d.date()) for d in df["week_start"]],
                "buying_power": [_safe_float(v) for v in df["buying_power"]],
                "selling_pressure": [_safe_float(v) for v in df["selling_pressure"]],
                "bpsp_ratio": [_safe_float(v) for v in df["bpsp_ratio"]],
                "signal": [int(v) for v in df["signal"]],
                "n_stocks": [int(v) for v in df["n_stocks"]],
            },
            "spy": {
                "dates": [str(d.date()) for d in spy.index],
                "open": [_safe_float(v, 2) for v in spy["open"]],
                "high": [_safe_float(v, 2) for v in spy["high"]],
                "low": [_safe_float(v, 2) for v in spy["low"]],
                "close": [_safe_float(v, 2) for v in spy["close"]],
            },
            "backtest": {
                "dates": [str(d.date()) for d in aligned.index],
                "strat_equity": [_safe_float(v, 2) for v in aligned["strat_equity"]],
                "spy_equity": [_safe_float(v, 2) for v in aligned["spx_equity"]],
                "strat_drawdown": [_safe_float(v, 2) for v in aligned["strat_dd"]],
                "spy_drawdown": [_safe_float(v, 2) for v in aligned["spx_dd"]],
                "signal": [int(v) for v in aligned["signal_lag"].fillna(0)],
            },
            "metrics": result["metrics"],
            "latest": {
                "date": str(df.iloc[-1]["week_start"].date()),
                "buying_power": _safe_float(df.iloc[-1]["buying_power"]),
                "selling_pressure": _safe_float(df.iloc[-1]["selling_pressure"]),
                "bpsp_ratio": _safe_float(df.iloc[-1]["bpsp_ratio"]),
                "signal": int(df.iloc[-1]["signal"]),
                "n_stocks": int(df.iloc[-1]["n_stocks"]),
                "spy_close": _safe_float(spy.iloc[-1]["close"], 2) if len(spy) > 0 else None,
            },
            "compute_ms": result["compute_ms"],
        }
        
        try:
            cache_file.write_text(json.dumps(cache))
        except Exception:
            pass

    # Filter indicator data by period
    n_weeks = PERIOD_WEEKS.get(period, 260)
    ind = cache["indicator"]
    total = len(ind["dates"])
    start = max(0, total - n_weeks)
    
    filtered_ind = {
        "dates": ind["dates"][start:],
        "buying_power": ind["buying_power"][start:],
        "selling_pressure": ind["selling_pressure"][start:],
        "bpsp_ratio": ind["bpsp_ratio"][start:],
        "signal": ind["signal"][start:],
        "n_stocks": ind["n_stocks"][start:],
    }

    # Filter SPY to same date range
    spy_data = cache["spy"]
    if filtered_ind["dates"]:
        first_date = filtered_ind["dates"][0]
        spy_start = 0
        for i, d in enumerate(spy_data["dates"]):
            if d >= first_date:
                spy_start = i
                break
        filtered_spy = {
            "dates": spy_data["dates"][spy_start:],
            "open": spy_data["open"][spy_start:],
            "high": spy_data["high"][spy_start:],
            "low": spy_data["low"][spy_start:],
            "close": spy_data["close"][spy_start:],
        }
    else:
        filtered_spy = spy_data

    return {
        "indicator": filtered_ind,
        "spy": filtered_spy,
        "backtest": cache["backtest"],
        "metrics": cache["metrics"],
        "latest": cache["latest"],
        "period": period,
        "compute_ms": cache.get("compute_ms", 0),
    }
