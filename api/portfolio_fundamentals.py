"""
Portfolio Fundamentals (Scores) API
Fetches latest OBQ factor scores from MotherDuck for portfolio symbols.
All 5 scores (Value, Quality, Growth, FinStr, Momentum) read from Stage 2.5 tables.
Tables: PROD_OBQ_Value_Scores, PROD_OBQ_Quality_Scores, PROD_OBQ_FinStr_Scores,
        PROD_OBQ_Growth_Scores, PROD_OBQ_Momentum_Scores (all in PROD_EODHD.main)
"""

import os
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Set HOME for DuckDB serverless
os.environ.setdefault("HOME", "/tmp")


class PortfolioFundamentalsRequest(BaseModel):
    """Request: list of portfolio symbols (e.g. from portfolio input)."""
    symbols: List[str] = Field(..., description="Stock ticker symbols")


class PortfolioFundamentalsResponse(BaseModel):
    """Response: one row per symbol, one column per score (latest values)."""
    data: List[Dict[str, Any]] = Field(default_factory=list)
    score_columns: List[str] = Field(default_factory=list)
    error: Optional[str] = None


def _normalize_symbol(s: str) -> str:
    """Ensure symbol has .US for MotherDuck, return display form without .US."""
    return s.upper().replace(".US", "").strip()


def _add_us_suffix(symbol: str) -> str:
    if not symbol.upper().endswith(".US"):
        return f"{symbol.upper()}.US"
    return symbol.upper()


# Exactly 5 score columns returned to frontend (latest value per stock)
SCORE_KEYS = ["value", "growth", "financial_strength", "quality", "momentum"]

# Map API keys to Stage 2.5 recalculated score tables (all 5 scores)
NEW_SCORE_TABLES = {
    "value": ("PROD_EODHD.main.PROD_OBQ_Value_Scores", "value_score_composite"),
    "quality": ("PROD_EODHD.main.PROD_OBQ_Quality_Scores", "quality_score_composite"),
    "financial_strength": ("PROD_EODHD.main.PROD_OBQ_FinStr_Scores", "finstr_score_composite"),
    "growth": ("PROD_EODHD.main.PROD_OBQ_Growth_Scores", "growth_score_composite"),
    "momentum": ("PROD_EODHD.main.PROD_OBQ_Momentum_Scores", "momentum_score_composite"),
}


def get_portfolio_fundamentals(request: PortfolioFundamentalsRequest) -> PortfolioFundamentalsResponse:
    """
    Fetch latest composite score per symbol from all 5 Stage 2.5 score tables.
    Returns one row per symbol and one column per score (merged from all tables).
    """
    symbols = [s for s in request.symbols if (s and isinstance(s, str))]
    if not symbols:
        return PortfolioFundamentalsResponse(data=[], score_columns=[], error=None)

    # DB may store symbols with or without .US; query both forms so we get rows either way
    def _symbols_for_query(syms: List[str]) -> str:
        seen: set = set()
        out = []
        for s in syms:
            n = _normalize_symbol(s)
            us = _add_us_suffix(s)
            if n not in seen:
                seen.add(n)
                out.append(n)
            if us not in seen:
                seen.add(us)
                out.append(us)
        return "', '".join(out)

    symbols_in_clause = _symbols_for_query(symbols)

    motherduck_token = os.getenv("MOTHERDUCK_TOKEN")
    if not motherduck_token:
        logger.warning("MOTHERDUCK_TOKEN not set")
        return PortfolioFundamentalsResponse(
            data=[],
            score_columns=[],
            error="MOTHERDUCK_TOKEN not set",
        )

    try:
        import duckdb
        conn = duckdb.connect(f"md:?motherduck_token={motherduck_token}")
    except Exception as e:
        logger.exception("DuckDB connection failed")
        return PortfolioFundamentalsResponse(
            data=[],
            score_columns=[],
            error=str(e),
        )

    merged: Dict[str, Dict[str, Any]] = {_normalize_symbol(s): {"symbol": _normalize_symbol(s)} for s in symbols}

    try:
        # All 5 scores from Stage 2.5 recalculated tables - one query per score
        for score_key, (table_name, col_name) in NEW_SCORE_TABLES.items():
            try:
                q = f"""
                SELECT symbol, {col_name}
                FROM {table_name}
                WHERE symbol IN ('{symbols_in_clause}')
                  AND month_date = (SELECT MAX(month_date) FROM {table_name})
                """
                cur = conn.execute(q)
                rows = cur.fetchall()
                for row in rows:
                    sym_raw = (row[0] or "").replace(".US", "").strip().upper()
                    if not sym_raw:
                        continue
                    if sym_raw not in merged:
                        merged[sym_raw] = {"symbol": sym_raw}
                    if row[1] is not None:
                        merged[sym_raw][score_key] = round(float(row[1]), 2)
            except Exception as e:
                logger.warning("%s query failed: %s", table_name, e)

        conn.close()
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        logger.exception("Fundamentals query failed")
        return PortfolioFundamentalsResponse(
            data=[],
            score_columns=[],
            error=str(e),
        )

    # Preserve order of input symbols; each row has symbol + exactly 5 score keys
    ordered = []
    for s in symbols:
        sym = _normalize_symbol(s)
        row = merged.get(sym, {"symbol": sym})
        out_row = {"symbol": row["symbol"]}
        for k in SCORE_KEYS:
            out_row[k] = row.get(k)
        ordered.append(out_row)

    return PortfolioFundamentalsResponse(
        data=ordered,
        score_columns=SCORE_KEYS,
        error=None,
    )
