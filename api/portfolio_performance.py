"""
Portfolio Performance API Endpoint
Calculates portfolio performance metrics using MotherDuck PROD_DASHBOARD_SNAPSHOT.
Uses adjusted_close only (PD-05). Supports ETFs via snapshot table.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import HTTPException

from .cache_manager import get_cache_manager

logger = logging.getLogger(__name__)


class Holding(BaseModel):
    """Portfolio holding model"""
    symbol: str = Field(..., description="Stock ticker symbol")
    cost_basis: float = Field(..., description="Purchase price per share")
    shares: float = Field(..., description="Number of shares owned")


class PortfolioRequest(BaseModel):
    """Portfolio performance request model"""
    holdings: List[Holding] = Field(..., description="List of portfolio holdings")


class PortfolioPerformanceData(BaseModel):
    """Portfolio performance response data for a single stock"""
    security: str = Field(..., description="Company name")
    ticker: str = Field(..., description="Stock ticker symbol")
    cost_basis: float = Field(..., description="User cost basis")
    current_price: float = Field(..., description="Current price (latest adjusted_close from MotherDuck)")
    port_pct: float = Field(..., description="Percentage of total portfolio")
    daily_change_pct: float = Field(..., description="Daily percentage change")
    ytd_pct: float = Field(..., description="Year-to-date percentage change")
    yoy_pct: float = Field(..., description="Year-over-year percentage change")
    port_gain_pct: float = Field(..., description="Portfolio gain percentage")
    pct_below_52wk_high: float = Field(..., description="Percentage below 52-week high")
    chan_range_pct: float = Field(..., description="52-week channel range percentage")
    sector: str = Field(..., description="GICS sector")
    industry: str = Field(..., description="Industry classification")


class PortfolioPerformanceResponse(BaseModel):
    """Portfolio performance response model"""
    data: List[PortfolioPerformanceData]
    total_portfolio_value: float
    last_updated: str
    cache_info: Dict[str, Any]


def calculate_portfolio_performance(
    request: PortfolioRequest,
    force_refresh: bool = False
) -> PortfolioPerformanceResponse:
    """
    Calculate portfolio performance metrics using MotherDuck PROD_DASHBOARD_SNAPSHOT.

    The snapshot table has pre-computed daily_change_pct, ytd_pct, yoy_pct,
    pct_below_52wk_high, chan_range_pct, sector, industry, market_cap.
    We only need to calculate port_pct and port_gain_pct (user-specific).
    """
    cache_mgr = get_cache_manager()
    tickers = [h.symbol for h in request.holdings]

    logger.info(f"Processing portfolio performance for {len(tickers)} tickers")

    # Step 1: Ensure MotherDuck data is loaded (once per day, cached)
    md_data = cache_mgr.get_all_motherduck_data()
    if not md_data:
        logger.info("MotherDuck cache not loaded, fetching fresh data...")
        md_data = cache_mgr.fetch_motherduck_data(tickers)
    else:
        # Check all requested tickers are in cache
        missing = [t for t in tickers if f"{t}.US" not in md_data]
        if missing:
            logger.info(f"Cache missing {len(missing)} tickers, refetching...")
            md_data = cache_mgr.fetch_motherduck_data(tickers)
        else:
            logger.info("MotherDuck cache loaded, using cached data")

    # Step 2: Calculate metrics for each holding
    portfolio_data = []
    total_value = 0.0

    for holding in request.holdings:
        ticker = holding.symbol
        cost_basis = holding.cost_basis
        shares = holding.shares

        # Get data from MotherDuck (snapshot or fallback)
        ticker_data = cache_mgr.get_motherduck_data(ticker)

        if not ticker_data:
            logger.warning(f"No MotherDuck data for {ticker}, skipping")
            continue

        # Current price = latest adjusted_close from snapshot (PD-05)
        current_price = ticker_data.get("latest_eod_close")
        if not current_price:
            logger.warning(f"No current price data for {ticker}, skipping")
            continue

        # Calculate position value
        position_value = current_price * shares
        total_value += position_value

        # Use pre-calculated percentages from snapshot when available,
        # fall back to manual calculation if not present
        prev_close = ticker_data.get("prev_close")
        ytd_start = ticker_data.get("ytd_start_price")
        year_ago = ticker_data.get("year_ago_price")
        week_52_high = ticker_data.get("week_52_high")
        week_52_low = ticker_data.get("week_52_low")

        # Pre-calculated from snapshot (preferred) or manual fallback
        daily_change_pct = ticker_data.get("daily_change_pct")
        if daily_change_pct is None:
            daily_change_pct = ((current_price - prev_close) / prev_close * 100) if prev_close else 0

        ytd_pct = ticker_data.get("ytd_pct")
        if ytd_pct is None:
            ytd_pct = ((current_price - ytd_start) / ytd_start * 100) if ytd_start else 0

        yoy_pct = ticker_data.get("yoy_pct")
        if yoy_pct is None:
            yoy_pct = ((current_price - year_ago) / year_ago * 100) if year_ago else 0

        # port_gain_pct is ALWAYS calculated (depends on user cost_basis)
        port_gain_pct = ((current_price - cost_basis) / cost_basis * 100) if cost_basis else 0

        pct_below_52wk_high = ticker_data.get("pct_below_52wk_high")
        if pct_below_52wk_high is None:
            pct_below_52wk_high = ((week_52_high - current_price) / week_52_high * 100) if week_52_high else 0

        chan_range_pct = ticker_data.get("chan_range_pct")
        if chan_range_pct is None:
            if week_52_high and week_52_low and week_52_high != week_52_low:
                chan_range_pct = ((current_price - week_52_low) / (week_52_high - week_52_low) * 100)
            else:
                chan_range_pct = 0

        # Security name: ticker is used (frontend has TICKER_TO_COMPANY map for display)
        portfolio_data.append({
            "security": ticker,
            "ticker": ticker,
            "cost_basis": cost_basis,
            "current_price": current_price,
            "port_pct": 0.0,  # Will calculate after total_value is known
            "daily_change_pct": round(daily_change_pct, 2) if daily_change_pct else 0,
            "ytd_pct": round(ytd_pct, 2) if ytd_pct else 0,
            "yoy_pct": round(yoy_pct, 2) if yoy_pct else 0,
            "port_gain_pct": round(port_gain_pct, 2) if port_gain_pct else 0,
            "pct_below_52wk_high": round(pct_below_52wk_high, 2) if pct_below_52wk_high else 0,
            "chan_range_pct": round(chan_range_pct, 2) if chan_range_pct else 0,
            "sector": ticker_data.get("sector") or "N/A",
            "industry": ticker_data.get("industry") or "N/A",
            "position_value": position_value
        })

    # Step 3: Calculate portfolio percentages
    for item in portfolio_data:
        item["port_pct"] = round((item["position_value"] / total_value * 100), 2) if total_value > 0 else 0
        del item["position_value"]  # Remove temporary field

    # Step 4: Build response
    return PortfolioPerformanceResponse(
        data=[PortfolioPerformanceData(**item) for item in portfolio_data],
        total_portfolio_value=total_value,
        last_updated=datetime.now().isoformat(),
        cache_info=cache_mgr.get_cache_info()
    )
