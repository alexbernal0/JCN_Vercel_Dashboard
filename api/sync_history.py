"""
Sync History — returns recent sync run summaries from PROD_SYNC_LOG.

Used by the Data Sync dashboard to show last sync time and recent history.
"""

import os
import time
import duckdb
from datetime import datetime, timezone
from typing import Dict, Any, List


def _connect(token: str) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(f"md:?motherduck_token={token}")


os.environ.setdefault("HOME", "/tmp")


async def get_sync_history(limit: int = 4) -> Dict[str, Any]:
    """
    Return the last N sync runs grouped by sync_date.

    Each run is one date where Stage 2 promoted data.
    We group PROD_SYNC_LOG by sync_date and aggregate.
    """
    t0 = time.time()
    token = os.getenv("MOTHERDUCK_TOKEN", "")
    if not token:
        return {
            "last_sync": None,
            "runs": [],
            "error": "MOTHERDUCK_TOKEN not set",
            "execution_ms": 0,
        }

    conn = None
    try:
        conn = _connect(token)

        # Get the last N sync runs (grouped by sync_date)
        rows = conn.execute(f"""
            SELECT
                sync_date,
                MAX(sync_timestamp) AS completed_at,
                SUM(records_inserted) AS total_records,
                COUNT(*) AS tables_promoted,
                MIN(status) AS worst_status,
                MAX(execution_time_seconds) AS duration_secs,
                MAX(executed_by) AS executed_by
            FROM PROD_EODHD.main.PROD_SYNC_LOG
            WHERE status = 'SUCCESS'
            GROUP BY sync_date
            ORDER BY sync_date DESC
            LIMIT {int(limit)}
        """).fetchall()

        runs: List[Dict[str, Any]] = []
        for r in rows:
            runs.append({
                "sync_date": str(r[0]) if r[0] else None,
                "completed_at": str(r[1]) if r[1] else None,
                "total_records": r[2] or 0,
                "tables_promoted": r[3] or 0,
                "status": r[4] or "UNKNOWN",
                "duration_secs": round(r[5], 1) if r[5] else 0,
                "executed_by": r[6] or "unknown",
            })

        # Get latest PROD data date for freshness
        prod_row = conn.execute("""
            SELECT MAX(date) FROM PROD_EODHD.main.PROD_EOD_survivorship
        """).fetchone()
        prod_date = str(prod_row[0]) if prod_row and prod_row[0] else None

        # Derive last_sync from most recent run
        last_sync = runs[0]["completed_at"] if runs else None

        return {
            "last_sync": last_sync,
            "prod_data_through": prod_date,
            "runs": runs,
            "execution_ms": round((time.time() - t0) * 1000),
        }

    except Exception as e:
        return {
            "last_sync": None,
            "prod_data_through": None,
            "runs": [],
            "error": str(e)[:300],
            "execution_ms": round((time.time() - t0) * 1000),
        }
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
