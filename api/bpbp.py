"""
BPBP (Bull Power / Bear Pressure) Indicator + Backtest

Reads pre-calculated data from NDR_BP_SP_history table in MotherDuck.
This table contains weekly BPSP indicator values, SPX OHLC, signal, and
full backtest equity/drawdown series computed from Norgate survivorship-
bias-free data (~10,400 stocks including delisted, 1990-2025).

Two chart groups (matching Hex.tech Macro Risk Model Dashboard 1.0):
  Plot 1: SPX Weekly OHLC (top) + BPSP Indicator (bottom)
  Plot 2: Equity Curves (top) + Drawdowns (mid) + Signal Timeline (bottom)

Display anchor: 1995-01-01 for viewing.
"""

import os
import json
import time
import math
import logging
from pathlib import Path as FilePath
from typing import Optional, Dict, Any

import duckdb
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

BPBP_CACHE_DIR = FilePath("/tmp/jcn_bpbp")
BPBP_CACHE_TTL = 5 * 60  # 5 minutes

DISPLAY_START = "1995-01-01"  # Anchor date for viewing
PERIOD_WEEKS = {"1y": 52, "3y": 156, "5y": 260, "10y": 520, "all": 99999}


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def _get_connection() -> duckdb.DuckDBPyConnection:
    token = os.getenv("MOTHERDUCK_TOKEN", "")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN not set")
    return duckdb.connect(f"md:?motherduck_token={token}")


def _safe(v, decimals: int = 4) -> Optional[float]:
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
# Load pre-calculated data
# ---------------------------------------------------------------------------

def _load_bpbp() -> Dict[str, Any]:
    """Read NDR_BP_SP_history from MotherDuck and return structured data."""
    t0 = time.time()
    conn = _get_connection()

    try:
        rows = conn.execute("""
            SELECT
                Date,
                Buying_Power,
                Selling_Pressure,
                BPSP_Ratio,
                Signal,
                SPX_Open,
                SPX_High,
                SPX_Low,
                SPX_Close,
                SPX_Return,
                Strategy_Return,
                SPX_Equity,
                Strategy_Equity,
                SPX_Drawdown,
                Strategy_Drawdown
            FROM NDR_BP_SP_history
            ORDER BY Date
        """).fetchall()
    finally:
        conn.close()

    query_ms = round((time.time() - t0) * 1000)
    logger.info(f"BPBP loaded {len(rows)} weeks from NDR_BP_SP_history ({query_ms}ms)")

    if not rows:
        raise ValueError("NDR_BP_SP_history table is empty")

    # Unpack columns
    dates = []
    buying_power = []
    selling_pressure = []
    bpsp_ratio = []
    signal = []
    spx_open = []
    spx_high = []
    spx_low = []
    spx_close = []
    spx_return = []
    strat_return = []
    spx_equity = []
    strat_equity = []
    spx_drawdown = []
    strat_drawdown = []

    for r in rows:
        dates.append(str(r[0].date()) if hasattr(r[0], 'date') else str(r[0])[:10])
        buying_power.append(_safe(r[1]))
        selling_pressure.append(_safe(r[2]))
        bpsp_ratio.append(_safe(r[3]))
        signal.append(int(r[4]) if r[4] is not None else 0)
        spx_open.append(_safe(r[5], 2))
        spx_high.append(_safe(r[6], 2))
        spx_low.append(_safe(r[7], 2))
        spx_close.append(_safe(r[8], 2))
        spx_return.append(_safe(r[9], 6))
        strat_return.append(_safe(r[10], 6))
        spx_equity.append(_safe(r[11], 2))
        strat_equity.append(_safe(r[12], 2))
        spx_drawdown.append(_safe(r[13], 2))
        strat_drawdown.append(_safe(r[14], 2))

    # Performance metrics (from full history)
    total_weeks = len(dates)
    years = total_weeks / 52.0

    def _metrics(equity_vals, return_vals):
        eq_last = equity_vals[-1] if equity_vals else 100
        if eq_last is None:
            eq_last = 100
        rets = [r for r in return_vals if r is not None]
        arr = np.array(rets) if rets else np.array([0.0])
        total_ret = (eq_last / 100 - 1) * 100
        cagr = ((eq_last / 100) ** (1 / max(years, 0.1)) - 1) * 100
        vol = float(arr.std() * np.sqrt(52) * 100)
        sharpe = float((arr.mean() * 52) / (arr.std() * np.sqrt(52))) if arr.std() > 0 else 0
        dd_vals = [d for d in (spx_drawdown if equity_vals is spx_equity else strat_drawdown) if d is not None]
        max_dd = min(dd_vals) if dd_vals else 0
        win_rate = sum(1 for r in rets if r > 0) / max(len(rets), 1) * 100
        return {
            "total_return": _safe(total_ret, 2),
            "cagr": _safe(cagr, 2),
            "volatility": _safe(vol, 2),
            "sharpe": _safe(sharpe, 2),
            "max_drawdown": _safe(max_dd, 2),
            "win_rate": _safe(win_rate, 2),
            "final_equity": _safe(eq_last, 2),
        }

    time_in_market = sum(signal) / max(len(signal), 1) * 100

    latest_idx = -1
    latest = {
        "date": dates[latest_idx],
        "buying_power": buying_power[latest_idx],
        "selling_pressure": selling_pressure[latest_idx],
        "bpsp_ratio": bpsp_ratio[latest_idx],
        "signal": signal[latest_idx],
        "spx_close": spx_close[latest_idx],
    }

    return {
        "_ts": time.time(),
        "indicator": {
            "dates": dates,
            "buying_power": buying_power,
            "selling_pressure": selling_pressure,
            "bpsp_ratio": bpsp_ratio,
            "signal": signal,
        },
        "spy": {
            "dates": dates,
            "open": spx_open,
            "high": spx_high,
            "low": spx_low,
            "close": spx_close,
        },
        "backtest": {
            "dates": dates,
            "strat_equity": strat_equity,
            "spy_equity": spx_equity,
            "strat_drawdown": strat_drawdown,
            "spy_drawdown": spx_drawdown,
            "signal": signal,
        },
        "metrics": {
            "strategy": _metrics(strat_equity, strat_return),
            "benchmark": _metrics(spx_equity, spx_return),
            "time_in_market": _safe(time_in_market, 2),
            "years": round(years, 1),
            "weeks": total_weeks,
            "start_date": dates[0],
            "end_date": dates[-1],
        },
        "latest": latest,
        "compute_ms": query_ms,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_bpbp_indicator(period: str = "5y") -> Dict[str, Any]:
    """Get BPBP indicator data for charts."""
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
        cache = _load_bpbp()
        try:
            cache_file.write_text(json.dumps(cache))
        except Exception:
            pass

    # Filter by period for indicator + spy charts
    n_weeks = PERIOD_WEEKS.get(period, 260)
    ind = cache["indicator"]
    total = len(ind["dates"])
    start = max(0, total - n_weeks)

    filtered_ind = {k: v[start:] for k, v in ind.items()}

    spy_data = cache["spy"]
    filtered_spy = {k: v[start:] for k, v in spy_data.items()}

    return {
        "indicator": filtered_ind,
        "spy": filtered_spy,
        "backtest": cache["backtest"],  # Always full history for equity curves
        "metrics": cache["metrics"],
        "latest": cache["latest"],
        "period": period,
        "compute_ms": cache.get("compute_ms", 0),
    }
