"""
Volume Backfill Script — Populate volume column in DEV + PROD tables.

Strategy: Use EODHD bulk endpoint (/eod-bulk-last-day/US?date=YYYY-MM-DD)
to fetch all symbols' volume for each trading day, then UPDATE rows in both
DEV_EOD_survivorship, PROD_EOD_survivorship, DEV_EOD_ETFs, PROD_EOD_ETFs.

Usage:
    python scripts/backfill_volume.py

    Environment:
        MOTHERDUCK_TOKEN  — from .env.local or set directly
        EODHD_API_KEY     — your EODHD API key

    The script:
    1. Finds all distinct trading dates in PROD_EOD_survivorship
    2. Iterates each date, calling EODHD bulk endpoint
    3. Batch UPDATEs volume for all symbols on that date
    4. Saves progress to /tmp/volume_backfill_cursor.txt (resumable)
    5. Rate-limited to ~15 calls/sec (0.07s delay)

    Expected runtime: ~3-5 hours for full history (16K+ trading days)
    Can be safely interrupted and resumed.
"""

import os
import sys
import time
import json
import logging
import requests
from pathlib import Path
from datetime import datetime

# Load .env.local from project root
try:
    from dotenv import load_dotenv
    root = Path(__file__).resolve().parent.parent
    load_dotenv(root / ".env.local")
except Exception:
    pass

import duckdb

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN", "")
EODHD_API_KEY = os.getenv("EODHD_API_KEY", "")
EODHD_BULK_URL = "https://eodhd.com/api/eod-bulk-last-day/US"
RATE_LIMIT_DELAY = 0.07  # seconds between API calls (~14/sec, under 1000/min)
REQUEST_TIMEOUT = 30
CURSOR_FILE = Path("/tmp/volume_backfill_cursor.txt")
BATCH_LOG_INTERVAL = 50  # Log progress every N dates

# Tables to update (survivorship + ETFs, both DEV and PROD)
SURV_TABLES = [
    "DEV_EODHD_DATA.main.DEV_EOD_survivorship",
    "PROD_EODHD.main.PROD_EOD_survivorship",
]
ETF_TABLES = [
    "DEV_EODHD_DATA.main.DEV_EOD_ETFs",
    "PROD_EODHD.main.PROD_EOD_ETFs",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/tmp/volume_backfill.log"),
    ],
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _connect():
    """Connect to MotherDuck."""
    return duckdb.connect(f"md:?motherduck_token={MOTHERDUCK_TOKEN}")


def _load_cursor() -> str | None:
    """Load last completed date from cursor file (for resume)."""
    if CURSOR_FILE.exists():
        text = CURSOR_FILE.read_text().strip()
        if text:
            return text
    return None


def _save_cursor(date_str: str):
    """Save last completed date to cursor file."""
    CURSOR_FILE.write_text(date_str)


def _fetch_bulk_volume(date_str: str) -> dict:
    """Fetch volume data from EODHD bulk endpoint for a single date.
    
    Returns dict: { 'AAPL.US': 123456.0, 'TSLA.US': 789012.0, ... }
    """
    url = f"{EODHD_BULK_URL}?api_token={EODHD_API_KEY}&fmt=json&date={date_str}"
    resp = requests.get(url, timeout=REQUEST_TIMEOUT)
    if resp.status_code != 200:
        raise Exception(f"EODHD HTTP {resp.status_code} for {date_str}")
    
    data = resp.json()
    if not isinstance(data, list):
        return {}
    
    volumes = {}
    for record in data:
        code = record.get("code", "")
        if not code:
            continue
        symbol = f"{code}.US" if not code.endswith(".US") else code
        vol = record.get("volume")
        if vol is not None:
            try:
                volumes[symbol] = float(vol)
            except (ValueError, TypeError):
                pass
    return volumes


def _batch_update_volume(conn, table: str, date_str: str, volumes: dict) -> int:
    """UPDATE volume for all symbols on a given date in one table.
    
    Uses a temporary table + UPDATE FROM pattern for efficiency.
    Returns number of rows updated.
    """
    if not volumes:
        return 0
    
    # Create temp table with volume data
    temp_data = [(sym, vol) for sym, vol in volumes.items()]
    conn.execute("CREATE OR REPLACE TEMP TABLE _vol_batch (symbol VARCHAR, volume DOUBLE)")
    conn.executemany("INSERT INTO _vol_batch VALUES (?, ?)", temp_data)
    
    # UPDATE using join
    result = conn.execute(f"""
        UPDATE {table} t
        SET volume = b.volume
        FROM _vol_batch b
        WHERE t.symbol = b.symbol AND t.date = '{date_str}' AND t.volume IS NULL
    """)
    
    updated = result.fetchone()[0] if result.description else 0
    conn.execute("DROP TABLE IF EXISTS _vol_batch")
    return updated


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not MOTHERDUCK_TOKEN:
        log.error("MOTHERDUCK_TOKEN not set")
        sys.exit(1)
    if not EODHD_API_KEY:
        log.error("EODHD_API_KEY not set")
        sys.exit(1)
    
    log.info("=" * 60)
    log.info("Volume Backfill Script — Starting")
    log.info("=" * 60)
    
    conn = _connect()
    
    # Get all distinct trading dates
    log.info("Loading trading dates from PROD_EOD_survivorship...")
    dates = conn.execute("""
        SELECT DISTINCT date FROM PROD_EODHD.main.PROD_EOD_survivorship
        WHERE volume IS NULL
        ORDER BY date ASC
    """).fetchall()
    all_dates = [str(r[0]) for r in dates]
    log.info(f"Found {len(all_dates)} dates with NULL volume")
    
    # Check cursor for resume
    cursor = _load_cursor()
    if cursor:
        before = len(all_dates)
        all_dates = [d for d in all_dates if d > cursor]
        log.info(f"Resuming after {cursor} — {before - len(all_dates)} dates already done, {len(all_dates)} remaining")
    
    if not all_dates:
        log.info("No dates to backfill — all done!")
        conn.close()
        return
    
    # Stats
    t0 = time.time()
    total_updated = 0
    api_calls = 0
    errors = 0
    
    for i, date_str in enumerate(all_dates):
        try:
            # Fetch volume from EODHD
            volumes = _fetch_bulk_volume(date_str)
            api_calls += 1
            
            if volumes:
                # Update all 4 tables
                for table in SURV_TABLES + ETF_TABLES:
                    try:
                        _batch_update_volume(conn, table, date_str, volumes)
                    except Exception as e:
                        # Log but continue — don't let one table failure stop the whole run
                        log.warning(f"  UPDATE failed for {table} on {date_str}: {e}")
                
                total_updated += len(volumes)
            
            _save_cursor(date_str)
            
            # Progress logging
            if (i + 1) % BATCH_LOG_INTERVAL == 0:
                elapsed = time.time() - t0
                rate = (i + 1) / elapsed * 60 if elapsed > 0 else 0
                remaining = len(all_dates) - (i + 1)
                eta_min = remaining / rate if rate > 0 else 0
                log.info(
                    f"  Progress: {i+1}/{len(all_dates)} dates "
                    f"({(i+1)/len(all_dates)*100:.1f}%) | "
                    f"{rate:.0f} dates/min | "
                    f"ETA: {eta_min:.0f} min | "
                    f"Errors: {errors}"
                )
            
            # Rate limit
            time.sleep(RATE_LIMIT_DELAY)
            
        except requests.Timeout:
            log.warning(f"  Timeout on {date_str} — skipping")
            errors += 1
            time.sleep(1)  # Extra delay after timeout
        except Exception as e:
            log.error(f"  Error on {date_str}: {e}")
            errors += 1
            time.sleep(0.5)
    
    elapsed = time.time() - t0
    conn.close()
    
    log.info("=" * 60)
    log.info(f"Backfill Complete!")
    log.info(f"  Dates processed: {len(all_dates)}")
    log.info(f"  API calls: {api_calls}")
    log.info(f"  Total volume records: {total_updated:,}")
    log.info(f"  Errors: {errors}")
    log.info(f"  Elapsed: {elapsed/60:.1f} minutes")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
