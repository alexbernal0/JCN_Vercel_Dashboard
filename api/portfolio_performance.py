"""
Portfolio Performance API Endpoint
Calculates portfolio performance metrics using MotherDuck ONLY
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
    cost_basis: float = Field(..., description="User's cost basis")
    current_price: float = Field(..., description="Current price (latest EOD from MotherDuck)")
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
    Calculate portfolio performance metrics using MotherDuck ONLY
    
    Args:
        request: Portfolio holdings request
        force_refresh: Ignored (kept for API compatibility)
    
    Returns:
        PortfolioPerformanceResponse with all calculated metrics
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
        logger.info("MotherDuck cache loaded, using cached data")
    
    # Step 2: Calculate metrics for each holding
    portfolio_data = []
    total_value = 0.0
    
    for holding in request.holdings:
        ticker = holding.symbol
        cost_basis = holding.cost_basis
        shares = holding.shares
        
        # Get data from MotherDuck
        ticker_data = cache_mgr.get_motherduck_data(ticker)
        
        if not ticker_data:
            logger.warning(f"No MotherDuck data for {ticker}, skipping")
            continue
        
        # Current price = latest EOD close from MotherDuck
        current_price = ticker_data.get('latest_eod_close')
        if not current_price:
            logger.warning(f"No current price data for {ticker}, skipping")
            continue
        
        # Calculate position value
        position_value = current_price * shares
        total_value += position_value
        
        # Get historical prices
        prev_close = ticker_data.get('prev_close')
        ytd_start = ticker_data.get('ytd_start_price')
        year_ago = ticker_data.get('year_ago_price')
        week_52_high = ticker_data.get('week_52_high')
        week_52_low = ticker_data.get('week_52_low')
        
        # Calculate metrics
        daily_change_pct = ((current_price - prev_close) / prev_close * 100) if prev_close else 0
        ytd_pct = ((current_price - ytd_start) / ytd_start * 100) if ytd_start else 0
        yoy_pct = ((current_price - year_ago) / year_ago * 100) if year_ago else 0
        port_gain_pct = ((current_price - cost_basis) / cost_basis * 100)
        pct_below_52wk_high = ((week_52_high - current_price) / week_52_high * 100) if week_52_high else 0
        
        # 52-week channel range (0% = at low, 100% = at high)
        if week_52_high and week_52_low and week_52_high != week_52_low:
            chan_range_pct = ((current_price - week_52_low) / (week_52_high - week_52_low) * 100)
        else:
            chan_range_pct = 0
        
        # Add to portfolio data
        portfolio_data.append({
            'security': ticker_data.get('industry') or ticker,  # Use industry as placeholder for company name
            'ticker': ticker,
            'cost_basis': cost_basis,
            'current_price': current_price,
            'port_pct': 0.0,  # Will calculate after total_value is known
            'daily_change_pct': daily_change_pct,
            'ytd_pct': ytd_pct,
            'yoy_pct': yoy_pct,
            'port_gain_pct': port_gain_pct,
            'pct_below_52wk_high': pct_below_52wk_high,
            'chan_range_pct': chan_range_pct,
            'sector': ticker_data.get('sector') or 'N/A',
            'industry': ticker_data.get('industry') or 'N/A',
            'position_value': position_value
        })
    
    # Step 3: Calculate portfolio percentages
    for item in portfolio_data:
        item['port_pct'] = (item['position_value'] / total_value * 100) if total_value > 0 else 0
        del item['position_value']  # Remove temporary field
    
    # Step 4: Build response
    return PortfolioPerformanceResponse(
        data=[PortfolioPerformanceData(**item) for item in portfolio_data],
        total_portfolio_value=total_value,
        last_updated=datetime.now().isoformat(),
        cache_info=cache_mgr.get_cache_info()
    )
