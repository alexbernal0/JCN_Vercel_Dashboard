"""
Portfolio Fundamentals (Scores) API
Fetches latest OBQ and Momentum scores from MotherDuck for portfolio symbols.
Tables: PROD_EODHD.main.PROD_OBQ_Scores, PROD_EODHD.main.PROD_OBQ_Momentum_Scores
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


def _is_date_column(name: str) -> bool:
    n = (name or "").lower()
    return n in (
        "date", "as_of_date", "report_date", "updated_at", "asof",
        "month_date", "week_end_date", "calculation_date",
        "fundamental_quarter_date", "fundamental_filing_date", "fs_filing_date",
    )


# Exactly 5 score columns returned to frontend (latest value per stock)
SCORE_KEYS = ["value", "growth", "financial_strength", "quality", "momentum"]

# Map API keys to source columns (OBQ_Scores and Momentum table)
OBQ_VALUE_COLUMNS = ["value_universe_score", "value_historical_score", "value_sector_score"]
OBQ_GROWTH_COLUMN = "growth_score"
OBQ_FS_COLUMN = "fs_score"
OBQ_QUALITY_COLUMN = "quality_score"
MOMENTUM_SCORE_COLUMN = "obq_momentum_score"
MOMENTUM_FALLBACK_COLUMN = "systemscore"  # use when obq_momentum_score is null for latest week


def _get_latest_per_symbol(
    rows: List[tuple],
    column_names: List[str],
    symbol_col: str = "symbol",
) -> Dict[str, Dict[str, Any]]:
    """Group rows by symbol and keep the latest row per symbol (by date column)."""
    date_col = None
    for i, c in enumerate(column_names):
        if _is_date_column(c):
            date_col = (i, c)
            break
    if not date_col:
        date_col = (1, "date")  # assume second column is date if no match

    date_idx = date_col[0]
    try:
        symbol_idx = column_names.index(symbol_col)
    except ValueError:
        symbol_idx = 0

    by_symbol: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        if symbol_idx >= len(row):
            continue
        sym_raw = row[symbol_idx]
        symbol = (sym_raw or "").replace(".US", "").strip().upper()
        if not symbol:
            continue
        key = symbol
        date_val = row[date_idx] if date_idx < len(row) else None
        if key not in by_symbol:
            by_symbol[key] = (date_val, row)
            continue
        prev_date, _ = by_symbol[key]
        # keep row with larger date (more recent)
        if date_val is not None and (prev_date is None or date_val > prev_date):
            by_symbol[key] = (date_val, row)

    out = {}
    for symbol, (_, row) in by_symbol.items():
        out[symbol] = {}
        for i, col in enumerate(column_names):
            if i < len(row):
                val = row[i]
                if col.lower() in ("symbol",) or _is_date_column(col):
                    if col.lower() == "symbol":
                        out[symbol][col] = symbol
                    continue
                if hasattr(val, "isoformat"):
                    val = val.isoformat()[:10]
                out[symbol][col] = val
    return out


def get_portfolio_fundamentals(request: PortfolioFundamentalsRequest) -> PortfolioFundamentalsResponse:
    """
    Fetch latest score for each symbol from PROD_OBQ_Scores and PROD_OBQ_Momentum_Scores.
    Returns one row per symbol and one column per score (merged from both tables).
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
        # 1) PROD_OBQ_Scores – account for .US or no .US in DB
        try:
            q_obq = f"""
            SELECT * FROM PROD_EODHD.main.PROD_OBQ_Scores
            WHERE symbol IN ('{symbols_in_clause}')
            """
            cur = conn.execute(q_obq)
            names_obq = [d[0] for d in cur.description]
            rows_obq = cur.fetchall()
            latest_obq = _get_latest_per_symbol(rows_obq, names_obq)
            for sym, row in latest_obq.items():
                if sym not in merged:
                    merged[sym] = {"symbol": sym}
                # Value: first available of value_universe, value_historical, value_sector
                for col in OBQ_VALUE_COLUMNS:
                    if col in row and row[col] is not None:
                        merged[sym]["value"] = row[col]
                        break
                if OBQ_GROWTH_COLUMN in row:
                    merged[sym]["growth"] = row[OBQ_GROWTH_COLUMN]
                if OBQ_FS_COLUMN in row:
                    merged[sym]["financial_strength"] = row[OBQ_FS_COLUMN]
                if OBQ_QUALITY_COLUMN in row:
                    merged[sym]["quality"] = row[OBQ_QUALITY_COLUMN]
        except Exception as e:
            logger.warning("PROD_OBQ_Scores query failed: %s", e)

        # 2) PROD_OBQ_Momentum_Scores – account for .US or no .US in DB; prefer obq_momentum_score, fallback systemscore
        try:
            q_mom = f"""
            SELECT * FROM PROD_EODHD.main.PROD_OBQ_Momentum_Scores
            WHERE symbol IN ('{symbols_in_clause}')
            """
            cur = conn.execute(q_mom)
            names_mom = [d[0] for d in cur.description]
            rows_mom = cur.fetchall()
            latest_mom = _get_latest_per_symbol(rows_mom, names_mom)
            for sym, row in latest_mom.items():
                if sym not in merged:
                    merged[sym] = {"symbol": sym}
                momentum_val = row.get(MOMENTUM_SCORE_COLUMN)
                if momentum_val is not None:
                    merged[sym]["momentum"] = momentum_val
                elif row.get(MOMENTUM_FALLBACK_COLUMN) is not None:
                    merged[sym]["momentum"] = row[MOMENTUM_FALLBACK_COLUMN]
        except Exception as e:
            logger.warning("PROD_OBQ_Momentum_Scores query failed: %s", e)

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
