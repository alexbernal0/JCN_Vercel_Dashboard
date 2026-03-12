"""
Stage 1 — Ingest: EODHD bulk download to DEV staging tables.

Downloads daily EOD prices for all US symbols via EODHD bulk endpoint.
Separates stocks from ETFs. Validates inline. Idempotent (skips existing dates).

Prime Directive: PD-01 (never delete), PD-03 (symbol .US), PD-06 (filter MF/OTC),
PD-07 (idempotent), PD-08 (cursor persistence).

Vercel Pro: maxDuration 300s. Budget 280s with 20s safety buffer.
"""

import os
import time
import duckdb
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any

os.environ.setdefault("HOME", "/tmp")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
EODHD_BULK_URL = "https://eodhd.com/api/eod-bulk-last-day/US"
OVERALL_BUDGET_SECONDS = 280  # 300s Vercel limit minus 20s buffer
REQUEST_TIMEOUT = 60  # Per-API-call timeout

# Exchanges to filter out (PD-06: no MF/OTC/warrants)
FILTERED_EXCHANGES = {"NMFQS", "PINK"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _connect(token: str) -> duckdb.DuckDBPyConnection:
    """Connect to MotherDuck. Raises on failure."""
    return duckdb.connect(f"md:?motherduck_token={token}")


def _trading_days(start_date, end_date) -> List:
    """Return weekday dates between start (exclusive) and end (inclusive)."""
    days = []
    current = start_date + timedelta(days=1)
    while current <= end_date:
        if current.weekday() < 5:  # Mon=0 ... Fri=4
            days.append(current)
        current += timedelta(days=1)
    return days


# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

def _preflight(token: str, api_key: str) -> Tuple[Dict, Optional[duckdb.DuckDBPyConnection]]:
    """Validate MotherDuck + EODHD connectivity. Returns (results_dict, conn_or_None)."""
    results = {}

    # 1. MotherDuck
    t0 = time.time()
    try:
        conn = _connect(token)
        conn.execute("SELECT 1")
        ms = round((time.time() - t0) * 1000)
        results["motherduck"] = {"status": "PASS", "message": f"Connected ({ms}ms)", "latency_ms": ms}
    except Exception as e:
        ms = round((time.time() - t0) * 1000)
        results["motherduck"] = {"status": "FAIL", "message": f"Connection failed: {str(e)[:200]}", "latency_ms": ms}
        results["eodhd_api"] = {"status": "SKIP", "message": "Skipped (MotherDuck failed)"}
        return results, None

    # 2. EODHD API key
    t0 = time.time()
    try:
        resp = requests.get(
            f"https://eodhd.com/api/eod/AAPL.US?api_token={api_key}&fmt=json&limit=1",
            timeout=10,
        )
        ms = round((time.time() - t0) * 1000)
        if resp.status_code == 200 and isinstance(resp.json(), list) and len(resp.json()) > 0:
            results["eodhd_api"] = {"status": "PASS", "message": f"API key valid ({ms}ms)", "latency_ms": ms}
        elif resp.status_code == 401:
            results["eodhd_api"] = {"status": "FAIL", "message": "API key rejected (401)", "latency_ms": ms}
            conn.close()
            return results, None
        else:
            results["eodhd_api"] = {"status": "FAIL", "message": f"HTTP {resp.status_code}", "latency_ms": ms}
            conn.close()
            return results, None
    except Exception as e:
        ms = round((time.time() - t0) * 1000)
        results["eodhd_api"] = {"status": "FAIL", "message": f"API error: {str(e)[:200]}", "latency_ms": ms}
        conn.close()
        return results, None

    return results, conn


# ---------------------------------------------------------------------------
# Sync window calculation
# ---------------------------------------------------------------------------

def _calc_sync_window(conn: duckdb.DuckDBPyConnection) -> Dict:
    """Determine which trading days need syncing."""
    try:
        row = conn.execute("SELECT MAX(date) FROM DEV_EODHD_DATA.main.DEV_EOD_survivorship").fetchone()
        last_date = row[0] if row and row[0] else None
        if last_date and hasattr(last_date, "date"):
            last_date = last_date.date()
    except Exception as e:
        return {"status": "FAIL", "message": f"Cannot read DEV table: {str(e)[:200]}",
                "last_date": None, "today": None, "trading_days": []}

    today = datetime.now(timezone.utc).date()

    if last_date is None:
        return {"status": "FAIL", "message": "DEV_EOD_survivorship is empty — run initial load first",
                "last_date": None, "today": str(today), "trading_days": []}

    days = _trading_days(last_date, today)

    return {
        "status": "PASS" if days else "INFO",
        "message": f"{len(days)} trading day(s) to sync ({last_date} → {today})" if days
                   else f"Already up to date (latest: {last_date})",
        "last_date": str(last_date),
        "today": str(today),
        "trading_days": [str(d) for d in days],
    }


# ---------------------------------------------------------------------------
# ETF symbol set (for routing)
# ---------------------------------------------------------------------------

def _load_etf_symbols(conn: duckdb.DuckDBPyConnection) -> set:
    """Load known ETF symbols from DEV_EOD_ETFs for routing."""
    try:
        rows = conn.execute("SELECT DISTINCT symbol FROM DEV_EODHD_DATA.main.DEV_EOD_ETFs").fetchall()
        return {r[0] for r in rows}
    except Exception:
        return set()


# ---------------------------------------------------------------------------
# Download + validate + insert one day
# ---------------------------------------------------------------------------

def _ingest_one_day(conn: duckdb.DuckDBPyConnection, api_key: str,
                    date_str: str, etf_symbols: set) -> Dict:
    """Download EODHD bulk for one date, validate, insert into DEV. Idempotent."""
    batch = {
        "date": date_str,
        "rows_downloaded": 0,
        "stocks_inserted": 0,
        "etfs_inserted": 0,
        "skipped_existing": False,
        "validation": {
            "nulls_blocked": 0, "price_lte_0": 0,
            "mf_otc_filtered": 0, "exchange_filtered": 0,
        },
    }

    # Idempotency check (PD-07): skip if date already has data
    try:
        existing = conn.execute(
            f"SELECT COUNT(*) FROM DEV_EODHD_DATA.main.DEV_EOD_survivorship WHERE date = '{date_str}'"
        ).fetchone()[0]
        if existing > 0:
            batch["skipped_existing"] = True
            batch["message"] = f"Skipped — already {existing:,} rows for {date_str}"
            return batch
    except Exception:
        pass  # Continue even if check fails

    # Download from EODHD bulk endpoint
    try:
        url = f"{EODHD_BULK_URL}?api_token={api_key}&fmt=json&date={date_str}"
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            batch["error"] = f"EODHD returned HTTP {resp.status_code}"
            return batch
        data = resp.json()
        if not isinstance(data, list):
            batch["error"] = "Unexpected response format (not a list)"
            return batch
        batch["rows_downloaded"] = len(data)
    except requests.Timeout:
        batch["error"] = f"EODHD timeout after {REQUEST_TIMEOUT}s"
        return batch
    except Exception as e:
        batch["error"] = f"Download failed: {str(e)[:200]}"
        return batch

    if len(data) == 0:
        batch["message"] = f"No data available for {date_str} (holiday or not yet published)"
        return batch

    # Process and validate each record
    stock_rows = []
    etf_rows = []

    for record in data:
        code = record.get("code", "")
        if not code:
            batch["validation"]["nulls_blocked"] += 1
            continue

        # Normalize symbol to .US format (PD-03)
        symbol = f"{code}.US" if not code.endswith(".US") else code

        # Filter exchanges (PD-06)
        exchange = record.get("exchange_short_name", "")
        if exchange in FILTERED_EXCHANGES:
            batch["validation"]["exchange_filtered"] += 1
            continue

        # Parse prices safely
        try:
            open_p = float(record.get("open") or 0)
            high_p = float(record.get("high") or 0)
            low_p = float(record.get("low") or 0)
            close_p = float(record.get("close") or 0)
            adj_close = float(record.get("adjusted_close") or 0)
            volume_raw = record.get("volume")
            volume = float(volume_raw) if volume_raw is not None else None
        except (ValueError, TypeError):
            batch["validation"]["nulls_blocked"] += 1
            continue

        # Track price anomalies (don't block — EODHD artifacts on delisted stocks)
        if adj_close <= 0:
            batch["validation"]["price_lte_0"] += 1

        # Route to ETF or stock table
        row = (symbol, date_str, open_p, high_p, low_p, close_p, adj_close, volume)
        if symbol in etf_symbols:
            etf_rows.append(row + (None,))  # isin column
        else:
            stock_rows.append(row)

    # Batch INSERT into DEV_EOD_survivorship
    if stock_rows:
        try:
            conn.executemany(
                """INSERT INTO DEV_EODHD_DATA.main.DEV_EOD_survivorship
                   (symbol, date, open, high, low, close, adjusted_close, volume)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                stock_rows,
            )
            batch["stocks_inserted"] = len(stock_rows)
        except Exception as e:
            batch["error"] = f"Stock INSERT failed: {str(e)[:200]}"
            return batch

    # Batch INSERT into DEV_EOD_ETFs
    if etf_rows:
        try:
            conn.executemany(
                """INSERT INTO DEV_EODHD_DATA.main.DEV_EOD_ETFs
                   (symbol, date, open, high, low, close, adjusted_close, volume, isin)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                etf_rows,
            )
            batch["etfs_inserted"] = len(etf_rows)
        except Exception as e:
            batch["error"] = f"ETF INSERT failed: {str(e)[:200]}"
            # Don't return — stock insert already succeeded

    return batch


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

async def run_stage1() -> Dict:
    """
    Stage 1 orchestrator. Returns structured JSON for frontend rendering.
    
    Flow:
    1. Pre-flight (MotherDuck + EODHD connectivity)
    2. Sync window calculation (MAX(date) in DEV → today)
    3. Load ETF symbol set for routing
    4. Download + validate + insert for each trading day
    5. Return verbose results
    """
    t0 = time.time()
    
    # Get credentials
    token = os.getenv("MOTHERDUCK_TOKEN", "")
    api_key = os.getenv("EODHD_API_KEY", "")
    
    if not token:
        return {
            "stage": 1, "overall_status": "FAIL",
            "preflight": {"motherduck": {"status": "FAIL", "message": "MOTHERDUCK_TOKEN not set"}},
            "sync_window": {}, "batches": [], "summary": {},
            "can_proceed": False, "execution_ms": round((time.time() - t0) * 1000),
        }
    if not api_key:
        return {
            "stage": 1, "overall_status": "FAIL",
            "preflight": {"eodhd_api": {"status": "FAIL", "message": "EODHD_API_KEY not set"}},
            "sync_window": {}, "batches": [], "summary": {},
            "can_proceed": False, "execution_ms": round((time.time() - t0) * 1000),
        }

    result: Dict[str, Any] = {
        "stage": 1,
        "overall_status": "PASS",
        "preflight": {},
        "sync_window": {},
        "batches": [],
        "summary": {},
        "can_proceed": True,
        "execution_ms": 0,
    }
    
    conn = None
    try:
        # ── Pre-flight ──
        preflight, conn = _preflight(token, api_key)
        result["preflight"] = preflight
        if conn is None:
            result["overall_status"] = "FAIL"
            result["can_proceed"] = False
            result["execution_ms"] = round((time.time() - t0) * 1000)
            return result

        # ── Sync window ──
        sw = _calc_sync_window(conn)
        result["sync_window"] = sw

        if sw["status"] == "FAIL":
            result["overall_status"] = "FAIL"
            result["can_proceed"] = False
            result["execution_ms"] = round((time.time() - t0) * 1000)
            return result

        if not sw["trading_days"]:
            result["summary"] = {
                "message": "No new trading days — database is current",
                "trading_days_synced": 0,
                "total_downloaded": 0,
                "total_stocks_inserted": 0,
                "total_etfs_inserted": 0,
                "gate_passed": True,
            }
            result["execution_ms"] = round((time.time() - t0) * 1000)
            return result

        # ── Load ETF symbols ──
        etf_symbols = _load_etf_symbols(conn)

        # ── Get pre-sync row counts for reporting ──
        try:
            stocks_before = conn.execute(
                "SELECT COUNT(*) FROM DEV_EODHD_DATA.main.DEV_EOD_survivorship"
            ).fetchone()[0]
            etfs_before = conn.execute(
                "SELECT COUNT(*) FROM DEV_EODHD_DATA.main.DEV_EOD_ETFs"
            ).fetchone()[0]
        except Exception:
            stocks_before = 0
            etfs_before = 0

        # ── Download and insert each trading day ──
        total_stocks = 0
        total_etfs = 0
        total_downloaded = 0
        has_error = False
        days_synced = 0

        for date_str in sw["trading_days"]:
            # Budget check
            elapsed = time.time() - t0
            if elapsed > OVERALL_BUDGET_SECONDS:
                result["batches"].append({
                    "date": date_str,
                    "error": f"Time budget exhausted ({OVERALL_BUDGET_SECONDS}s) — remaining days skipped",
                })
                has_error = True
                break

            batch = _ingest_one_day(conn, api_key, date_str, etf_symbols)
            result["batches"].append(batch)

            if "error" in batch:
                has_error = True
            elif not batch.get("skipped_existing", False):
                total_stocks += batch.get("stocks_inserted", 0)
                total_etfs += batch.get("etfs_inserted", 0)
                total_downloaded += batch.get("rows_downloaded", 0)
                days_synced += 1

        # ── Post-sync row counts ──
        try:
            stocks_after = conn.execute(
                "SELECT COUNT(*) FROM DEV_EODHD_DATA.main.DEV_EOD_survivorship"
            ).fetchone()[0]
            etfs_after = conn.execute(
                "SELECT COUNT(*) FROM DEV_EODHD_DATA.main.DEV_EOD_ETFs"
            ).fetchone()[0]
        except Exception:
            stocks_after = stocks_before + total_stocks
            etfs_after = etfs_before + total_etfs

        # ── Summary ──
        result["summary"] = {
            "trading_days_synced": days_synced,
            "total_downloaded": total_downloaded,
            "total_stocks_inserted": total_stocks,
            "total_etfs_inserted": total_etfs,
            "etf_symbols_known": len(etf_symbols),
            "stocks_before": stocks_before,
            "stocks_after": stocks_after,
            "etfs_before": etfs_before,
            "etfs_after": etfs_after,
            "gate_passed": not has_error,
        }

        if has_error:
            result["overall_status"] = "WARN"
        result["can_proceed"] = not has_error

    except Exception as e:
        result["overall_status"] = "FAIL"
        result["summary"] = {"error": str(e)[:500]}
        result["can_proceed"] = False
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        result["execution_ms"] = round((time.time() - t0) * 1000)

    return result
