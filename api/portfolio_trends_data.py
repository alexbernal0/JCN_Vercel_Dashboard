"""
Portfolio Trends Data API
Returns weekly OHLC for portfolio symbols for trend charts (candlestick + regression + drawdown).
"""

from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime, timedelta
from .cache_manager import get_cache_manager


class PortfolioTrendsRequest(BaseModel):
    symbols: List[str]


class PortfolioTrendsResponse(BaseModel):
    data: Dict[str, List[Dict[str, Any]]]  # symbol -> [{ date, open, high, low, close }]
    start_date: str
    end_date: str
    symbols: List[str]
    timestamp: str


def get_portfolio_trends_data(request: PortfolioTrendsRequest, years: int = 8) -> PortfolioTrendsResponse:
    """
    Fetch weekly OHLC for portfolio symbols (last N years) for trends grid.
    """
    cache_mgr = get_cache_manager()
    end_date = datetime.now()
    start_date = end_date - timedelta(days=years * 365)
    symbols_with_suffix = [f"{s.strip().upper()}.US" for s in request.symbols if s and s.strip()]

    if not symbols_with_suffix:
        return PortfolioTrendsResponse(
            data={},
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d'),
            symbols=request.symbols,
            timestamp=datetime.now().isoformat(),
        )

    ohlc = cache_mgr.fetch_weekly_ohlc(
        symbols_with_suffix,
        start_date.strftime('%Y-%m-%d'),
        end_date.strftime('%Y-%m-%d'),
    )

    return PortfolioTrendsResponse(
        data=ohlc,
        start_date=start_date.strftime('%Y-%m-%d'),
        end_date=end_date.strftime('%Y-%m-%d'),
        symbols=request.symbols,
        timestamp=datetime.now().isoformat(),
    )
