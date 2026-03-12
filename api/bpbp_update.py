"""
BPBP Weekly Update — Extend NDR_BP_SP_history with new weeks.

Fetches daily stock data from EODHD bulk endpoint for each missing week,
computes weekly breadth metrics (BP_Raw, SP_Raw from volume ratios),
applies 21-week SMA to get Buying_Power / Selling_Pressure, then
appends new rows to NDR_BP_SP_history in MotherDuck.

Also fetches SPX OHLC from SPY.US ETF data and computes equity/drawdown.

Formula (verified from existing data):
  - For each week (Mon-Fri), aggregate all US stocks:
    - Advancing_Issues = count of stocks where adj_close(Fri) > adj_close(prev Fri)
    - Declining_Issues = count of stocks where adj_close(Fri) < adj_close(prev Fri)
    - Points_Gained = sum of positive weekly % returns
    - Points_Lost = sum of absolute negative weekly % returns
    - Up_Volume = sum of volume for advancing stocks
    - Down_Volume = sum of volume for declining stocks
    - Total_Volume = sum of all volume
  - BP_Raw = Up_Volume / Total_Volume
  - SP_Raw = Down_Volume / Total_Volume
  - Buying_Power = 21-week SMA of BP_Raw
  - Selling_Pressure = 21-week SMA of SP_Raw
  - Signal = 1 if Buying_Power > Selling_Pressure else 0

Schedule: Weekly, after Friday close (runs Saturday morning via cron).
Can also be triggered manually via /api/bpbp/update endpoint.
"""

import os
import time
import math
import logging
from datetime import datetime, timedelta, date, timezone
from typing import Dict, Any, List, Optional, Tuple

import duckdb
import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

EODHD_BULK_URL = "https://eodhd.com/api/eod-bulk-last-day/US"
EODHD_EOD_URL = "https://eodhd.com/api/eod"  # For index OHLC
SPX_SYMBOL = "GSPC.INDX"  # S&P 500 index (NOT SPY ETF — prices differ by ~10x)
SMA_WINDOW = 21  # 21-week moving average
REQUEST_TIMEOUT = 60


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _connect() -> duckdb.DuckDBPyConnection:
    token = os.getenv("MOTHERDUCK_TOKEN", "")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN not set")
    return duckdb.connect(f"md:?motherduck_token={token}")


def _get_last_ndr_date(conn: duckdb.DuckDBPyConnection) -> date:
    """Get the most recent Friday in NDR_BP_SP_history."""
    row = conn.execute(
        "SELECT MAX(Date) FROM NDR_BP_SP_history"
    ).fetchone()
    if not row or not row[0]:
        raise RuntimeError("NDR_BP_SP_history is empty")
    d = row[0]
    return d.date() if hasattr(d, "date") else datetime.strptime(str(d)[:10], "%Y-%m-%d").date()


def _get_recent_bp_sp_raw(conn: duckdb.DuckDBPyConnection, n: int = SMA_WINDOW) -> List[Tuple[float, float]]:
    """Get the last N (BP_Raw, SP_Raw) values for SMA continuation."""
    rows = conn.execute(f"""
        SELECT BP_Raw, SP_Raw
        FROM NDR_BP_SP_history
        ORDER BY Date DESC
        LIMIT {n}
    """).fetchall()
    # Reverse to chronological order
    return [(float(r[0]), float(r[1])) for r in reversed(rows)]


def _get_last_equity_state(conn: duckdb.DuckDBPyConnection) -> Dict:
    """Get the last row's equity/drawdown state for continuation."""
    row = conn.execute("""
        SELECT Signal, SPX_Equity, Strategy_Equity,
               SPX_Peak, Strategy_Peak
        FROM NDR_BP_SP_history
        ORDER BY Date DESC
        LIMIT 1
    """).fetchone()
    return {
        "signal": int(row[0]),
        "spx_equity": float(row[1]),
        "strat_equity": float(row[2]),
        "spx_peak": float(row[3]),
        "strat_peak": float(row[4]),
    }


def _fridays_after(start: date) -> List[date]:
    """Generate all Fridays from start (exclusive) through today."""
    fridays = []
    # Find the next Friday after start
    d = start + timedelta(days=1)
    while d.weekday() != 4:  # 4 = Friday
        d += timedelta(days=1)

    today = datetime.now(timezone.utc).date()
    while d <= today:
        fridays.append(d)
        d += timedelta(days=7)
    return fridays


def _fetch_bulk_day(api_key: str, date_str: str) -> List[Dict]:
    """Fetch EODHD bulk data for one day. Returns list of records."""
    url = f"{EODHD_BULK_URL}?api_token={api_key}&fmt=json&date={date_str}"
    resp = requests.get(url, timeout=REQUEST_TIMEOUT)
    if resp.status_code != 200:
        raise RuntimeError(f"EODHD HTTP {resp.status_code} for {date_str}")
    data = resp.json()
    if not isinstance(data, list):
        return []
    return data


def _fetch_spy_ohlc(api_key: str, from_date: str, to_date: str) -> Dict[str, Dict]:
    """Fetch S&P 500 index (GSPC.INDX) daily OHLC from EODHD. Returns {date_str: {open,high,low,close,volume}}."""
    url = (
        f"{EODHD_EOD_URL}/{SPX_SYMBOL}?api_token={api_key}&fmt=json"
        f"&from={from_date}&to={to_date}"
    )
    resp = requests.get(url, timeout=REQUEST_TIMEOUT)
    if resp.status_code != 200:
        return {}
    data = resp.json()
    result = {}
    for rec in data:
        d = rec.get("date", "")
        result[d] = {
            "open": float(rec.get("open", 0)),
            "high": float(rec.get("high", 0)),
            "low": float(rec.get("low", 0)),
            "close": float(rec.get("close", 0) or rec.get("adjusted_close", 0)),
            "adj_close": float(rec.get("adjusted_close", 0)),
            "volume": float(rec.get("volume", 0)),
        }
    return result


def _compute_weekly_breadth(
    friday_data: List[Dict],
    prev_friday_data: List[Dict],
) -> Dict:
    """
    Compute weekly breadth metrics from two days of bulk data.

    For each stock present in both days:
      - Weekly return = (close_friday / close_prev_friday) - 1
      - Advancing = positive return, Declining = negative return
      - Volume from Friday (most liquid day of week)

    Returns dict with all raw metrics.
    """
    # Build lookup: symbol -> record for previous Friday
    prev_map = {}
    for rec in prev_friday_data:
        code = rec.get("code", "")
        if not code:
            continue
        sym = f"{code}.US" if not code.endswith(".US") else code
        adj = rec.get("adjusted_close") or rec.get("close")
        if adj and float(adj) > 0:
            prev_map[sym] = float(adj)

    # Process current Friday
    advancing = 0
    declining = 0
    pts_gained = 0.0
    pts_lost = 0.0
    up_vol = 0.0
    down_vol = 0.0
    total_vol = 0.0

    for rec in friday_data:
        code = rec.get("code", "")
        if not code:
            continue
        sym = f"{code}.US" if not code.endswith(".US") else code

        adj = rec.get("adjusted_close") or rec.get("close")
        vol = rec.get("volume")
        if not adj or float(adj) <= 0:
            continue

        curr_price = float(adj)
        curr_vol = float(vol) if vol and float(vol) > 0 else 0.0

        prev_price = prev_map.get(sym)
        if prev_price is None or prev_price <= 0:
            continue

        weekly_ret = (curr_price / prev_price) - 1.0
        pct_change = weekly_ret * 100  # Points as percentage

        total_vol += curr_vol

        if weekly_ret > 0:
            advancing += 1
            pts_gained += pct_change
            up_vol += curr_vol
        elif weekly_ret < 0:
            declining += 1
            pts_lost += abs(pct_change)
            down_vol += curr_vol
        # stocks with exactly 0 return are neither advancing nor declining

    return {
        "advancing": advancing,
        "declining": declining,
        "pts_gained": pts_gained,
        "pts_lost": pts_lost,
        "up_vol": up_vol,
        "down_vol": down_vol,
        "total_vol": total_vol,
    }


def _safe(v: float, decimals: int = 6) -> Optional[float]:
    if v is None or math.isnan(v) or not math.isfinite(v):
        return None
    return round(v, decimals)


# ---------------------------------------------------------------------------
# Main update logic
# ---------------------------------------------------------------------------

async def run_bpbp_update() -> Dict[str, Any]:
    """
    Extend NDR_BP_SP_history with new weekly rows.

    1. Find last date in NDR_BP_SP_history
    2. Determine missing Fridays up to today
    3. For each missing Friday: fetch bulk data for that Friday + previous Friday
    4. Compute weekly breadth (BP_Raw, SP_Raw)
    5. Extend 21-week SMA to get Buying_Power, Selling_Pressure
    6. Compute Signal, equity curves, drawdowns
    7. INSERT new rows into NDR_BP_SP_history
    """
    t0 = time.time()
    api_key = os.getenv("EODHD_API_KEY", "")
    if not api_key:
        return {"status": "FAIL", "error": "EODHD_API_KEY not set"}

    conn = _connect()

    try:
        last_date = _get_last_ndr_date(conn)
        logger.info(f"BPBP update: last NDR date = {last_date}")

        # Get missing Fridays
        missing_fridays = _fridays_after(last_date)
        if not missing_fridays:
            elapsed = round((time.time() - t0) * 1000)
            return {
                "status": "OK",
                "message": f"Already up to date (latest: {last_date})",
                "weeks_added": 0,
                "latest_date": str(last_date),
                "execution_ms": elapsed,
            }

        logger.info(f"BPBP update: {len(missing_fridays)} weeks to compute ({missing_fridays[0]} → {missing_fridays[-1]})")

        # Load SMA history for continuation
        bp_sp_history = _get_recent_bp_sp_raw(conn, SMA_WINDOW)
        equity_state = _get_last_equity_state(conn)

        # Fetch S&P 500 index (GSPC.INDX) OHLC for the entire range
        spy_from = str(missing_fridays[0] - timedelta(days=7))
        spy_to = str(missing_fridays[-1])
        spy_ohlc = _fetch_spy_ohlc(api_key, spy_from, spy_to)

        # Get previous SPX close for return computation
        prev_spx_row = conn.execute(
            f"SELECT SPX_Close FROM NDR_BP_SP_history WHERE Date = '{last_date}'"
        ).fetchone()
        prev_spx_close = float(prev_spx_row[0]) if prev_spx_row and prev_spx_row[0] else 0.0

        # We need the previous Friday's bulk data for the first missing week
        prev_friday = last_date
        prev_friday_data = None  # Will fetch on first iteration

        weeks_added = 0
        errors = []

        for friday in missing_fridays:
            try:
                # Fetch current Friday's bulk data
                friday_str = str(friday)
                logger.info(f"  Processing week ending {friday_str}...")

                friday_data = _fetch_bulk_day(api_key, friday_str)
                if not friday_data:
                    logger.warning(f"  No data for {friday_str} (holiday?), skipping")
                    errors.append(f"{friday_str}: no data (holiday?)")
                    continue

                # Fetch previous Friday's bulk data if not cached
                prev_str = str(prev_friday)
                if prev_friday_data is None:
                    prev_friday_data = _fetch_bulk_day(api_key, prev_str)
                    if not prev_friday_data:
                        logger.warning(f"  No prev data for {prev_str}, skipping week")
                        errors.append(f"{friday_str}: no prev data for {prev_str}")
                        prev_friday = friday
                        prev_friday_data = friday_data
                        continue

                # Compute weekly breadth
                breadth = _compute_weekly_breadth(friday_data, prev_friday_data)

                if breadth["total_vol"] <= 0:
                    logger.warning(f"  Zero total volume for {friday_str}, skipping")
                    errors.append(f"{friday_str}: zero volume")
                    prev_friday = friday
                    prev_friday_data = friday_data
                    continue

                bp_raw = breadth["up_vol"] / breadth["total_vol"]
                sp_raw = breadth["down_vol"] / breadth["total_vol"]

                # Extend SMA history
                bp_sp_history.append((bp_raw, sp_raw))
                if len(bp_sp_history) > SMA_WINDOW:
                    bp_sp_history = bp_sp_history[-SMA_WINDOW:]

                # Compute 21-week SMA
                buying_power = sum(h[0] for h in bp_sp_history) / len(bp_sp_history)
                selling_pressure = sum(h[1] for h in bp_sp_history) / len(bp_sp_history)
                bpsp_ratio = buying_power / selling_pressure if selling_pressure > 0 else 0

                # Signal: BP > SP
                signal = 1 if buying_power > selling_pressure else 0

                # SPX OHLC from S&P 500 index data (GSPC.INDX)
                spy_day = spy_ohlc.get(friday_str, {})
                # If exact Friday not available, try nearby days
                if not spy_day:
                    for delta in range(-1, -4, -1):
                        alt_date = str(friday + timedelta(days=delta))
                        spy_day = spy_ohlc.get(alt_date, {})
                        if spy_day:
                            break

                spx_open = spy_day.get("open", 0)
                spx_high = spy_day.get("high", 0)
                spx_low = spy_day.get("low", 0)
                spx_close = spy_day.get("close", 0) or spy_day.get("adj_close", 0)
                spx_adj = spy_day.get("adj_close", 0) or spx_close
                spx_volume = spy_day.get("volume", 0)

                # Compute returns + equity continuation
                if prev_spx_close > 0 and spx_close > 0:
                    spx_return = (spx_close / prev_spx_close) - 1.0
                else:
                    spx_return = 0.0

                # Strategy return: SPX return if previous signal was 1 (in market), else 0
                prev_signal = equity_state["signal"]
                strat_return = spx_return if prev_signal == 1 else 0.0

                # Update equity
                spx_equity = equity_state["spx_equity"] * (1 + spx_return)
                strat_equity = equity_state["strat_equity"] * (1 + strat_return)

                # Update peaks and drawdowns
                spx_peak = max(equity_state["spx_peak"], spx_equity)
                strat_peak = max(equity_state["strat_peak"], strat_equity)
                spx_drawdown = (spx_equity / spx_peak - 1) * 100 if spx_peak > 0 else 0
                strat_drawdown = (strat_equity / strat_peak - 1) * 100 if strat_peak > 0 else 0

                # Net advances and total points for breadth columns
                net_advances = breadth["advancing"] - breadth["declining"]
                total_points = breadth["pts_gained"] + breadth["pts_lost"]

                # INSERT new row
                conn.execute("""
                    INSERT INTO NDR_BP_SP_history (
                        Date, Advancing_Issues, Declining_Issues,
                        Points_Gained, Points_Lost,
                        Up_Volume, Down_Volume, Total_Volume,
                        BP_Raw, SP_Raw,
                        Buying_Power, Selling_Pressure, BPSP_Ratio,
                        Net_Advances, Total_Points,
                        SPX_Close, SPX_High, SPX_Low, SPX_Open,
                        SPX_Volume, SPX_Adj_Close,
                        Signal, SPX_Return, Strategy_Return,
                        SPX_Equity, Strategy_Equity,
                        SPX_Peak, SPX_Drawdown,
                        Strategy_Peak, Strategy_Drawdown
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, [
                    friday_str,
                    breadth["advancing"], breadth["declining"],
                    breadth["pts_gained"], breadth["pts_lost"],
                    breadth["up_vol"], breadth["down_vol"], breadth["total_vol"],
                    bp_raw, sp_raw,
                    buying_power, selling_pressure, bpsp_ratio,
                    net_advances, total_points,
                    spx_close, spx_high, spx_low, spx_open,
                    spx_volume, spx_adj,
                    signal, spx_return, strat_return,
                    spx_equity, strat_equity,
                    spx_peak, spx_drawdown,
                    strat_peak, strat_drawdown,
                ])

                weeks_added += 1
                logger.info(
                    f"  ✓ {friday_str}: BP={buying_power:.4f} SP={selling_pressure:.4f} "
                    f"Signal={'BULL' if signal else 'BEAR'} "
                    f"SPX=${spx_close:,.2f} Eq=${strat_equity:,.2f}"
                )

                # Update state for next iteration
                equity_state = {
                    "signal": signal,
                    "spx_equity": spx_equity,
                    "strat_equity": strat_equity,
                    "spx_peak": spx_peak,
                    "strat_peak": strat_peak,
                }
                prev_friday = friday
                prev_friday_data = friday_data
                prev_spx_close = spx_close

                # Rate limit (EODHD: 2 bulk calls per week iteration)
                time.sleep(0.1)

            except Exception as e:
                logger.error(f"  Error processing {friday}: {e}")
                errors.append(f"{friday}: {str(e)[:200]}")
                prev_friday = friday
                prev_friday_data = None  # Reset to re-fetch next time
                continue

        # Invalidate bpbp cache so next API call gets fresh data
        try:
            from pathlib import Path
            cache_file = Path("/tmp/jcn_bpbp/bpbp_full.json")
            if cache_file.exists():
                cache_file.unlink()
                logger.info("BPBP cache cleared")
        except Exception:
            pass

        elapsed = round((time.time() - t0) * 1000)
        new_latest = str(missing_fridays[-1]) if weeks_added > 0 else str(last_date)

        return {
            "status": "OK" if not errors else "PARTIAL",
            "weeks_added": weeks_added,
            "weeks_attempted": len(missing_fridays),
            "latest_date": new_latest,
            "previous_latest": str(last_date),
            "errors": errors if errors else None,
            "execution_ms": elapsed,
        }

    finally:
        conn.close()
