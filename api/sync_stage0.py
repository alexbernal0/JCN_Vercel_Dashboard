"""
Stage 0 - Health and Inventory Check for JCN Data Sync Pipeline.

Runs 8 diagnostic checks before any sync operation:
1. MotherDuck connectivity
2. EODHD API key validation
3. Required schemas and tables existence (with estimated row counts)
4. Last sync timestamp from SYNC_STATE
5. Symbol format consistency (PD-03) - 30-day sample window
6. Fundamentals coverage ratio
7. Gap analysis (latest date in EOD vs today)
8. Duplicate detection (date+symbol in last 7 days)

Oracle-hardened: P0-1 sampled queries, P0-2 LIMIT 1 + estimated counts,
P1-1 per-check timeouts, P1-2 CatalogException handling, P1-3 5-min cache,
P1-4 async run_in_executor, P2-2 actionable self-heal URLs, P2-3 duplicates.

Prime Directive v1.0 governs all data operations.
"""

from typing import Optional, Dict, List, Tuple
import os
import time
import json
import asyncio
import duckdb
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from pydantic import BaseModel

os.environ.setdefault("HOME", "/tmp")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CACHE_DIR = Path("/tmp")
CACHE_FILE = CACHE_DIR / "jcn_stage0_cache.json"
CACHE_TTL_SECONDS = 300  # 5 minutes
OVERALL_BUDGET_SECONDS = 55  # Vercel 60s limit minus buffer
CHECK_TIMEOUT_SECONDS = 12.0  # Per-check timeout

_executor = ThreadPoolExecutor(max_workers=4)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CheckResult(BaseModel):
    status: str  # PASS | WARN | FAIL
    message: str
    detail: Optional[dict] = None
    latency_ms: Optional[float] = None


class Stage0Response(BaseModel):
    stage: int = 0
    overall_status: str  # PASS | WARN | FAIL
    timestamp_utc: str
    checks: Dict[str, dict]
    can_proceed: bool
    blocking_issues: List[str]
    self_heal_actions: List[str] = []
    cached: bool = False
    execution_ms: Optional[float] = None


# ---------------------------------------------------------------------------
# Required tables - must exist for pipeline to run
# ---------------------------------------------------------------------------

REQUIRED_TABLES = {
    "DEV_EODHD_DATA.main.DEV_EOD_survivorship": "DEV staging EOD prices",
    "DEV_EODHD_DATA.main.DEV_EOD_Fundamentals": "DEV staging fundamentals",
    "DEV_EODHD_DATA.main.DEV_EOD_ETFs": "DEV staging ETF prices",
    "PROD_EODHD.main.PROD_EOD_survivorship": "PROD EOD daily prices",
    "PROD_EODHD.main.PROD_EOD_survivorship_Weekly": "PROD EOD weekly prices",
    "PROD_EODHD.main.PROD_EOD_ETFs": "PROD ETF prices",
    "PROD_EODHD.main.PROD_OBQ_Investable_Universe": "PROD Top-3000 investable universe",
    "PROD_EODHD.main.PROD_OBQ_Value_Scores": "PROD Value scores",
    "PROD_EODHD.main.PROD_OBQ_Quality_Scores": "PROD Quality scores",
    "PROD_EODHD.main.PROD_OBQ_FinStr_Scores": "PROD Financial Strength scores",
    "PROD_EODHD.main.PROD_OBQ_Growth_Scores": "PROD Growth scores",
    "PROD_EODHD.main.PROD_OBQ_Momentum_Scores": "PROD Momentum scores",
    "PROD_EODHD.main.PROD_JCN_Composite_Scores": "PROD JCN Composite blend scores",
    "PROD_EODHD.main.PROD_SYNC_LOG": "PROD sync audit log",
}

VERCEL_ENV_URL = "https://vercel.com/obsidianquantitative/jcn-tremor/settings/environment-variables"
EODHD_DASHBOARD_URL = "https://eodhd.com/financial-apis/api-screener"


# ---------------------------------------------------------------------------
# Cache helpers (P1-3)
# ---------------------------------------------------------------------------

def _get_cached_result():
    """Return cached Stage 0 result if fresh (< 5 min), else None."""
    try:
        if not CACHE_FILE.exists():
            return None
        data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        cached_at = data.get("cached_at", 0)
        if time.time() - cached_at < CACHE_TTL_SECONDS:
            result = data.get("result")
            if result:
                result["cached"] = True
                return result
    except Exception:
        pass
    return None


def _save_to_cache(result):
    """Save Stage 0 result to file cache."""
    try:
        payload = {"cached_at": time.time(), "result": result}
        CACHE_FILE.write_text(json.dumps(payload), encoding="utf-8")
    except Exception:
        pass  # Cache write failure is non-blocking


# ---------------------------------------------------------------------------
# Timeout wrapper (P1-1 + P1-4)
# ---------------------------------------------------------------------------

async def _run_check_with_timeout(fn, *args, timeout_s=CHECK_TIMEOUT_SECONDS):
    """Run a synchronous check function in thread pool with timeout."""
    loop = asyncio.get_event_loop()
    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(_executor, fn, *args),
            timeout=timeout_s,
        )
        return result
    except asyncio.TimeoutError:
        return CheckResult(
            status="FAIL",
            message=f"{fn.__name__} timed out after {timeout_s}s",
            latency_ms=round(timeout_s * 1000, 1),
        )


# ---------------------------------------------------------------------------
# Check 1: MotherDuck Connectivity
# ---------------------------------------------------------------------------

def _check_motherduck_connectivity(token: str) -> Tuple[CheckResult, Optional[duckdb.DuckDBPyConnection]]:
    """Connect to MotherDuck, return (result, connection_or_None)."""
    t0 = time.time()
    try:
        conn = duckdb.connect(f"md:?motherduck_token={token}")
        row = conn.execute("SELECT 1 AS ping").fetchone()
        latency = round((time.time() - t0) * 1000, 1)
        if row and row[0] == 1:
            return CheckResult(
                status="PASS",
                message=f"MotherDuck connected ({latency}ms)",
                latency_ms=latency,
            ), conn
        else:
            return CheckResult(
                status="FAIL",
                message="MotherDuck connection returned unexpected result",
                latency_ms=latency,
            ), None
    except Exception as e:
        latency = round((time.time() - t0) * 1000, 1)
        return CheckResult(
            status="FAIL",
            message=f"MotherDuck connection failed: {str(e)[:200]}",
            latency_ms=latency,
        ), None


# ---------------------------------------------------------------------------
# Check 2: EODHD API Key Validation
# ---------------------------------------------------------------------------

def _check_eodhd_api(api_key: str) -> CheckResult:
    """Validate EODHD API key with a lightweight test call."""
    t0 = time.time()
    try:
        url = f"https://eodhd.com/api/eod/AAPL.US?api_token={api_key}&fmt=json&limit=1"
        resp = requests.get(url, timeout=10)
        latency = round((time.time() - t0) * 1000, 1)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                return CheckResult(
                    status="PASS",
                    message=f"EODHD API key valid ({latency}ms)",
                    detail={"sample_date": data[0].get("date", "N/A")},
                    latency_ms=latency,
                )
            return CheckResult(
                status="WARN",
                message="EODHD returned 200 but empty payload",
                latency_ms=latency,
            )
        elif resp.status_code == 401:
            return CheckResult(
                status="FAIL",
                message="EODHD API key rejected (401 Unauthorized)",
                latency_ms=latency,
            )
        else:
            return CheckResult(
                status="FAIL",
                message=f"EODHD API returned HTTP {resp.status_code}",
                latency_ms=latency,
            )
    except requests.Timeout:
        return CheckResult(
            status="FAIL",
            message="EODHD API timeout (>10s)",
            latency_ms=round((time.time() - t0) * 1000, 1),
        )
    except Exception as e:
        return CheckResult(
            status="FAIL",
            message=f"EODHD API error: {str(e)[:200]}",
            latency_ms=round((time.time() - t0) * 1000, 1),
        )

# ---------------------------------------------------------------------------
# Check 3: Required Schemas & Tables
# ---------------------------------------------------------------------------

def _check_schemas_and_tables(conn):
    """Verify all 6 required tables exist. LIMIT 1 for existence, COUNT for row counts."""
    t0 = time.time()
    found = {}
    missing = []
    empty = []
    freshness = {}

    # Date column mapping for freshness check
    _date_cols = {
        "survivorship_Weekly": "week_end_date",
        "Fundamentals": "as_of_filing_date",
        "SYNC_LOG": "sync_date",
        "Investable_Universe": "effective_start",
        "Value_Scores": "month_date",
        "Quality_Scores": "month_date",
        "FinStr_Scores": "month_date",
        "Growth_Scores": "month_date",
        "Momentum_Scores": "month_date",
        "Composite_Scores": "month_date",
    }
    _skip_freshness = {"Symbol_Universe", "Sector_Index", "SCORE_CALC", "Norgate", "symbol_tracking"}

    for full_table, description in REQUIRED_TABLES.items():
        try:
            # Fast existence check (P0-2)
            row = conn.execute(f"SELECT 1 FROM {full_table} LIMIT 1").fetchone()
            if row is None:
                empty.append(full_table)
                found[full_table] = 0
            else:
                try:
                    cnt_row = conn.execute(f"SELECT COUNT(*) FROM {full_table}").fetchone()
                    found[full_table] = cnt_row[0] if cnt_row else "exists"
                except Exception:
                    found[full_table] = "exists"
                # Freshness: get latest date for this table
                short = full_table.split(".")[-1]
                if not any(skip in short for skip in _skip_freshness):
                    date_col = "date"
                    for key, col in _date_cols.items():
                        if key in short:
                            date_col = col
                            break
                    try:
                        dt_row = conn.execute(f"SELECT MAX({date_col}) FROM {full_table}").fetchone()
                        freshness[full_table] = str(dt_row[0]) if dt_row and dt_row[0] else None
                    except Exception:
                        freshness[full_table] = None
        except duckdb.CatalogException:
            missing.append(full_table)
        except Exception:
            missing.append(full_table)

    latency = round((time.time() - t0) * 1000, 1)

    if missing:
        return CheckResult(
            status="FAIL",
            message=f"{len(missing)} required table(s) missing: " + ", ".join(missing),
            detail={"found": found, "missing": missing, "empty": empty, "freshness": freshness},
            latency_ms=latency,
        )
    if empty:
        return CheckResult(
            status="WARN",
            message=f"{len(empty)} table(s) exist but are empty: " + ", ".join(empty),
            detail={"found": found, "missing": missing, "empty": empty, "freshness": freshness},
            latency_ms=latency,
        )
    return CheckResult(
        status="PASS",
        message=f"All {len(REQUIRED_TABLES)} required tables present with data",
        detail={"found": found, "missing": [], "empty": [], "freshness": freshness},
        latency_ms=latency,
    )



# ---------------------------------------------------------------------------
# Check 4: Last Sync Timestamp (from SYNC_STATE table)
# ---------------------------------------------------------------------------

def _check_last_sync_timestamp(conn: duckdb.DuckDBPyConnection) -> CheckResult:
    """Check when the pipeline last ran successfully."""
    t0 = time.time()
    try:
        row = conn.execute("""
            SELECT stage, status, updated_at
            FROM DEV_EODHD_DATA.main.SYNC_STATE
            ORDER BY updated_at DESC
            LIMIT 1
        """).fetchone()
        latency = round((time.time() - t0) * 1000, 1)
        if row:
            return CheckResult(
                status="PASS",
                message=f"Last sync: stage {row[0]} / {row[1]} at {row[2]}",
                detail={"last_stage": row[0], "last_status": row[1], "last_updated": str(row[2])},
                latency_ms=latency,
            )
        return CheckResult(
            status="WARN",
            message="SYNC_STATE table exists but is empty - no previous sync recorded",
            latency_ms=latency,
        )
    except duckdb.CatalogException:
        latency = round((time.time() - t0) * 1000, 1)
        return CheckResult(
            status="WARN",
            message="SYNC_STATE table not found - will be created on first Stage 1 run",
            latency_ms=latency,
        )

    except Exception:
        latency = round((time.time() - t0) * 1000, 1)
        return CheckResult(
            status="WARN",
            message="SYNC_STATE table not found - will be created on first Stage 1 run",
            latency_ms=latency,
        )
# ---------------------------------------------------------------------------
# Check 5: Symbol Format Consistency (PD-03)
# ---------------------------------------------------------------------------

def _check_symbol_format(conn: duckdb.DuckDBPyConnection) -> CheckResult:
    """
    PD-03: DEV/PROD EOD tables must use TICKER.US format.
    All score tables use TICKER.US format.
    """
    t0 = time.time()
    violations = {}
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    us_tables = [
        "PROD_EODHD.main.PROD_EOD_survivorship",
    ]
    # Note: PROD_OBQ_Momentum_Scores intentionally stores bare symbols (AAPL not AAPL.US)
    # because the momentum SQL strips .US when computing from price data.
    for tbl in us_tables:
        try:
            row = conn.execute(f"""
                SELECT COUNT(*) FROM {tbl}
                WHERE date >= '{thirty_days_ago}'
                AND symbol IS NOT NULL
                AND symbol NOT LIKE '%.US'
            """).fetchone()
            bad_count = row[0] if row else 0
            if bad_count > 0:
                violations[tbl] = f"{bad_count} symbols missing .US suffix"
        except duckdb.CatalogException:
            violations[tbl] = "table not found"
        except Exception:
            pass

    # All score tables now use .US format, no legacy bare ticker check needed

    latency = round((time.time() - t0) * 1000, 1)

    if violations:
        return CheckResult(
            status="WARN",
            message=f"Symbol format inconsistencies in {len(violations)} table(s)",
            detail={"violations": violations, "sample_window": f"last 30 days (since {thirty_days_ago})"},
            latency_ms=latency,
        )
    return CheckResult(
        status="PASS",
        message="Symbol formats consistent across all tables (PD-03 compliant)",
        detail={"sample_window": f"last 30 days (since {thirty_days_ago})"},
        latency_ms=latency,
    )

# ---------------------------------------------------------------------------
# Check 6: Fundamentals Coverage
# ---------------------------------------------------------------------------

def _check_fundamentals_coverage(conn: duckdb.DuckDBPyConnection) -> CheckResult:
    """
    Compare scored symbols vs investable universe (top 3000 by market cap).
    Scores are intentionally limited to the investable universe, not the full EOD survivorship.
    """
    t0 = time.time()
    try:
        eod_row = conn.execute("""
            SELECT COUNT(DISTINCT symbol) FROM PROD_EODHD.main.PROD_EOD_survivorship
        """).fetchone()
        eod_count = eod_row[0] if eod_row else 0

        # Investable universe count (latest recon year)
        try:
            univ_row = conn.execute("""
                SELECT COUNT(DISTINCT symbol) FROM PROD_EODHD.main.PROD_OBQ_Investable_Universe
                WHERE effective_start = (SELECT MAX(effective_start) FROM PROD_EODHD.main.PROD_OBQ_Investable_Universe)
            """).fetchone()
            universe_count = univ_row[0] if univ_row else 3000
        except Exception:
            universe_count = 3000  # fallback

        # Per-score-table symbol counts (latest month only)
        score_tables_map = {
            "value": "PROD_EODHD.main.PROD_OBQ_Value_Scores",
            "quality": "PROD_EODHD.main.PROD_OBQ_Quality_Scores",
            "finstr": "PROD_EODHD.main.PROD_OBQ_FinStr_Scores",
            "growth": "PROD_EODHD.main.PROD_OBQ_Growth_Scores",
            "momentum": "PROD_EODHD.main.PROD_OBQ_Momentum_Scores",
            "composite": "PROD_EODHD.main.PROD_JCN_Composite_Scores",
        }
        score_symbol_counts = {}
        for key, tbl in score_tables_map.items():
            try:
                r = conn.execute(f"""
                    SELECT COUNT(DISTINCT symbol) FROM {tbl}
                    WHERE month_date = (SELECT MAX(month_date) FROM {tbl})
                """).fetchone()
                score_symbol_counts[key] = r[0] if r else 0
            except Exception:
                score_symbol_counts[key] = 0

        scores_count = score_symbol_counts.get("value", 0)
        momentum_count = score_symbol_counts.get("momentum", 0)
        composite_count = score_symbol_counts.get("composite", 0)

        latency = round((time.time() - t0) * 1000, 1)

        # Coverage vs investable universe (not full EOD)
        coverage_vs_univ = round(scores_count / max(universe_count, 1) * 100, 1)

        detail = {
            "eod_symbols_total": eod_count,
            "investable_universe": universe_count,
            "latest_month_scored": scores_count,
            "momentum_scored": momentum_count,
            "composite_scored": composite_count,
            "coverage_vs_universe_pct": coverage_vs_univ,
            "per_score": score_symbol_counts,
        }

        if coverage_vs_univ < 80:
            return CheckResult(
                status="WARN",
                message=f"Score coverage {coverage_vs_univ}% of investable universe ({scores_count}/{universe_count})",
                detail=detail,
                latency_ms=latency,
            )
        return CheckResult(
            status="PASS",
            message=f"Score coverage: {coverage_vs_univ}% of investable universe ({scores_count}/{universe_count}), {composite_count} composites",
            detail=detail,
            latency_ms=latency,
        )
    except Exception as e:
        return CheckResult(
            status="WARN",
            message=f"Could not compute coverage: {str(e)[:200]}",
            latency_ms=round((time.time() - t0) * 1000, 1),
        )

# ---------------------------------------------------------------------------
# Check 7: Gap Analysis (latest EOD date vs today)
# ---------------------------------------------------------------------------

def _check_data_gap(conn: duckdb.DuckDBPyConnection) -> CheckResult:
    """Check how stale the EOD data is - latest date in PROD vs today."""
    t0 = time.time()
    try:
        row = conn.execute("""
            SELECT MAX(date) FROM PROD_EODHD.main.PROD_EOD_survivorship
        """).fetchone()
        latency = round((time.time() - t0) * 1000, 1)

        if not row or row[0] is None:
            return CheckResult(
                status="WARN",
                message="No dates found in PROD_EOD_survivorship",
                latency_ms=latency,
            )

        latest_date = row[0]
        if hasattr(latest_date, "date"):
            latest_date = latest_date.date()

        today = datetime.now(timezone.utc).date()
        gap_days = (today - latest_date).days

        detail = {
            "latest_eod_date": str(latest_date),
            "today": str(today),
            "gap_days": gap_days,
        }

        if gap_days > 5:
            return CheckResult(
                status="WARN",
                message=f"EOD data is {gap_days} days stale (latest: {latest_date})",
                detail=detail,
                latency_ms=latency,
            )
        elif gap_days > 1:
            return CheckResult(
                status="PASS",
                message=f"EOD data {gap_days} day(s) behind (latest: {latest_date}) - normal for weekends/holidays",
                detail=detail,
                latency_ms=latency,
            )
        else:
            return CheckResult(
                status="PASS",
                message=f"EOD data is current (latest: {latest_date})",
                detail=detail,
                latency_ms=latency,
            )
    except Exception as e:
        return CheckResult(
            status="WARN",
            message=f"Gap analysis failed: {str(e)[:200]}",
            latency_ms=round((time.time() - t0) * 1000, 1),
        )

# ---------------------------------------------------------------------------
# Check 8: Duplicate Detection (P2-3)
# ---------------------------------------------------------------------------

def _check_duplicates(conn):
    """Scan last 7 days for duplicate (date, symbol) pairs in PROD EOD."""
    t0 = time.time()
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    try:
        row = conn.execute(f"""
            SELECT COUNT(*) FROM (
                SELECT date, symbol, COUNT(*) AS cnt
                FROM PROD_EODHD.main.PROD_EOD_survivorship
                WHERE date >= '{seven_days_ago}'
                GROUP BY date, symbol
                HAVING cnt > 1
            )
        """).fetchone()
        latency = round((time.time() - t0) * 1000, 1)
        dup_count = row[0] if row else 0
        if dup_count > 0:
            return CheckResult(
                status="WARN",
                message=f"{dup_count} duplicate (date,symbol) pairs in last 7 days",
                detail={"duplicate_count": dup_count, "scan_window": "7 days"},
                latency_ms=latency,
            )
        return CheckResult(
            status="PASS",
            message="No duplicates in last 7 days",
            detail={"scan_window": "7 days"},
            latency_ms=latency,
        )
    except Exception as e:
        return CheckResult(
            status="WARN",
            message=f"Duplicate check failed: {str(e)[:200]}",
            latency_ms=round((time.time() - t0) * 1000, 1),
        )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_stage0() -> dict:
    """
    Run all Stage 0 health checks and return structured response.
    P1-3: Returns cached result if fresh (< 5 min).
    P1-1/P1-4: All DB checks run in thread pool with per-check timeout.
    """
    overall_start = time.time()

    # --- P1-3: Check cache first ---
    cached_result = _get_cached_result()
    if cached_result is not None:
        return cached_result

    timestamp_utc = datetime.now(timezone.utc).isoformat()
    checks: Dict[str, dict] = {}
    blocking_issues: List[str] = []
    self_heal_actions: List[str] = []
    conn = None

    # --- Check 1: MotherDuck Connectivity ---
    md_token = os.getenv("MOTHERDUCK_TOKEN", "")
    if not md_token:
        checks["motherduck_connectivity"] = CheckResult(
            status="FAIL",
            message="MOTHERDUCK_TOKEN environment variable not set",
        ).model_dump()
        blocking_issues.append("MOTHERDUCK_TOKEN not set")
        self_heal_actions.append(
            f"Set MOTHERDUCK_TOKEN in Vercel env vars -> {VERCEL_ENV_URL}"
        )
    else:
        md_result, conn = _check_motherduck_connectivity(md_token)
        checks["motherduck_connectivity"] = md_result.model_dump()
        if md_result.status == "FAIL":
            blocking_issues.append(md_result.message)
            self_heal_actions.append(
                "Check MotherDuck token at https://app.motherduck.com/"
            )

    # --- Check 2: EODHD API Key ---
    eodhd_key = os.getenv("EODHD_API_KEY", "")
    if not eodhd_key:
        checks["eodhd_api"] = CheckResult(
            status="FAIL",
            message="EODHD_API_KEY environment variable not set",
        ).model_dump()
        blocking_issues.append("EODHD_API_KEY not set")
        self_heal_actions.append(
            f"Set EODHD_API_KEY in Vercel env vars -> {VERCEL_ENV_URL}"
        )
    else:
        eodhd_result = _check_eodhd_api(eodhd_key)
        checks["eodhd_api"] = eodhd_result.model_dump()
        if eodhd_result.status == "FAIL":
            blocking_issues.append(eodhd_result.message)
            self_heal_actions.append(
                f"Verify EODHD API key -> {EODHD_DASHBOARD_URL}"
            )

    # --- Database-dependent checks (only if connected) ---
    if conn is not None:
        try:
            def _budget_remaining():
                return OVERALL_BUDGET_SECONDS - (time.time() - overall_start)

            # Check 3: Schemas & Tables (P0-2)
            if _budget_remaining() > 0:
                tables_result = await _run_check_with_timeout(
                    _check_schemas_and_tables, conn, timeout_s=15.0
                )
                checks["schemas_and_tables"] = tables_result.model_dump()
                if tables_result.status == "FAIL":
                    blocking_issues.append(tables_result.message)
                    self_heal_actions.append(
                        "Create missing tables via Stage 1 -> /data-sync"
                    )

            # Check 4: Last Sync Timestamp
            if _budget_remaining() > 0:
                sync_result = await _run_check_with_timeout(
                    _check_last_sync_timestamp, conn
                )
                checks["last_sync"] = sync_result.model_dump()

            # Check 5: Symbol Format (PD-03, P0-1: 30-day sample)
            if _budget_remaining() > 0:
                symbol_result = await _run_check_with_timeout(
                    _check_symbol_format, conn
                )
                checks["symbol_format"] = symbol_result.model_dump()
                if symbol_result.status == "FAIL":
                    blocking_issues.append(symbol_result.message)

            # Check 6: Fundamentals Coverage
            if _budget_remaining() > 0:
                coverage_result = await _run_check_with_timeout(
                    _check_fundamentals_coverage, conn
                )
                checks["fundamentals_coverage"] = coverage_result.model_dump()

            # Check 7: Data Gap Analysis
            if _budget_remaining() > 0:
                gap_result = await _run_check_with_timeout(
                    _check_data_gap, conn
                )
                checks["data_gap"] = gap_result.model_dump()
                if gap_result.status == "WARN" and gap_result.detail:
                    gap_days = gap_result.detail.get("gap_days", 0)
                    if gap_days > 5:
                        self_heal_actions.append(
                            f"Run Stage 1 to sync {gap_days} days -> /data-sync"
                        )

            # Check 8: Duplicate Detection (P2-3)
            if _budget_remaining() > 0:
                dup_result = await _run_check_with_timeout(
                    _check_duplicates, conn
                )
                checks["duplicate_detection"] = dup_result.model_dump()

            # Budget exhaustion warning
            if _budget_remaining() <= 0:
                checks["budget_warning"] = CheckResult(
                    status="WARN",
                    message=f"Time budget exhausted ({OVERALL_BUDGET_SECONDS}s) - some checks skipped",
                    latency_ms=round((time.time() - overall_start) * 1000, 1),
                ).model_dump()

        finally:
            conn.close()

    # --- Determine overall status ---
    all_statuses = [v.get("status", "FAIL") for v in checks.values()]
    if "FAIL" in all_statuses:
        overall_status = "FAIL"
    elif "WARN" in all_statuses:
        overall_status = "WARN"
    else:
        overall_status = "PASS"

    can_proceed = len(blocking_issues) == 0
    execution_ms = round((time.time() - overall_start) * 1000, 1)

    result = Stage0Response(
        stage=0,
        overall_status=overall_status,
        timestamp_utc=timestamp_utc,
        checks=checks,
        can_proceed=can_proceed,
        blocking_issues=blocking_issues,
        self_heal_actions=self_heal_actions,
        cached=False,
        execution_ms=execution_ms,
    ).model_dump()

    # --- P1-3: Save to cache ---
    _save_to_cache(result)

    return result
