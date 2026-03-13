"""
Volume Backfill Script — Populate volume column in DEV + PROD tables.

Strategy: Use EODHD bulk endpoint (/eod-bulk-last-day/US?date=YYYY-MM-DD)
to fetch all symbols' volume for each trading day, then UPDATE per-date
using a temp table + UPDATE FROM pattern.

Benchmarked: ~6.5s per date across 4 tables on MotherDuck.
16,294 dates × 6.5s ≈ 29 hours. Resumable via cursor file.

Usage:
    python scripts/backfill_volume.py

    Environment:
        MOTHERDUCK_TOKEN  — from .env.local or set directly
        EODHD_API_KEY     — your EODHD API key
"""

import os
import sys
import time
import logging
import requests
from pathlib import Path

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
RATE_LIMIT_DELAY = 0.07  # seconds between API calls (~14/sec)
REQUEST_TIMEOUT = 30
CURSOR_FILE = Path("/tmp/volume_backfill_cursor.txt")
LOG_INTERVAL = 25  # Log progress every N dates

# Tables to update
ALL_TABLES = [
    "PROD_EODHD.main.PROD_EOD_survivorship",
    "DEV_EODHD_DATA.main.DEV_EOD_survivorship",
    "PROD_EODHD.main.PROD_EOD_ETFs",
    "DEV_EODHD_DATA.main.DEV_EOD_ETFs",
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
    return duckdb.connect(f"md:?motherduck_token={MOTHERDUCK_TOKEN}")


def _load_cursor():
    if CURSOR_FILE.exists():
        text = CURSOR_FILE.read_text().strip()
        if text:
            return text
    return None


def _save_cursor(date_str: str):
    CURSOR_FILE.write_text(date_str)


def _fetch_bulk_volume(date_str: str) -> dict:
    """Fetch {symbol: volume} from EODHD bulk endpoint for one date."""
    url = f"{EODHD_BULK_URL}?api_token={EODHD_API_KEY}&fmt=json&date={date_str}"
    resp = requests.get(url, timeout=REQUEST_TIMEOUT)
    if resp.status_code != 200:
        raise Exception(f"EODHD HTTP {resp.status_code} for {date_str}")
    data = resp.json()
    if not isinstance(data, list):
        return {}
    volumes = {}
    for rec in data:
        code = rec.get("code", "")
        if not code:
            continue
        sym = f"{code}.US" if not code.endswith(".US") else code
        vol = rec.get("volume")
        if vol is not None:
            try:
                volumes[sym] = float(vol)
            except (ValueError, TypeError):
                pass
    return volumes


def _update_one_date(conn, date_str: str, volumes: dict):
    """UPDATE volume for one date across all 4 tables using temp table."""
    if not volumes:
        return
    temp_data = [(sym, vol) for sym, vol in volumes.items()]
    conn.execute("CREATE OR REPLACE TEMP TABLE _vb (symbol VARCHAR, volume DOUBLE)")
    conn.executemany("INSERT INTO _vb VALUES (?, ?)", temp_data)
    for table in ALL_TABLES:
        try:
            conn.execute(f"""
                UPDATE {table} t
                SET volume = b.volume
                FROM _vb b
                WHERE t.symbol = b.symbol AND t.date = '{date_str}' AND t.volume IS NULL
            """)
        except Exception as e:
            log.warning(f"  UPDATE failed for {table} on {date_str}: {e}")
    conn.execute("DROP TABLE IF EXISTS _vb")


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
    log.info(f"  ~6.5s per date x 4 tables on MotherDuck")
    log.info(f"  Resumable via cursor at {CURSOR_FILE}")
    log.info("=" * 60)

    conn = _connect()

    log.info("Loading trading dates with NULL volume...")
    dates = conn.execute("""
        SELECT DISTINCT date FROM PROD_EODHD.main.PROD_EOD_survivorship
        WHERE volume IS NULL
        ORDER BY date ASC
    """).fetchall()
    all_dates = [str(r[0]) for r in dates]
    log.info(f"Found {len(all_dates):,} dates with NULL volume")

    cursor = _load_cursor()
    if cursor:
        before = len(all_dates)
        all_dates = [d for d in all_dates if d > cursor]
        log.info(f"Resuming after {cursor} -- {before - len(all_dates):,} done, {len(all_dates):,} remaining")

    if not all_dates:
        log.info("No dates to backfill -- all done!")
        conn.close()
        return

    t0 = time.time()
    total_vols = 0
    errors = 0

    for i, date_str in enumerate(all_dates):
        try:
            volumes = _fetch_bulk_volume(date_str)
            if volumes:
                _update_one_date(conn, date_str, volumes)
                total_vols += len(volumes)

            _save_cursor(date_str)

            if (i + 1) % LOG_INTERVAL == 0:
                elapsed = time.time() - t0
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                remaining = len(all_dates) - (i + 1)
                eta_hrs = remaining / rate / 3600 if rate > 0 else 0
                log.info(
                    f"  {i+1:,}/{len(all_dates):,} "
                    f"({(i+1)/len(all_dates)*100:.1f}%) | "
                    f"{rate:.1f} dates/s | "
                    f"ETA: {eta_hrs:.1f}h | "
                    f"Errors: {errors}"
                )

            time.sleep(RATE_LIMIT_DELAY)

        except requests.Timeout:
            log.warning(f"  Timeout on {date_str} -- skipping")
            errors += 1
            _save_cursor(date_str)
            time.sleep(2)
        except Exception as e:
            log.error(f"  Error on {date_str}: {e}")
            errors += 1
            _save_cursor(date_str)
            time.sleep(1)

    elapsed = time.time() - t0
    conn.close()

    log.info("=" * 60)
    log.info("Backfill Complete!")
    log.info(f"  Dates processed: {len(all_dates):,}")
    log.info(f"  Volume records:  {total_vols:,}")
    log.info(f"  Errors:          {errors}")
    log.info(f"  Elapsed:         {elapsed/3600:.1f} hours ({elapsed/60:.0f} min)")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
