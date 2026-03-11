"""
Cron orchestrator — runs the full sync pipeline (stages 0→1→2→3) sequentially.

Called by Vercel Cron at 8pm CST (2am UTC) daily.
Secured via CRON_SECRET header check.

Each stage runs inline. If a stage fails its gate, the pipeline stops.
Results are logged to PROD_SYNC_LOG by Stage 2 (existing behavior).
"""

import os
import time
from datetime import datetime, timezone
from typing import Dict, Any

from .sync_stage0 import run_stage0
from .sync_stage1 import run_stage1
from .sync_stage2 import run_stage2
from .sync_stage3 import run_stage3


async def run_cron_pipeline() -> Dict[str, Any]:
    """
    Execute full sync pipeline sequentially.
    Returns combined result with per-stage summaries.
    """
    t0 = time.time()
    now_utc = datetime.now(timezone.utc).isoformat()

    result: Dict[str, Any] = {
        "trigger": "cron",
        "started_at": now_utc,
        "stages": {},
        "overall_status": "PASS",
        "stopped_at_stage": None,
    }

    # ── Stage 0: Health & Inventory ──
    try:
        s0 = await run_stage0()
        result["stages"]["stage0"] = {
            "status": s0.get("overall_status", "FAIL"),
            "can_proceed": s0.get("can_proceed", False),
            "execution_ms": s0.get("execution_ms", 0),
        }
        if not s0.get("can_proceed", False):
            result["overall_status"] = "FAIL"
            result["stopped_at_stage"] = 0
            result["execution_ms"] = round((time.time() - t0) * 1000)
            return result
    except Exception as e:
        result["stages"]["stage0"] = {"status": "FAIL", "error": str(e)[:300]}
        result["overall_status"] = "FAIL"
        result["stopped_at_stage"] = 0
        result["execution_ms"] = round((time.time() - t0) * 1000)
        return result

    # ── Stage 1: Ingest ──
    try:
        s1 = await run_stage1()
        result["stages"]["stage1"] = {
            "status": s1.get("overall_status", "FAIL"),
            "can_proceed": s1.get("can_proceed", False),
            "execution_ms": s1.get("execution_ms", 0),
            "trading_days_synced": s1.get("summary", {}).get("trading_days_synced", 0),
            "total_stocks_inserted": s1.get("summary", {}).get("total_stocks_inserted", 0),
        }
        if not s1.get("can_proceed", False):
            result["overall_status"] = "FAIL"
            result["stopped_at_stage"] = 1
            result["execution_ms"] = round((time.time() - t0) * 1000)
            return result
    except Exception as e:
        result["stages"]["stage1"] = {"status": "FAIL", "error": str(e)[:300]}
        result["overall_status"] = "FAIL"
        result["stopped_at_stage"] = 1
        result["execution_ms"] = round((time.time() - t0) * 1000)
        return result

    # ── Stage 2: Validate & Promote ──
    try:
        s2 = await run_stage2()
        result["stages"]["stage2"] = {
            "status": s2.get("overall_status", "FAIL"),
            "can_proceed": s2.get("can_proceed", False),
            "execution_ms": s2.get("execution_ms", 0),
            "sync_log": s2.get("sync_log", False),
        }
        if not s2.get("can_proceed", False):
            result["overall_status"] = "FAIL"
            result["stopped_at_stage"] = 2
            result["execution_ms"] = round((time.time() - t0) * 1000)
            return result
    except Exception as e:
        result["stages"]["stage2"] = {"status": "FAIL", "error": str(e)[:300]}
        result["overall_status"] = "FAIL"
        result["stopped_at_stage"] = 2
        result["execution_ms"] = round((time.time() - t0) * 1000)
        return result

    # ── Stage 3: Audit & Report ──
    try:
        s3 = await run_stage3()
        result["stages"]["stage3"] = {
            "status": s3.get("overall_status", "FAIL"),
            "execution_ms": s3.get("execution_ms", 0),
        }
        if s3.get("overall_status") == "FAIL":
            result["overall_status"] = "WARN"
        elif s3.get("overall_status") == "WARN":
            # Stage 3 warnings don't fail the pipeline
            if result["overall_status"] == "PASS":
                result["overall_status"] = "WARN"
    except Exception as e:
        result["stages"]["stage3"] = {"status": "FAIL", "error": str(e)[:300]}
        result["overall_status"] = "WARN"

    result["execution_ms"] = round((time.time() - t0) * 1000)
    return result
