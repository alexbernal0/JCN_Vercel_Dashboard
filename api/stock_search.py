"""
JCN Stock Analysis - Universe & Search Endpoint
Provides autocomplete search limited to top 1500 US stocks by market cap.

Architecture:
  - Universe is cached in-memory + /tmp (24hr TTL)
  - Search scores matches: exact ticker > ticker prefix > name prefix > name contains
  - Corrupt market cap entries filtered (> 20T)
  - Excludes _old, _wi suffixed symbols (legacy/delisted artifacts)
"""

import os
import json
import time
import logging
from pathlib import Path as FilePath
from typing import Optional, List
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class StockSearchResult(BaseModel):
    symbol: str               # Clean ticker (no .US)
    company_name: str
    sector: str
    industry: str
    market_cap: float         # In dollars
    market_cap_display: str   # e.g. "$4.1T" or "$256.3B"


class StockSearchResponse(BaseModel):
    results: List[StockSearchResult]
    total_universe: int       # Total symbols in investable universe
    query: str


class UniverseCheckResponse(BaseModel):
    in_universe: bool
    symbol: str
    message: str


# ---------------------------------------------------------------------------
# Universe Cache Configuration
# ---------------------------------------------------------------------------

UNIVERSE_CACHE_PATH = FilePath("/tmp/jcn_stock_universe.json")
UNIVERSE_CACHE_TTL = 24 * 60 * 60          # 24 hours
MAX_MARKET_CAP = 20e12                       # $20T - filter corrupt entries
UNIVERSE_SIZE = 1500

_universe_cache: Optional[List[dict]] = None
_universe_loaded_at: float = 0


def _format_market_cap(mc: float) -> str:
    """Format market cap for human-readable display."""
    if mc >= 1e12:
        return f"${mc / 1e12:.1f}T"
    elif mc >= 1e9:
        return f"${mc / 1e9:.1f}B"
    elif mc >= 1e6:
        return f"${mc / 1e6:.0f}M"
    else:
        return f"${mc:,.0f}"


def _load_universe_from_db() -> List[dict]:
    """
    Query MotherDuck for top 1500 stocks by market cap.
    Uses ROW_NUMBER to get each symbol's latest filing only.
    Filters out corrupt market caps and legacy symbol suffixes.
    """
    import duckdb

    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN not set")

    conn = duckdb.connect(f"md:?motherduck_token={token}")
    try:
        rows = conn.execute("""
            WITH latest_fundamentals AS (
                SELECT
                    symbol,
                    company_name,
                    sector,
                    industry,
                    market_cap,
                    ROW_NUMBER() OVER (
                        PARTITION BY symbol ORDER BY filing_date DESC
                    ) AS rn
                FROM PROD_EODHD.main.PROD_EOD_Fundamentals
                WHERE market_cap IS NOT NULL
                  AND market_cap > 0
                  AND market_cap < ?
                  AND POSITION('_old' IN symbol) = 0
                  AND POSITION('_wi' IN symbol) = 0
                  AND company_name IS NOT NULL
            )
            SELECT symbol, company_name, sector, industry, market_cap
            FROM latest_fundamentals
            WHERE rn = 1
            ORDER BY market_cap DESC
            LIMIT ?
        """, [MAX_MARKET_CAP, UNIVERSE_SIZE]).fetchall()

        universe = []
        for r in rows:
            clean_sym = r[0].replace(".US", "") if r[0] else ""
            universe.append({
                "symbol": clean_sym,
                "symbol_md": r[0],
                "company_name": r[1] or "",
                "sector": r[2] or "Unknown",
                "industry": r[3] or "Unknown",
                "market_cap": r[4] or 0,
                "market_cap_display": _format_market_cap(r[4] or 0),
            })

        return universe
    finally:
        conn.close()


def get_universe() -> List[dict]:
    """
    Get the investable universe (top 1500 by market cap), with 3-layer caching:
      1. In-memory (instant)
      2. /tmp file (survives cold starts within same Vercel instance)
      3. MotherDuck query (fallback)
    """
    global _universe_cache, _universe_loaded_at

    now = time.time()

    # Layer 1: In-memory cache
    if _universe_cache and (now - _universe_loaded_at) < UNIVERSE_CACHE_TTL:
        return _universe_cache

    # Layer 2: /tmp file cache
    if UNIVERSE_CACHE_PATH.exists():
        try:
            data = json.loads(UNIVERSE_CACHE_PATH.read_text())
            if now - data.get("_ts", 0) < UNIVERSE_CACHE_TTL:
                _universe_cache = data["universe"]
                _universe_loaded_at = now
                logger.info(
                    f"Universe loaded from /tmp cache: {len(_universe_cache)} symbols"
                )
                return _universe_cache
        except Exception:
            pass

    # Layer 3: MotherDuck query
    logger.info("Building universe from MotherDuck...")
    universe = _load_universe_from_db()

    # Write-through to /tmp
    try:
        UNIVERSE_CACHE_PATH.write_text(json.dumps({
            "universe": universe,
            "_ts": now,
        }))
    except Exception:
        pass

    _universe_cache = universe
    _universe_loaded_at = now
    logger.info(f"Universe built: {len(universe)} symbols")
    return universe


def search_stocks(query: str, limit: int = 10) -> StockSearchResponse:
    """
    Search for stocks in the investable universe by ticker or company name.

    Scoring priority:
      0 = Exact ticker match
      1 = Ticker starts with query
      2 = Company name starts with query word
      3 = Company name contains query
      4 = Ticker contains query (partial)

    Within each priority tier, results are sorted by market cap (largest first).
    """
    universe = get_universe()
    q = query.strip().upper()

    if not q:
        return StockSearchResponse(
            results=[], total_universe=len(universe), query=query
        )

    scored: list = []
    for stock in universe:
        sym = stock["symbol"].upper()
        name = stock["company_name"].upper()

        if sym == q:
            scored.append((0, stock))
        elif sym.startswith(q):
            scored.append((1, stock))
        elif name.startswith(q):
            scored.append((2, stock))
        elif q in name:
            scored.append((3, stock))
        elif q in sym:
            scored.append((4, stock))

    scored.sort(key=lambda x: (x[0], -x[1]["market_cap"]))

    results = [
        StockSearchResult(
            symbol=s["symbol"],
            company_name=s["company_name"],
            sector=s["sector"],
            industry=s["industry"],
            market_cap=s["market_cap"],
            market_cap_display=s["market_cap_display"],
        )
        for _, s in scored[:limit]
    ]

    return StockSearchResponse(
        results=results, total_universe=len(universe), query=query
    )


def check_universe(symbol: str) -> UniverseCheckResponse:
    """Check if a symbol is in the investable universe (top 1500 by market cap)."""
    universe = get_universe()
    clean = symbol.strip().upper().replace(".US", "")

    found = any(s["symbol"].upper() == clean for s in universe)

    if found:
        return UniverseCheckResponse(
            in_universe=True,
            symbol=clean,
            message=f"{clean} is in the investable universe",
        )
    else:
        return UniverseCheckResponse(
            in_universe=False,
            symbol=clean,
            message=f"{clean} is outside our investable universe",
        )
