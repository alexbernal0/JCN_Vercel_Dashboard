"""
Live Prices API Endpoint
Fetches 15-minute delayed real-time prices from EODHD for portfolio symbols.
This is the ONLY module that calls EODHD directly — all other data comes from MotherDuck.

Endpoint: GET /api/prices/live?symbols=AAPL,TSLA,SPMO
Returns: {"prices": {"AAPL": 257.50, "TSLA": 298.00}, "timestamp": "...", "source": "eodhd_realtime"}
"""

import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# EODHD real-time endpoint (15-min delayed)
EODHD_REALTIME_URL = "https://eodhd.com/api/real-time/{symbol}.US"


class LivePricesResponse(BaseModel):
    """Response model for live prices"""
    prices: Dict[str, Optional[float]]
    timestamp: str
    source: str
    errors: Dict[str, str]


async def _fetch_single_price(symbol: str, api_key: str) -> tuple:
    """
    Fetch real-time price for a single symbol from EODHD.
    Returns (symbol, price, error).
    """
    import urllib.request
    import json

    url = f"https://eodhd.com/api/real-time/{symbol}.US?api_token={api_key}&fmt=json"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "JCN-Dashboard/2.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        # EODHD returns: {"code": "AAPL.US", "timestamp": ..., "open": ..., "high": ...,
        #                  "low": ..., "close": ..., "volume": ..., "previousClose": ..., ...}
        price = data.get("close")
        if price is not None:
            return (symbol, float(price), None)
        else:
            return (symbol, None, "No close price in response")

    except Exception as e:
        return (symbol, None, str(e)[:200])


async def fetch_live_prices(symbols_str: str) -> LivePricesResponse:
    """
    Fetch live prices for a comma-separated list of symbols.
    
    Uses EODHD real-time API (15-min delayed).
    Batches requests with asyncio for speed.
    
    Args:
        symbols_str: Comma-separated ticker symbols (e.g. "AAPL,TSLA,SPMO")
    
    Returns:
        LivePricesResponse with prices dict and any errors
    """
    api_key = os.getenv("EODHD_API_KEY", "")
    if not api_key:
        return LivePricesResponse(
            prices={},
            timestamp=datetime.now().isoformat(),
            source="eodhd_realtime",
            errors={"_global": "EODHD_API_KEY not set"}
        )

    # Parse symbols
    symbols = [s.strip().upper() for s in symbols_str.split(",") if s.strip()]
    if not symbols:
        return LivePricesResponse(
            prices={},
            timestamp=datetime.now().isoformat(),
            source="eodhd_realtime",
            errors={"_global": "No symbols provided"}
        )

    logger.info(f"Fetching live prices for {len(symbols)} symbols from EODHD")

    # Fetch all prices concurrently using asyncio
    # EODHD rate limit: 1000/min — 21 symbols is well within limit
    loop = asyncio.get_event_loop()
    tasks = []
    for symbol in symbols:
        tasks.append(loop.run_in_executor(None, _fetch_single_price_sync, symbol, api_key))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    prices: Dict[str, Optional[float]] = {}
    errors: Dict[str, str] = {}

    for result in results:
        if isinstance(result, Exception):
            continue
        symbol, price, error = result
        if price is not None:
            prices[symbol] = price
        if error:
            errors[symbol] = error

    logger.info(f"Live prices fetched: {len(prices)} successful, {len(errors)} errors")

    return LivePricesResponse(
        prices=prices,
        timestamp=datetime.now().isoformat(),
        source="eodhd_realtime",
        errors=errors
    )


def _fetch_single_price_sync(symbol: str, api_key: str) -> tuple:
    """
    Synchronous version of price fetch for use with run_in_executor.
    Returns (symbol, price, error).
    """
    import urllib.request
    import json

    url = f"https://eodhd.com/api/real-time/{symbol}.US?api_token={api_key}&fmt=json"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "JCN-Dashboard/2.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        price = data.get("close")
        if price is not None:
            return (symbol, float(price), None)
        else:
            return (symbol, None, "No close price in response")

    except Exception as e:
        return (symbol, None, str(e)[:200])
