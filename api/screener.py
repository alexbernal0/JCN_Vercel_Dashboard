"""
JCN Stock Screener API — FinViz-style preset filter screener.

POST /api/screener — Accepts filter config JSON, builds dynamic SQL WHERE,
queries PROD tables via JOINs, returns results for TanStack Table.

100% READ-ONLY. Never writes to any PROD table.

Tables queried:
- PROD_DASHBOARD_SNAPSHOT (price, daily%, ytd%, yoy%, 52wk, sector, market_cap)
- PROD_OBQ_Value_Scores, Quality, FinStr, Growth, Momentum (composites)
- PROD_JCN_Composite_Scores (8 blends)
- PROD_OBQ_Momentum_Scores (sub-components: af_*, fip_*, sys_*)
- PROD_EOD_Fundamentals (valuation, profitability, growth, fundamentals)
"""

import os
import json
import time
import logging
import math
from pathlib import Path as FilePath
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Set HOME for DuckDB serverless
os.environ.setdefault("HOME", "/tmp")


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class ScreenerFilter(BaseModel):
    """A single filter: field + operator + value."""
    field: str
    op: str = "gte"  # gte, lte, eq, in, between, top_n
    value: Any = None


class ScreenerRequest(BaseModel):
    """Screener request with list of filters and optional pagination."""
    filters: List[ScreenerFilter] = Field(default_factory=list)
    sort_by: Optional[str] = "market_cap"
    sort_dir: Optional[str] = "desc"  # asc or desc
    limit: int = 3000
    offset: int = 0


class ScreenerResponse(BaseModel):
    """Screener response: rows + metadata."""
    data: List[Dict[str, Any]] = Field(default_factory=list)
    total_count: int = 0
    columns: List[str] = Field(default_factory=list)
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

SCREENER_CACHE_DIR = FilePath("/tmp/jcn_screener")
SCREENER_CACHE_TTL = 5 * 60  # 5 minutes — short TTL so filters feel live

def _cache_key(request: ScreenerRequest) -> str:
    """Deterministic cache key from filter config."""
    import hashlib
    payload = json.dumps({
        "filters": [f.dict() for f in request.filters],
        "sort_by": request.sort_by,
        "sort_dir": request.sort_dir,
        "limit": request.limit,
        "offset": request.offset,
    }, sort_keys=True)
    return hashlib.md5(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_round(val, decimals=2):
    if val is None:
        return None
    try:
        r = round(float(val), decimals)
        if math.isnan(r) or math.isinf(r):
            return None
        return r
    except (ValueError, TypeError):
        return None


def _get_connection():
    import duckdb
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN not set")
    return duckdb.connect(f"md:?motherduck_token={token}")


# ---------------------------------------------------------------------------
# Field → SQL column mapping
# ---------------------------------------------------------------------------
# Maps filter field names to their SQL table alias + column.
# This prevents SQL injection — only whitelisted fields are allowed.

FIELD_MAP = {
    # --- Descriptive (from snap) ---
    "market_cap": "snap.market_cap",
    "gics_sector": "snap.gics_sector",
    "industry": "snap.industry",

    # --- Price / Momentum from snap ---
    "daily_change_pct": "snap.daily_change_pct",
    "ytd_pct": "snap.ytd_pct",
    "yoy_pct": "snap.yoy_pct",
    "pct_below_52wk_high": "snap.pct_below_52wk_high",
    "chan_range_pct": "snap.chan_range_pct",
    "adjusted_close": "snap.adjusted_close",

    # --- 5 Factor Composites ---
    "value_score_composite": "val.value_score_composite",
    "quality_score_composite": "qual.quality_score_composite",
    "finstr_score_composite": "fin.finstr_score_composite",
    "growth_score_composite": "grow.growth_score_composite",
    "momentum_score_composite": "mom.momentum_score_composite",

    # --- 8 JCN Blend Composites ---
    "jcn_full_composite": "jcn.jcn_full_composite",
    "jcn_qarp": "jcn.jcn_qarp",
    "jcn_garp": "jcn.jcn_garp",
    "jcn_quality_momentum": "jcn.jcn_quality_momentum",
    "jcn_value_momentum": "jcn.jcn_value_momentum",
    "jcn_growth_quality_momentum": "jcn.jcn_growth_quality_momentum",
    "jcn_fortress": "jcn.jcn_fortress",
    "jcn_alpha_trifecta": "jcn.jcn_alpha_trifecta",

    # --- Momentum Sub-components ---
    "af_r3m": "mom.af_r3m",
    "af_r6m": "mom.af_r6m",
    "af_r9m": "mom.af_r9m",
    "af_r12m": "mom.af_r12m",
    "af_momentum": "mom.af_momentum",
    "fip_3m": "mom.fip_3m",
    "fip_6m": "mom.fip_6m",
    "fip_12m": "mom.fip_12m",
    "fip_score": "mom.fip_score",
    "systemscore": "mom.systemscore",
    "af_composite": "mom.af_composite",
    "fip_composite": "mom.fip_composite",
    "sys_composite": "mom.sys_composite",

    # --- Valuation (from fund) ---
    "pe_ratio": "fund.pe_ratio",
    "forward_pe": "fund.forward_pe",
    "peg_ratio": "fund.peg_ratio",
    "price_book": "fund.price_book_mrq",
    "price_sales": "fund.price_sales_ttm",
    "ev_ebitda": "fund.enterprise_value_ebitda",
    "dividend_yield": "fund.dividend_yield",
    "beta": "fund.beta",

    # --- Profitability (from fund) ---
    "profit_margin": "fund.profit_margin",
    "operating_margin": "fund.operating_margin_ttm",
    "return_on_equity": "fund.return_on_equity_ttm",
    "return_on_assets": "fund.return_on_assets_ttm",
    "gross_margin": "fund.gross_profit_ttm_margin",

    # --- Growth (from fund — latest quarter YoY) ---
    "revenue_growth": "fund.quarterly_revenue_growth_yoy",
    "earnings_growth": "fund.quarterly_earnings_growth_yoy",

    # --- Fundamentals (from fund) ---
    "debt_to_equity": "fund.debt_to_equity",
    "current_ratio": "fund.current_ratio",
    "interest_coverage": "fund.interest_coverage",
}

# Fields that are sortable (whitelist for ORDER BY)
SORTABLE_FIELDS = set(FIELD_MAP.keys()) | {"symbol", "company_name"}


# ---------------------------------------------------------------------------
# SQL Builder
# ---------------------------------------------------------------------------

def _build_where_clause(filters: List[ScreenerFilter]) -> tuple:
    """Build WHERE clause from filter list.
    Returns (clause_str, params_list).
    Only allows whitelisted fields to prevent injection.
    """
    clauses = []
    params = []

    for f in filters:
        if f.field not in FIELD_MAP:
            logger.warning(f"Unknown filter field: {f.field}")
            continue

        col = FIELD_MAP[f.field]

        if f.op == "top_n" and f.field == "market_cap" and f.value is not None:
            # TOP N by market cap: subquery to get top N symbols ranked by market_cap
            n = int(f.value)
            clauses.append(f"""snap.symbol IN (
                SELECT symbol FROM PROD_EODHD.main.PROD_DASHBOARD_SNAPSHOT
                WHERE is_etf IS NOT TRUE AND market_cap IS NOT NULL
                ORDER BY market_cap DESC LIMIT {n}
            )""")
        elif f.op == "gte" and f.value is not None:
            clauses.append(f"{col} >= ?")
            params.append(f.value)
        elif f.op == "lte" and f.value is not None:
            clauses.append(f"{col} <= ?")
            params.append(f.value)
        elif f.op == "eq" and f.value is not None:
            clauses.append(f"{col} = ?")
            params.append(f.value)
        elif f.op == "in" and isinstance(f.value, list) and f.value:
            placeholders = ", ".join(["?" for _ in f.value])
            clauses.append(f"{col} IN ({placeholders})")
            params.extend(f.value)
        elif f.op == "between" and isinstance(f.value, list) and len(f.value) == 2:
            clauses.append(f"{col} BETWEEN ? AND ?")
            params.extend(f.value)
        else:
            logger.warning(f"Unsupported filter op: {f.op} for {f.field}")

    return " AND ".join(clauses), params


def _build_sort_clause(sort_by: Optional[str], sort_dir: Optional[str]) -> str:
    """Build ORDER BY clause. Defaults to market_cap DESC."""
    if sort_by and sort_by in SORTABLE_FIELDS:
        col = FIELD_MAP.get(sort_by, sort_by)
        direction = "ASC" if sort_dir and sort_dir.lower() == "asc" else "DESC"
        # NULLS LAST so null values don't dominate
        return f"ORDER BY {col} {direction} NULLS LAST"
    return "ORDER BY snap.market_cap DESC NULLS LAST"


# ---------------------------------------------------------------------------
# Main Query
# ---------------------------------------------------------------------------

def run_screener(request: ScreenerRequest) -> ScreenerResponse:
    """Execute screener query with filters, JOINs, and sorting.

    Uses inline subqueries instead of CTEs — MotherDuck handles these
    reliably (matches existing patterns in stock_analysis.py).
    Fetches all matching rows (up to limit), derives count from len(rows).
    """

    # Check cache
    SCREENER_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    ckey = _cache_key(request)
    cache_file = SCREENER_CACHE_DIR / f"{ckey}.json"
    if cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text())
            if time.time() - cached.get("_ts", 0) < SCREENER_CACHE_TTL:
                logger.info(f"Screener cache hit: {ckey}")
                return ScreenerResponse(**cached["payload"])
        except Exception:
            pass

    conn = _get_connection()
    try:
        # Build WHERE clause from filters
        where_str, params = _build_where_clause(request.filters)
        # Always exclude ETFs from screener
        # is_etf is a BOOLEAN column (FALSE for stocks, TRUE for ETFs)
        # Use IS NOT TRUE to safely handle FALSE, NULL, and any edge cases
        base_where = "snap.is_etf IS NOT TRUE"
        if where_str:
            full_where = f"{base_where} AND {where_str}"
        else:
            full_where = base_where

        sort_clause = _build_sort_clause(request.sort_by, request.sort_dir)

        # Main query — inline subqueries (no CTEs, MotherDuck-safe)
        # Symbol normalization:
        # - PROD_DASHBOARD_SNAPSHOT: .US suffix
        # - Value/Quality/FinStr/Growth scores: .US suffix
        # - Momentum scores: NO .US suffix
        # - JCN Composites: .US suffix
        # - Fundamentals: .US suffix
        sql = f"""
        SELECT
            REPLACE(snap.symbol, '.US', '') AS symbol,
            fund.company_name,
            snap.gics_sector,
            snap.industry,
            snap.market_cap,
            snap.adjusted_close,
            snap.daily_change_pct,
            snap.ytd_pct,
            snap.yoy_pct,
            snap.pct_below_52wk_high,
            snap.chan_range_pct,
            snap.week_52_high,
            snap.week_52_low,
            val.value_score_composite,
            qual.quality_score_composite,
            fin.finstr_score_composite,
            grow.growth_score_composite,
            mom.momentum_score_composite,
            jcn.jcn_full_composite,
            jcn.jcn_qarp,
            jcn.jcn_garp,
            jcn.jcn_quality_momentum,
            jcn.jcn_value_momentum,
            jcn.jcn_growth_quality_momentum,
            jcn.jcn_fortress,
            jcn.jcn_alpha_trifecta,
            mom.af_r3m, mom.af_r6m, mom.af_r9m, mom.af_r12m, mom.af_momentum,
            mom.fip_3m, mom.fip_6m, mom.fip_12m, mom.fip_score,
            mom.systemscore,
            mom.af_composite, mom.fip_composite, mom.sys_composite,
            fund.pe_ratio, fund.forward_pe, fund.peg_ratio,
            fund.price_book_mrq AS price_book,
            fund.price_sales_ttm AS price_sales,
            fund.enterprise_value_ebitda AS ev_ebitda,
            fund.dividend_yield, fund.beta,
            fund.profit_margin, fund.operating_margin_ttm AS operating_margin,
            fund.return_on_equity_ttm AS return_on_equity,
            fund.return_on_assets_ttm AS return_on_assets,
            fund.gross_profit_ttm_margin AS gross_margin,
            fund.quarterly_revenue_growth_yoy AS revenue_growth,
            fund.quarterly_earnings_growth_yoy AS earnings_growth,
            fund.debt_to_equity,
            fund.current_ratio,
            fund.interest_coverage

        FROM PROD_EODHD.main.PROD_DASHBOARD_SNAPSHOT snap

        LEFT JOIN (
            SELECT symbol, value_score_composite
            FROM PROD_EODHD.main.PROD_OBQ_Value_Scores
            WHERE month_date = (SELECT MAX(month_date) FROM PROD_EODHD.main.PROD_OBQ_Value_Scores)
        ) val ON snap.symbol = val.symbol

        LEFT JOIN (
            SELECT symbol, quality_score_composite
            FROM PROD_EODHD.main.PROD_OBQ_Quality_Scores
            WHERE month_date = (SELECT MAX(month_date) FROM PROD_EODHD.main.PROD_OBQ_Quality_Scores)
        ) qual ON snap.symbol = qual.symbol

        LEFT JOIN (
            SELECT symbol, finstr_score_composite
            FROM PROD_EODHD.main.PROD_OBQ_FinStr_Scores
            WHERE month_date = (SELECT MAX(month_date) FROM PROD_EODHD.main.PROD_OBQ_FinStr_Scores)
        ) fin ON snap.symbol = fin.symbol

        LEFT JOIN (
            SELECT symbol, growth_score_composite
            FROM PROD_EODHD.main.PROD_OBQ_Growth_Scores
            WHERE month_date = (SELECT MAX(month_date) FROM PROD_EODHD.main.PROD_OBQ_Growth_Scores)
        ) grow ON snap.symbol = grow.symbol

        LEFT JOIN (
            SELECT symbol,
                   momentum_score_composite,
                   af_r3m, af_r6m, af_r9m, af_r12m, af_momentum,
                   fip_3m, fip_6m, fip_12m, fip_score,
                   systemscore,
                   af_composite, fip_composite, sys_composite
            FROM PROD_EODHD.main.PROD_OBQ_Momentum_Scores
            WHERE month_date = (SELECT MAX(month_date) FROM PROD_EODHD.main.PROD_OBQ_Momentum_Scores)
        ) mom ON REPLACE(snap.symbol, '.US', '') = mom.symbol

        LEFT JOIN (
            SELECT symbol,
                   jcn_full_composite, jcn_qarp, jcn_garp,
                   jcn_quality_momentum, jcn_value_momentum,
                   jcn_growth_quality_momentum, jcn_fortress, jcn_alpha_trifecta
            FROM PROD_EODHD.main.PROD_JCN_Composite_Scores
            WHERE month_date = (SELECT MAX(month_date) FROM PROD_EODHD.main.PROD_JCN_Composite_Scores)
        ) jcn ON snap.symbol = jcn.symbol

        LEFT JOIN (
            SELECT symbol,
                   pe_ratio, forward_pe, peg_ratio,
                   price_book_mrq, price_sales_ttm,
                   enterprise_value_ebitda, dividend_yield, beta,
                   profit_margin, operating_margin_ttm,
                   return_on_equity_ttm, return_on_assets_ttm,
                   gross_profit_ttm AS gross_profit_ttm_val,
                   quarterly_revenue_growth_yoy, quarterly_earnings_growth_yoy,
                   company_name,
                   CASE WHEN bs_totalStockholderEquity IS NOT NULL AND bs_totalStockholderEquity != 0
                        THEN ROUND(bs_totalLiab / bs_totalStockholderEquity, 2) END AS debt_to_equity,
                   CASE WHEN bs_totalCurrentLiabilities IS NOT NULL AND bs_totalCurrentLiabilities != 0
                        THEN ROUND(bs_totalCurrentAssets / bs_totalCurrentLiabilities, 2) END AS current_ratio,
                   CASE WHEN is_interestExpense IS NOT NULL AND is_interestExpense != 0
                        THEN ROUND(is_operatingIncome / is_interestExpense, 2) END AS interest_coverage,
                   CASE WHEN revenue_ttm IS NOT NULL AND revenue_ttm != 0 AND gross_profit_ttm IS NOT NULL
                        THEN ROUND(gross_profit_ttm / revenue_ttm, 4) END AS gross_profit_ttm_margin
            FROM PROD_EODHD.main.PROD_EOD_Fundamentals
            QUALIFY ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY filing_date DESC) = 1
        ) fund ON snap.symbol = fund.symbol

        WHERE {full_where}
        {sort_clause}
        """

        logger.info(f"Screener query with {len(request.filters)} filters")
        rows = conn.execute(sql, params).fetchall()
        columns = [d[0] for d in conn.description]

        # Total count = all matching rows; slice for pagination
        total_count = len(rows)
        if request.offset > 0 or request.limit < total_count:
            rows = rows[request.offset:request.offset + request.limit]

        # Build response data
        data = []
        for row in rows:
            row_dict = {}
            for i, col in enumerate(columns):
                val = row[i]
                # Round floats for clean JSON
                if isinstance(val, float):
                    val = _safe_round(val, 4) if "pct" in col or "margin" in col or "growth" in col or "yield" in col else _safe_round(val, 2)
                row_dict[col] = val
            data.append(row_dict)

        result = ScreenerResponse(
            data=data,
            total_count=total_count,
            columns=columns,
            error=None,
        )

        # Cache result
        try:
            cache_file.write_text(json.dumps({
                "payload": result.dict(),
                "_ts": time.time(),
            }))
        except Exception:
            pass

        logger.info(f"Screener returned {len(data)} rows (total {total_count})")
        return result

    except Exception as e:
        logger.error(f"Screener query failed: {e}", exc_info=True)
        return ScreenerResponse(data=[], total_count=0, columns=[], error=str(e)[:500])
    finally:
        conn.close()
